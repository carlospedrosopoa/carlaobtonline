import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query, transaction } from '@/lib/db';
import { hubGetPaymentStatus } from '@/lib/hubPaymentsClient';

function mapFormaPagamento(paymentMethod: string | null | undefined) {
  const tipo = (paymentMethod || '').toUpperCase();
  if (tipo === 'PIX') return { nome: 'Pagamento Online (Pix)', tipo: 'PIX' as const };
  if (tipo === 'CREDIT_CARD') return { nome: 'Pagamento Online (Cartão)', tipo: 'CARTAO_CREDITO' as const };
  return { nome: 'Pagamento Online', tipo: 'OUTRO' as const };
}

async function ensurePagamentoHubTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS "PagamentoHub" (
      "transactionId" TEXT PRIMARY KEY,
      "projectName" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "amount" INTEGER NOT NULL,
      "valor" NUMERIC(12,2) NOT NULL,
      "pagbankOrderId" TEXT NULL,
      "cardId" TEXT NOT NULL,
      "pointId" TEXT NOT NULL,
      "usuarioId" TEXT NOT NULL,
      "pagamentoCardId" TEXT NULL,
      "metadata" JSONB NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PagamentoHub_project_order_uk"
     ON "PagamentoHub" ("projectName", "orderId")`
  );
  await query(`CREATE INDEX IF NOT EXISTS "PagamentoHub_card_idx" ON "PagamentoHub" ("cardId")`);
  await query(`CREATE INDEX IF NOT EXISTS "PagamentoHub_point_idx" ON "PagamentoHub" ("pointId")`);
  await query(`CREATE INDEX IF NOT EXISTS "PagamentoHub_usuario_idx" ON "PagamentoHub" ("usuarioId")`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { transactionId } = await params;

    let result;
    try {
      result = await query(
        `SELECT h."transactionId", h.status, h."paymentMethod", h.valor, h."cardId", h."pointId",
                h."usuarioId", h."pagamentoCardId", h."pagbankOrderId"
         FROM "PagamentoHub" h
         INNER JOIN "CardCliente" c ON h."cardId" = c.id
         WHERE h."transactionId" = $1 AND c."usuarioId" = $2
         LIMIT 1`,
        [transactionId, user.id]
      );
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensurePagamentoHubTable();
        result = await query(
          `SELECT h."transactionId", h.status, h."paymentMethod", h.valor, h."cardId", h."pointId",
                  h."usuarioId", h."pagamentoCardId", h."pagbankOrderId"
           FROM "PagamentoHub" h
           INNER JOIN "CardCliente" c ON h."cardId" = c.id
           WHERE h."transactionId" = $1 AND c."usuarioId" = $2
           LIMIT 1`,
          [transactionId, user.id]
        );
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Transação não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0] as {
      transactionId: string;
      status: string;
      paymentMethod: string;
      valor: string | number;
      cardId: string;
      pointId: string;
      usuarioId: string;
      pagamentoCardId: string | null;
      pagbankOrderId: string | null;
    };

    let status = String(row.status || 'PENDING').toUpperCase();

    if (status !== 'PAID') {
      try {
        const hubStatusRes = await hubGetPaymentStatus(transactionId);
        const hubStatus = String(hubStatusRes?.status || '').toUpperCase();
        if (hubStatus && hubStatus !== status) {
          try {
            await query(
              `UPDATE "PagamentoHub"
               SET status = $2,
                   "pagbankOrderId" = COALESCE($3, "pagbankOrderId"),
                   "updatedAt" = NOW()
               WHERE "transactionId" = $1`,
              [transactionId, hubStatus, hubStatusRes.pagbank_order_id || null]
            );
          } catch (e: any) {
            if (e?.code === '42P01') {
              await ensurePagamentoHubTable();
              await query(
                `UPDATE "PagamentoHub"
                 SET status = $2,
                     "pagbankOrderId" = COALESCE($3, "pagbankOrderId"),
                     "updatedAt" = NOW()
                 WHERE "transactionId" = $1`,
                [transactionId, hubStatus, hubStatusRes.pagbank_order_id || null]
              );
            } else {
              throw e;
            }
          }
          status = hubStatus;
          row.pagbankOrderId = hubStatusRes.pagbank_order_id || row.pagbankOrderId;
        }
      } catch {
      }
    }

    if (status === 'PAID' && !row.pagamentoCardId) {
      await transaction(async (client) => {
        let lockedRes;
        try {
          lockedRes = await client.query(
            `SELECT *
             FROM "PagamentoHub"
             WHERE "transactionId" = $1 AND "usuarioId" = $2
             FOR UPDATE`,
            [transactionId, user.id]
          );
        } catch (e: any) {
          if (e?.code === '42P01') {
            await ensurePagamentoHubTable();
            lockedRes = await client.query(
              `SELECT *
               FROM "PagamentoHub"
               WHERE "transactionId" = $1 AND "usuarioId" = $2
               FOR UPDATE`,
              [transactionId, user.id]
            );
          } else {
            throw e;
          }
        }
        const pagamentoHub = lockedRes.rows[0];
        if (!pagamentoHub) return;
        if (pagamentoHub.pagamentoCardId) return;

        const { nome: nomeForma, tipo: tipoForma } = mapFormaPagamento(pagamentoHub.paymentMethod);

        let formaPagamentoRes = await client.query(
          'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2 LIMIT 1',
          [pagamentoHub.pointId, nomeForma]
        );

        if (formaPagamentoRes.rows.length === 0) {
          formaPagamentoRes = await client.query(
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
        const pagamentoCardRes = await client.query(
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

        await client.query(
          `UPDATE "PagamentoHub"
           SET "pagamentoCardId" = $2, "updatedAt" = NOW()
           WHERE "transactionId" = $1`,
          [transactionId, pagamentoCardId]
        );

        const cardAgg = await client.query(
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
          await client.query(
            `UPDATE "CardCliente"
             SET status = 'FECHADO',
                 "fechadoAt" = NOW(),
                 "fechadoBy" = $1,
                 "updatedAt" = NOW()
             WHERE id = $2`,
            [pagamentoHub.usuarioId, pagamentoHub.cardId]
          );
        } else {
          await client.query(
            `UPDATE "CardCliente"
             SET "updatedAt" = NOW()
             WHERE id = $1`,
            [pagamentoHub.cardId]
          );
        }
      });
    }

    const response = NextResponse.json({ status });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao consultar status do pagamento', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
