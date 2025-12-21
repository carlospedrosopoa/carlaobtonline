// app/api/user/pagamento/infinite-pay/callback/route.ts - Callback do Infinite Pay
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

// POST /api/user/pagamento/infinite-pay/callback - Callback do Infinite Pay
// Esta rota será chamada pelo Infinite Pay após o pagamento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, status, transaction_id, message } = body;

    if (!order_id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'order_id é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar pagamento pelo orderId
    const pagamentoResult = await query(
      `SELECT p.*, c."usuarioId", c."valorTotal",
              COALESCE(SUM(p2.valor), 0) as "totalPago"
       FROM "PagamentoInfinitePay" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       LEFT JOIN "PagamentoCard" p2 ON p2."cardId" = c.id AND p2.id != p."pagamentoCardId"
       WHERE p."orderId" = $1
       GROUP BY p.id, c.id`,
      [order_id]
    );

    if (pagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];

    // Atualizar status do pagamento
    await query(
      `UPDATE "PagamentoInfinitePay"
       SET status = $1,
           "transactionId" = $2,
           message = $3,
           "updatedAt" = NOW()
       WHERE "orderId" = $4`,
      [status.toUpperCase(), transaction_id || null, message || null, order_id]
    );

    // Se o pagamento foi aprovado, criar o registro de pagamento no card
    if (status === 'approved' || status === 'APPROVED') {
      // Verificar se já existe pagamento criado
      const pagamentoExistente = await query(
        'SELECT id FROM "PagamentoCard" WHERE "infinitePayOrderId" = $1',
        [order_id]
      );

      if (pagamentoExistente.rows.length === 0) {
        // Buscar forma de pagamento Infinite Pay ou criar uma padrão
        let formaPagamentoId = await query(
          'SELECT id FROM "FormaPagamento" WHERE nome ILIKE $1 LIMIT 1',
          ['%infinite pay%']
        );

        if (formaPagamentoId.rows.length === 0) {
          // Criar forma de pagamento se não existir
          const novaForma = await query(
            `INSERT INTO "FormaPagamento" (id, nome, tipo, "createdAt")
             VALUES (gen_random_uuid()::text, 'Infinite Pay', 'CARTAO', NOW())
             RETURNING id`,
            []
          );
          formaPagamentoId = novaForma;
        }

        // Criar pagamento no card
        const pagamentoCard = await query(
          `INSERT INTO "PagamentoCard" (
            id, "cardId", "formaPagamentoId", valor, observacoes, 
            "infinitePayOrderId", "infinitePayTransactionId", "createdAt", "createdBy"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), $7
          )
          RETURNING id`,
          [
            pagamento.cardId,
            formaPagamentoId.rows[0].id,
            pagamento.valor,
            `Pagamento via Infinite Pay - Order: ${order_id}`,
            order_id,
            transaction_id || null,
            pagamento.usuarioId,
          ]
        );

        // Verificar se o card deve ser fechado
        const totalPago = parseFloat(pagamento.totalPago) + parseFloat(pagamento.valor);
        const valorTotal = parseFloat(pagamento.valorTotal);

        if (totalPago >= valorTotal) {
          // Fechar o card
          await query(
            `UPDATE "CardCliente"
             SET status = 'FECHADO',
                 "fechadoAt" = NOW(),
                 "fechadoBy" = $1,
                 "updatedAt" = NOW()
             WHERE id = $2`,
            [pagamento.usuarioId, pagamento.cardId]
          );
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso',
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[INFINITE PAY CALLBACK] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao processar callback',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

