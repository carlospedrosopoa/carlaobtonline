// app/api/gestao-arena/card-cliente/[id]/agendamento/route.ts - API de Agendamentos do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// GET /api/gestao-arena/card-cliente/[id]/agendamento - Listar agendamentos vinculados ao card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { id: cardId } = await params;

    // Verificar se o card existe e se o usuário tem acesso
    const cardResult = await query(
      'SELECT "pointId" FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
    }

    const card = cardResult.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
      }
    }

    // Verificar se a tabela existe
    let result;
    try {
      const tableExists = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'CardAgendamento'
        )`
      );

      if (!tableExists.rows[0]?.exists) {
        return NextResponse.json([]);
      }

      result = await query(
        `SELECT 
          ca.id, ca."cardId", ca."agendamentoId", ca.valor, ca."createdAt",
          a.id as "agendamento_id", a."dataHora", a.duracao, a."valorCalculado", a."valorNegociado", a.status,
          q.id as "quadra_id", q.nome as "quadra_nome"
        FROM "CardAgendamento" ca
        INNER JOIN "Agendamento" a ON ca."agendamentoId" = a.id
        INNER JOIN "Quadra" q ON a."quadraId" = q.id
        WHERE ca."cardId" = $1
        ORDER BY a."dataHora" DESC`,
        [cardId]
      );
    } catch (error: any) {
      console.error('Erro ao buscar agendamentos do card:', error);
      return NextResponse.json([]);
    }

    const agendamentos = result.rows.map((row: any) => ({
      id: row.id,
      cardId: row.cardId,
      agendamentoId: row.agendamentoId,
      valor: parseFloat(row.valor),
      createdAt: row.createdAt,
      agendamento: {
        id: row.agendamento_id,
        quadra: {
          id: row.quadra_id,
          nome: row.quadra_nome,
        },
        dataHora: row.dataHora,
        duracao: row.duracao,
        valorCalculado: row.valorCalculado ? parseFloat(row.valorCalculado) : null,
        valorNegociado: row.valorNegociado ? parseFloat(row.valorNegociado) : null,
        status: row.status,
      },
    }));

    return NextResponse.json(agendamentos);
  } catch (error: any) {
    console.error('Erro ao listar agendamentos do card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos do card', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/card-cliente/[id]/agendamento - Vincular agendamento ao card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para vincular agendamentos ao card' },
        { status: 403 }
      );
    }

    const { id: cardId } = await params;
    const body = await request.json();
    const { agendamentoId } = body;

    if (!agendamentoId) {
      return NextResponse.json(
        { mensagem: 'AgendamentoId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o card existe
    const cardResult = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
    }

    const card = cardResult.rows[0];

    if (card.status === 'CANCELADO') {
      return NextResponse.json(
        { mensagem: 'Não é possível vincular agendamentos a um card cancelado' },
        { status: 400 }
      );
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
      }
    }

    // Verificar se o agendamento existe e pertence ao mesmo point
    const agendamentoResult = await query(
      `SELECT a.id, a."valorCalculado", a."valorNegociado", q."pointId"
       FROM "Agendamento" a
       INNER JOIN "Quadra" q ON a."quadraId" = q.id
       WHERE a.id = $1`,
      [agendamentoId]
    );

    if (agendamentoResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    const agendamento = agendamentoResult.rows[0];

    if (agendamento.pointId !== card.pointId) {
      return NextResponse.json(
        { mensagem: 'O agendamento não pertence à mesma arena do card' },
        { status: 400 }
      );
    }

    // Verificar se a tabela existe e se o agendamento já está vinculado a outro card
    try {
      const tableExists = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'CardAgendamento'
        )`
      );

      if (tableExists.rows[0]?.exists) {
        const jaVinculado = await query(
          'SELECT id FROM "CardAgendamento" WHERE "agendamentoId" = $1',
          [agendamentoId]
        );

        if (jaVinculado.rows.length > 0) {
          return NextResponse.json(
            { mensagem: 'Este agendamento já está vinculado a outro card' },
            { status: 400 }
          );
        }
      }
    } catch (error: any) {
      return NextResponse.json(
        { mensagem: 'Erro ao verificar vínculo do agendamento. A tabela CardAgendamento pode não existir ainda.' },
        { status: 500 }
      );
    }

    // Calcular valor do agendamento (usa valorNegociado se existir, senão valorCalculado)
    const valorAgendamento = agendamento.valorNegociado 
      ? parseFloat(agendamento.valorNegociado) 
      : (agendamento.valorCalculado ? parseFloat(agendamento.valorCalculado) : 0);

    if (valorAgendamento <= 0) {
      return NextResponse.json(
        { mensagem: 'O agendamento não possui valor válido' },
        { status: 400 }
      );
    }

    // Vincular agendamento ao card
    let result;
    try {
      result = await query(
        `INSERT INTO "CardAgendamento" (
          id, "cardId", "agendamentoId", valor, "createdAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, NOW()
        ) RETURNING *`,
        [cardId, agendamentoId, valorAgendamento]
      );
    } catch (error: any) {
      return NextResponse.json(
        { mensagem: 'Erro ao vincular agendamento. A tabela CardAgendamento pode não existir ainda. Por favor, crie a tabela primeiro.' },
        { status: 500 }
      );
    }

    // Atualizar valor total do card
    try {
      const totalItensResult = await query(
        'SELECT COALESCE(SUM("precoTotal"), 0) as total FROM "ItemCard" WHERE "cardId" = $1',
        [cardId]
      );
      let totalAgendamentos = 0;
      try {
        const totalAgendamentosResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "CardAgendamento" WHERE "cardId" = $1',
          [cardId]
        );
        totalAgendamentos = parseFloat(totalAgendamentosResult.rows[0].total);
      } catch (error: any) {
        totalAgendamentos = 0;
      }
      const novoValorTotal = parseFloat(totalItensResult.rows[0].total) + totalAgendamentos;
      
      await query(
        `UPDATE "CardCliente" 
         SET "valorTotal" = $1,
         "updatedAt" = NOW()
         WHERE id = $2`,
        [novoValorTotal, cardId]
      );
    } catch (error: any) {
      console.error('Erro ao atualizar valor total do card:', error);
      // Não falhar a requisição se houver erro ao atualizar valor total
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao vincular agendamento ao card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao vincular agendamento ao card', error: error.message },
      { status: 500 }
    );
  }
}

