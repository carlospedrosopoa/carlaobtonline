// app/api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId]/route.ts - API de Pagamento individual do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// DELETE /api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId] - Remover pagamento do card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagamentoId: string }> }
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
        { mensagem: 'Você não tem permissão para remover pagamentos do card' },
        { status: 403 }
      );
    }

    const { id: cardId, pagamentoId } = await params;

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
        { mensagem: 'Não é possível remover pagamentos de um card cancelado' },
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

    // Verificar se o pagamento existe e pertence ao card
    const pagamentoResult = await query(
      'SELECT id FROM "PagamentoCard" WHERE id = $1 AND "cardId" = $2',
      [pagamentoId, cardId]
    );

    if (pagamentoResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }

    await query('DELETE FROM "PagamentoCard" WHERE id = $1', [pagamentoId]);

    // Se o card estava fechado, reabrir se necessário
    if (card.status === 'FECHADO') {
      const pagamentosResult = await query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
        [cardId]
      );
      const totalPago = parseFloat(pagamentosResult.rows[0].total);
      const valorTotalResult = await query(
        'SELECT "valorTotal" FROM "CardCliente" WHERE id = $1',
        [cardId]
      );
      const valorTotal = parseFloat(valorTotalResult.rows[0].valorTotal);

      if (totalPago < valorTotal) {
        await query(
          `UPDATE "CardCliente" 
           SET status = 'ABERTO', "fechadoAt" = NULL, "fechadoBy" = NULL, "updatedAt" = NOW() 
           WHERE id = $1`,
          [cardId]
        );
      }
    }

    return NextResponse.json({ mensagem: 'Pagamento removido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover pagamento do card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao remover pagamento do card', error: error.message },
      { status: 500 }
    );
  }
}

