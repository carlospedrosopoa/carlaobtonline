// app/api/competicao/[id]/agendamentos/route.ts - Rotas para agendamentos de competição
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/competicao/[id]/agendamentos - Listar agendamentos da competição
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { id: competicaoId } = await params;

    // Verificar se a competição existe e o usuário tem acesso
    const competicaoResult = await query(
      `SELECT id, "pointId", nome FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );

    if (competicaoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const competicao = competicaoResult.rows[0];

    // Verificar acesso (apenas ADMIN ou ORGANIZER da mesma arena)
    if (usuario.role !== 'ADMIN' && (usuario.role !== 'ORGANIZER' || usuario.pointIdGestor !== competicao.pointId)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar agendamentos da competição
    const agendamentosResult = await query(
      `SELECT 
        a.id, a."quadraId", a."usuarioId", a."dataHora", a.duracao,
        a."valorHora", a."valorCalculado", a."valorNegociado",
        a.status, a.observacoes, a."createdAt", a."updatedAt",
        q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      WHERE a."competicaoId" = $1
      ORDER BY a."dataHora" ASC`,
      [competicaoId]
    );

    const agendamentos = agendamentosResult.rows.map((row) => ({
      id: row.id,
      quadraId: row.quadraId,
      dataHora: normalizarDataHora(row.dataHora),
      duracao: row.duracao,
      valorHora: row.valorHora,
      valorCalculado: row.valorCalculado,
      valorNegociado: row.valorNegociado,
      status: row.status,
      observacoes: row.observacoes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      quadra: {
        id: row.quadra_id,
        nome: row.quadra_nome,
        pointId: row.quadra_pointId,
      },
    }));

    const response = NextResponse.json({ agendamentos });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[GET /api/competicao/[id]/agendamentos] Erro:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/competicao/[id]/agendamentos - Criar agendamento para a competição
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { id: competicaoId } = await params;
    const body = await request.json();
    const { quadraId, dataHora, duracao, observacoes } = body;

    // Validações
    if (!quadraId || !dataHora || !duracao) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra, data/hora e duração são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a competição existe e o usuário tem acesso
    const competicaoResult = await query(
      `SELECT id, "pointId", nome FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );

    if (competicaoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const competicao = competicaoResult.rows[0];

    // Verificar acesso (apenas ADMIN ou ORGANIZER da mesma arena)
    if (usuario.role !== 'ADMIN' && (usuario.role !== 'ORGANIZER' || usuario.pointIdGestor !== competicao.pointId)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a quadra pertence à mesma arena
    const quadraResult = await query(
      `SELECT id, "pointId", nome FROM "Quadra" WHERE id = $1`,
      [quadraId]
    );

    if (quadraResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const quadra = quadraResult.rows[0];
    if (quadra.pointId !== competicao.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'A quadra deve pertencer à mesma arena da competição' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar disponibilidade da quadra (verificar conflitos)
    // Permitir múltiplas quadras no mesmo horário para a mesma competição
    // Mas bloquear se houver outro agendamento (de outra competição ou normal) no mesmo horário
    const dataHoraInicio = new Date(dataHora);
    const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60000);

    const conflitosResult = await query(
      `SELECT id, "competicaoId" FROM "Agendamento"
       WHERE "quadraId" = $1
         AND status != 'CANCELADO'
         AND (
           ("dataHora" >= $3 AND "dataHora" < $4)
           OR ("dataHora" + INTERVAL '1 minute' * duracao > $3 AND "dataHora" < $4)
         )
         AND (
           -- Bloquear se for outro agendamento (não da mesma competição)
           ("competicaoId" IS NOT NULL AND "competicaoId" != $2)
           OR 
           -- Bloquear se for um agendamento normal (sem competição)
           ("competicaoId" IS NULL)
         )`,
      [quadraId, competicaoId, dataHoraInicio.toISOString(), dataHoraFim.toISOString()]
    );

    if (conflitosResult.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe um agendamento para este horário nesta quadra' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar valor da quadra (se houver tabela de preço)
    let valorHora: number | null = null;
    const tabelaPrecoResult = await query(
      `SELECT "valorHora" FROM "TabelaPreco"
       WHERE "quadraId" = $1 AND ativo = true
       ORDER BY "createdAt" DESC LIMIT 1`,
      [quadraId]
    );

    if (tabelaPrecoResult.rows.length > 0) {
      valorHora = parseFloat(tabelaPrecoResult.rows[0].valorHora);
    }

    // Calcular valor
    const valorCalculado = valorHora ? (valorHora * duracao) / 60 : null;

    // Criar agendamento
    const agendamentoId = crypto.randomUUID();
    await query(
      `INSERT INTO "Agendamento" (
        id, "competicaoId", "quadraId", "usuarioId",
        "dataHora", duracao, "valorHora", "valorCalculado",
        status, observacoes, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        agendamentoId,
        competicaoId,
        quadraId,
        usuario.id,
        dataHoraInicio.toISOString(),
        duracao,
        valorHora,
        valorCalculado,
        'CONFIRMADO',
        observacoes || null,
      ]
    );

    // Buscar agendamento criado
    const novoAgendamentoResult = await query(
      `SELECT 
        a.id, a."quadraId", a."dataHora", a.duracao,
        a."valorHora", a."valorCalculado", a.status, a.observacoes,
        q.id as "quadra_id", q.nome as "quadra_nome"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      WHERE a.id = $1`,
      [agendamentoId]
    );

    const novoAgendamento = novoAgendamentoResult.rows[0];

    const response = NextResponse.json({
      mensagem: 'Agendamento criado com sucesso',
      agendamento: {
        id: novoAgendamento.id,
        quadraId: novoAgendamento.quadraId,
        dataHora: normalizarDataHora(novoAgendamento.dataHora),
        duracao: novoAgendamento.duracao,
        valorHora: novoAgendamento.valorHora,
        valorCalculado: novoAgendamento.valorCalculado,
        status: novoAgendamento.status,
        observacoes: novoAgendamento.observacoes,
        quadra: {
          id: novoAgendamento.quadra_id,
          nome: novoAgendamento.quadra_nome,
        },
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[POST /api/competicao/[id]/agendamentos] Erro:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar agendamento', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

