import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';
import { hubCreatePayment, type HubPaymentMethod } from '@/lib/hubPaymentsClient';

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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const body = await request.json();

    const clientApp =
      request.headers.get('x-client_app') ||
      request.headers.get('x-client-app') ||
      'UNKNOWN';

    const cardId = body?.cardId as string | undefined;
    const paymentMethodRaw = body?.paymentMethod as string | undefined;
    const orderId = (body?.orderId as string | undefined) || `PNQ-${crypto.randomUUID()}`;
    const descricao = body?.descricao as string | undefined;
    const cpf = body?.cpf as string | undefined;
    const cardEncrypted = body?.cardEncrypted as string | undefined;

    if (!cardId || !paymentMethodRaw) {
      const errorResponse = NextResponse.json(
        { mensagem: 'cardId e paymentMethod são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const paymentMethod = String(paymentMethodRaw).trim().toUpperCase() as HubPaymentMethod;
    if (paymentMethod !== 'PIX' && paymentMethod !== 'CREDIT_CARD') {
      const errorResponse = NextResponse.json(
        { mensagem: 'paymentMethod deve ser PIX ou CREDIT_CARD' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (paymentMethod === 'CREDIT_CARD' && (!cardEncrypted || cardEncrypted.trim().length === 0)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'cardEncrypted é obrigatório para paymentMethod=CREDIT_CARD' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const cardCheck = await query(
      `SELECT c.id, c."usuarioId", c.status, c."valorTotal", c."numeroCard", c."pointId",
              COALESCE(SUM(p.valor), 0) as "totalPago"
       FROM "CardCliente" c
       LEFT JOIN "PagamentoCard" p ON p."cardId" = c.id
       WHERE c.id = $1
       GROUP BY c.id, c."numeroCard", c."pointId"`,
      [cardId]
    );

    if (cardCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = cardCheck.rows[0];

    if (card.usuarioId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para pagar este card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    if (card.status !== 'ABERTO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Este card não está aberto para pagamento' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const totalPago = parseFloat(card.totalPago) || 0;
    const saldo = parseFloat(card.valorTotal) - totalPago;
    const valor =
      body?.valor === undefined || body?.valor === null || body?.valor === ''
        ? saldo
        : Number(body.valor);

    if (!Number.isFinite(valor) || valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (valor > saldo) {
      const errorResponse = NextResponse.json(
        { mensagem: `Valor excede o saldo pendente de ${saldo.toFixed(2)}` },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const cpfLimpo = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      const errorResponse = NextResponse.json(
        { mensagem: 'CPF é obrigatório e deve ter 11 dígitos' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    let pagamentoOnlineAtivo: boolean = false;
    try {
      const pointCfg = await query(
        `SELECT "pagamentoOnlineAtivo"
         FROM "Point"
         WHERE id = $1
         LIMIT 1`,
        [card.pointId]
      );
      pagamentoOnlineAtivo = pointCfg.rows[0]?.pagamentoOnlineAtivo === true;
    } catch (e: any) {
      if (e?.code !== '42703') {
        throw e;
      }
      pagamentoOnlineAtivo = false;
    }

    if (!pagamentoOnlineAtivo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento online não está ativo para esta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const amount = Math.round(valor * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor inválido' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const hubRes = await hubCreatePayment({
      project_name: 'PLAY_NA_QUADRA',
      order_id: orderId,
      amount,
      customer_email: user.email,
      customer_name: user.name || atleta.nome || undefined,
      customer_tax_id: cpfLimpo || undefined,
      payment_method: paymentMethod,
      card_encrypted: paymentMethod === 'CREDIT_CARD' ? cardEncrypted : undefined,
      metadata: {
        cardId,
        pointId: card.pointId,
        usuarioId: user.id,
        clientApp,
        descricao: descricao || null,
      },
    });

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
        )
        ON CONFLICT ("transactionId") DO UPDATE SET
          "status" = EXCLUDED."status",
          "pagbankOrderId" = COALESCE(EXCLUDED."pagbankOrderId", "PagamentoHub"."pagbankOrderId"),
          "updatedAt" = NOW()`,
        [
          hubRes.transaction_id,
          'PLAY_NA_QUADRA',
          orderId,
          paymentMethod,
          hubRes.status || 'PENDING',
          amount,
          valor,
          hubRes.pagbank_order_id || null,
          cardId,
          card.pointId,
          user.id,
          JSON.stringify({ hubResponse: hubRes, clientApp }),
        ]
      );
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensurePagamentoHubTable();
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
          )
          ON CONFLICT ("transactionId") DO UPDATE SET
            "status" = EXCLUDED."status",
            "pagbankOrderId" = COALESCE(EXCLUDED."pagbankOrderId", "PagamentoHub"."pagbankOrderId"),
            "updatedAt" = NOW()`,
          [
            hubRes.transaction_id,
            'PLAY_NA_QUADRA',
            orderId,
            paymentMethod,
            hubRes.status || 'PENDING',
            amount,
            valor,
            hubRes.pagbank_order_id || null,
            cardId,
            card.pointId,
            user.id,
            JSON.stringify({ hubResponse: hubRes, clientApp }),
          ]
        );
      } else {
        throw e;
      }
    }

    const response = NextResponse.json({
      transactionId: hubRes.transaction_id,
      orderId,
      pagbankOrderId: hubRes.pagbank_order_id || null,
      status: hubRes.status,
      qrCode: hubRes.qr_code || null,
      links: hubRes.links || null,
    });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar pagamento online', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
