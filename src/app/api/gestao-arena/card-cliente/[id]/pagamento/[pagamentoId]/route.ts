// app/api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId]/route.ts - API de Pagamento individual do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// DELETE /api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId] - Remover pagamento do card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagamentoId: string }> }
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

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para remover pagamentos do card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId, pagamentoId } = await params;

    // Verificar se o card existe
    const cardResult = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = cardResult.rows[0];

    if (card.status === 'CANCELADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível remover pagamentos de um card cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se o pagamento existe e pertence ao card
    const pagamentoResult = await query(
      `SELECT p.id, p.valor, c."numeroCard"
       FROM "PagamentoCard" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       WHERE p.id = $1 AND p."cardId" = $2`,
      [pagamentoId, cardId]
    );

    if (pagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];
    const numeroCard = pagamento.numeroCard;
    const valorPagamento = parseFloat(pagamento.valor);

    // Excluir entrada de caixa relacionada (se existir)
    // Buscar entrada manual que tenha descrição relacionada ao card
    try {
      const entradaResult = await query(
        `SELECT id FROM "EntradaCaixa" 
         WHERE "pointId" = $1 
         AND valor = $2
         AND descricao LIKE $3
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [card.pointId, valorPagamento, `%Card #${numeroCard}%`]
      );

      if (entradaResult.rows.length > 0) {
        await query('DELETE FROM "EntradaCaixa" WHERE id = $1', [entradaResult.rows[0].id]);
      }
    } catch (error: any) {
      // Log do erro mas não falha a exclusão do pagamento
      console.error('Erro ao excluir entrada de caixa relacionada:', error);
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
           SET status = 'ABERTO', "fechadoAt" = NULL, "fechadoBy" = NULL, "updatedAt" = NOW(), "updatedById" = $2 
           WHERE id = $1`,
          [cardId, usuario.id]
        );
      } else {
        // Atualizar updatedAt mesmo se não reabrir
        await query(
          'UPDATE "CardCliente" SET "updatedAt" = NOW(), "updatedById" = $2 WHERE id = $1',
          [cardId, usuario.id]
        );
      }
    } else {
      // Atualizar updatedAt mesmo se o card não estava fechado
      await query(
        'UPDATE "CardCliente" SET "updatedAt" = NOW(), "updatedById" = $2 WHERE id = $1',
        [cardId, usuario.id]
      );
    }

    const response = NextResponse.json({ mensagem: 'Pagamento removido com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao remover pagamento do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao remover pagamento do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

