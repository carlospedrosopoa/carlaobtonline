// app/api/gestao-arena/card-cliente/[id]/agendamento/[agendamentoCardId]/route.ts - API de Agendamento individual do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// DELETE /api/gestao-arena/card-cliente/[id]/agendamento/[agendamentoCardId] - Desvincular agendamento do card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendamentoCardId: string }> }
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
        { mensagem: 'Você não tem permissão para desvincular agendamentos do card' },
        { status: 403 }
      );
    }

    const { id: cardId, agendamentoCardId } = await params;

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
        { mensagem: 'Não é possível desvincular agendamentos de um card cancelado' },
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

    // Verificar se a tabela existe e se o agendamento está vinculado ao card
    try {
      const tableExists = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'CardAgendamento'
        )`
      );

      if (!tableExists.rows[0]?.exists) {
        return NextResponse.json(
          { mensagem: 'Tabela CardAgendamento não existe' },
          { status: 404 }
        );
      }

      const agendamentoCardResult = await query(
        'SELECT id FROM "CardAgendamento" WHERE id = $1 AND "cardId" = $2',
        [agendamentoCardId, cardId]
      );

      if (agendamentoCardResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Agendamento não encontrado neste card' },
          { status: 404 }
        );
      }

      // Desvincular agendamento
      await query('DELETE FROM "CardAgendamento" WHERE id = $1', [agendamentoCardId]);

      // Atualizar valor total do card
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
      console.error('Erro ao desvincular agendamento:', error);
      return NextResponse.json(
        { mensagem: 'Erro ao desvincular agendamento', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ mensagem: 'Agendamento desvinculado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao desvincular agendamento do card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao desvincular agendamento do card', error: error.message },
      { status: 500 }
    );
  }
}

