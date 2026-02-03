import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

function getApiKey(request: NextRequest) {
  return request.headers.get('x-api-key') || '';
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.HUB_PAYMENTS_API_KEY || '';
  if (!expected) return false;
  return getApiKey(request) === expected;
}

function mapFormaPagamento(paymentMethod: string | null | undefined) {
  const tipo = (paymentMethod || '').toUpperCase();
  if (tipo === 'PIX') return { nome: 'Pagamento Online (Pix)', tipo: 'PIX' as const };
  if (tipo === 'CREDIT_CARD') return { nome: 'Pagamento Online (Cartão)', tipo: 'CARTAO_CREDITO' as const };
  return { nome: 'Pagamento Online', tipo: 'OUTRO' as const };
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      const errorResponse = NextResponse.json({ mensagem: 'Não autorizado' }, { status: 401 });
      return withCors(errorResponse, request);
    }

    const body = await request.json();

    const transactionId =
      (body?.transaction_id as string | undefined) ||
      (body?.transactionId as string | undefined) ||
      (body?.reference_id as string | undefined);

    const statusRaw = (body?.status as string | undefined) || 'PENDING';
    const status = String(statusRaw).toUpperCase();

    const paymentMethod =
      (body?.payment_method as string | undefined) ||
      (body?.paymentMethod as string | undefined) ||
      null;

    const pagbankOrderId =
      (body?.pagbank_order_id as string | undefined) ||
      (body?.pagbankOrderId as string | undefined) ||
      null;

    const projectName =
      (body?.project_name as string | undefined) ||
      (body?.projectName as string | undefined) ||
      'PLAY_NA_QUADRA';

    const orderId =
      (body?.order_id as string | undefined) ||
      (body?.orderId as string | undefined) ||
      null;

    const amount =
      (body?.amount as number | undefined) ||
      (body?.amount_cents as number | undefined) ||
      null;

    const metadata = (body?.metadata as Record<string, unknown> | undefined) || undefined;

    if (!transactionId) {
      const errorResponse = NextResponse.json({ mensagem: 'transaction_id é obrigatório' }, { status: 400 });
      return withCors(errorResponse, request);
    }

    let hubRow: any | null = null;
    try {
      const hubRes = await query(
        `SELECT *
         FROM "PagamentoHub"
         WHERE "transactionId" = $1
         LIMIT 1`,
        [transactionId]
      );
      hubRow = hubRes.rows[0] || null;
    } catch (e: any) {
      if (e?.code !== '42P01') {
        throw e;
      }
    }

    if (!hubRow) {
      const cardId = (metadata?.cardId as string | undefined) || (body?.cardId as string | undefined);
      const pointId = (metadata?.pointId as string | undefined) || (body?.pointId as string | undefined);
      const usuarioId = (metadata?.usuarioId as string | undefined) || (body?.usuarioId as string | undefined);
      const valor = (metadata?.valor as number | undefined) || (body?.valor as number | undefined) || null;

      if (!cardId || !pointId || !usuarioId || !orderId || !amount || !valor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Transação desconhecida e dados insuficientes para upsert' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      try {
        await query(
          `INSERT INTO "PagamentoHub" (
            "transactionId", "projectName", "orderId", "paymentMethod", "status",
            "amount", "valor", "pagbankOrderId",
            "cardId", "pointId", "usuarioId",
            "metadata", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11,
            $12, NOW(), NOW()
          )`,
          [
            transactionId,
            projectName,
            orderId,
            String(paymentMethod || 'PIX').toUpperCase(),
            status,
            amount,
            valor,
            pagbankOrderId,
            cardId,
            pointId,
            usuarioId,
            JSON.stringify(body),
          ]
        );
      } catch (e: any) {
        if (e?.code !== '42P01') {
          throw e;
        }
      }
    } else {
      await query(
        `UPDATE "PagamentoHub"
         SET status = $2,
             "pagbankOrderId" = COALESCE($3, "pagbankOrderId"),
             "paymentMethod" = COALESCE($4, "paymentMethod"),
             "updatedAt" = NOW()
         WHERE "transactionId" = $1`,
        [transactionId, status, pagbankOrderId, paymentMethod ? String(paymentMethod).toUpperCase() : null]
      );
    }

    const pagamentoHubRes = await query(
      `SELECT *
       FROM "PagamentoHub"
       WHERE "transactionId" = $1
       LIMIT 1`,
      [transactionId]
    );
    const pagamentoHub = pagamentoHubRes.rows[0];

    if (status === 'PAID' && !pagamentoHub.pagamentoCardId) {
      const { nome: nomeForma, tipo: tipoForma } = mapFormaPagamento(pagamentoHub.paymentMethod);

      let formaPagamentoRes = await query(
        'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2 LIMIT 1',
        [pagamentoHub.pointId, nomeForma]
      );

      if (formaPagamentoRes.rows.length === 0) {
        formaPagamentoRes = await query(
          `INSERT INTO "FormaPagamento" (
            id, "pointId", nome, descricao, tipo, ativo, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, NULL, $3, true, NOW(), NOW()
          )
          RETURNING id`,
          [pagamentoHub.pointId, nomeForma, tipoForma]
        );
      }

      const valorPago = Number(pagamentoHub.valor);
      const pagamentoCardRes = await query(
        `INSERT INTO "PagamentoCard" (
          id, "cardId", "formaPagamentoId", valor, observacoes,
          "createdAt", "createdById"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4,
          NOW(), $5
        )
        RETURNING id`,
        [
          pagamentoHub.cardId,
          formaPagamentoRes.rows[0].id,
          valorPago,
          `Pagamento Online - ${pagamentoHub.paymentMethod || 'N/A'} - Tx: ${transactionId}`,
          pagamentoHub.usuarioId,
        ]
      );

      const pagamentoCardId = pagamentoCardRes.rows[0].id as string;

      await query(
        `UPDATE "PagamentoHub"
         SET "pagamentoCardId" = $2, "updatedAt" = NOW()
         WHERE "transactionId" = $1`,
        [transactionId, pagamentoCardId]
      );

      const cardAgg = await query(
        `SELECT c."valorTotal", COALESCE(SUM(p.valor), 0) as "totalPago"
         FROM "CardCliente" c
         LEFT JOIN "PagamentoCard" p ON p."cardId" = c.id
         WHERE c.id = $1
         GROUP BY c.id`,
        [pagamentoHub.cardId]
      );
      const valorTotal = parseFloat(cardAgg.rows[0].valorTotal);
      const totalPago = parseFloat(cardAgg.rows[0].totalPago);

      if (totalPago >= valorTotal) {
        await query(
          `UPDATE "CardCliente"
           SET status = 'FECHADO',
               "fechadoAt" = NOW(),
               "fechadoBy" = $1,
               "updatedAt" = NOW()
           WHERE id = $2`,
          [pagamentoHub.usuarioId, pagamentoHub.cardId]
        );
      } else {
        await query(
          `UPDATE "CardCliente"
           SET "updatedAt" = NOW()
           WHERE id = $1`,
          [pagamentoHub.cardId]
        );
      }
    }

    const response = NextResponse.json({ success: true });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar callback do Hub', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

