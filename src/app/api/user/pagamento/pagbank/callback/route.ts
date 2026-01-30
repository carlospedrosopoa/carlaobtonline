import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

const mapFormaPagamento = (paymentMethodType: string | null | undefined) => {
  const tipo = (paymentMethodType || '').toUpperCase();
  if (tipo === 'PIX') return { nome: 'PagBank (Pix)', tipo: 'PIX' as const };
  if (tipo === 'CREDIT_CARD') return { nome: 'PagBank (Cartão)', tipo: 'CARTAO_CREDITO' as const };
  if (tipo === 'DEBIT_CARD') return { nome: 'PagBank (Débito)', tipo: 'CARTAO_DEBITO' as const };
  if (tipo === 'TICKET' || tipo === 'BOLETO') return { nome: 'PagBank (Boleto)', tipo: 'OUTRO' as const };
  if (tipo === 'PAGBANK') return { nome: 'PagBank', tipo: 'OUTRO' as const };
  return { nome: 'PagBank', tipo: 'OUTRO' as const };
};

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';

    const body = await request.json();
    const referenceId = body?.reference_id;

    if (!referenceId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'reference_id é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    let expectedToken: string | null = null;
    try {
      const cfgRes = await query(
        `SELECT COALESCE(pt."pagBankWebhookToken", '') as token
         FROM "PagamentoPagBank" p
         INNER JOIN "CardCliente" c ON p."cardId" = c.id
         INNER JOIN "Point" pt ON c."pointId" = pt.id
         WHERE p."referenceId" = $1
         LIMIT 1`,
        [referenceId]
      );

      if (cfgRes.rows.length > 0) {
        expectedToken = cfgRes.rows[0].token || null;
      }
    } catch (e: any) {
      if (e?.code !== '42703') {
        throw e;
      }
    }

    expectedToken = expectedToken || process.env.PAGBANK_WEBHOOK_TOKEN || null;
    if (expectedToken && token !== expectedToken) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autorizado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const isCheckoutNotification = typeof body?.id === 'string' && body.id.startsWith('CHEC_');
    const checkoutId = isCheckoutNotification ? body.id : null;
    const checkoutStatus = body?.status;

    const charge = Array.isArray(body?.charges) && body.charges.length > 0 ? body.charges[0] : null;
    const chargeId = charge?.id || null;
    const chargeStatus = charge?.status || null;
    const paymentMethodType = charge?.payment_method?.type || null;

    const pagamentoResult = await query(
      `SELECT p.*, c."usuarioId", c."valorTotal", c."pointId",
              COALESCE(SUM(p2.valor), 0) as "totalPago"
       FROM "PagamentoPagBank" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       LEFT JOIN "PagamentoCard" p2 ON p2."cardId" = c.id
         AND (p2."pagBankReferenceId" IS NULL OR p2."pagBankReferenceId" != p."referenceId")
       WHERE p."referenceId" = $1
       GROUP BY p.id, c.id`,
      [referenceId]
    );

    if (pagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];

    const novoStatus = chargeStatus || checkoutStatus || pagamento.status;
    await query(
      `UPDATE "PagamentoPagBank"
       SET status = $1,
           "checkoutId" = COALESCE($2, "checkoutId"),
           "chargeId" = COALESCE($3, "chargeId"),
           "paymentMethod" = COALESCE($4, "paymentMethod"),
           payload = $5,
           "updatedAt" = NOW()
       WHERE "referenceId" = $6`,
      [novoStatus, checkoutId, chargeId, paymentMethodType, JSON.stringify(body), referenceId]
    );

    if (chargeStatus === 'PAID') {
      const jaExiste = await query(
        `SELECT id FROM "PagamentoCard"
         WHERE "pagBankChargeId" = $1 OR "pagBankReferenceId" = $2
         LIMIT 1`,
        [chargeId, referenceId]
      );

      if (jaExiste.rows.length === 0) {
        const valorCentavos =
          charge?.amount?.summary?.paid ??
          charge?.amount?.value ??
          null;
        const valorPago = valorCentavos != null ? Number(valorCentavos) / 100 : null;

        if (valorPago != null && valorPago > 0) {
          const { nome: nomeForma, tipo: tipoForma } = mapFormaPagamento(paymentMethodType);

          let formaPagamentoRes = await query(
            'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2 LIMIT 1',
            [pagamento.pointId, nomeForma]
          );

          if (formaPagamentoRes.rows.length === 0) {
            formaPagamentoRes = await query(
              `INSERT INTO "FormaPagamento" (
                id, "pointId", nome, descricao, tipo, ativo, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid()::text, $1, $2, NULL, $3, true, NOW(), NOW()
              )
              RETURNING id`,
              [pagamento.pointId, nomeForma, tipoForma]
            );
          }

          await query(
            `INSERT INTO "PagamentoCard" (
              id, "cardId", "formaPagamentoId", valor, observacoes,
              "pagBankReferenceId", "pagBankCheckoutId", "pagBankChargeId", "pagBankPaymentMethod",
              "createdAt", "createdBy"
            ) VALUES (
              gen_random_uuid()::text, $1, $2, $3, $4,
              $5, $6, $7, $8,
              NOW(), $9
            )`,
            [
              pagamento.cardId,
              formaPagamentoRes.rows[0].id,
              valorPago,
              `Pagamento via PagBank - ${paymentMethodType || 'N/A'} - Ref: ${referenceId}`,
              referenceId,
              pagamento.checkoutId || checkoutId,
              chargeId,
              paymentMethodType,
              pagamento.usuarioId,
            ]
          );

          const totalPagoAtual = parseFloat(pagamento.totalPago) + valorPago;
          const valorTotal = parseFloat(pagamento.valorTotal);

          if (totalPagoAtual >= valorTotal) {
            await query(
              `UPDATE "CardCliente"
               SET status = 'FECHADO',
                   "fechadoAt" = NOW(),
                   "fechadoBy" = $1,
                   "updatedAt" = NOW()
               WHERE id = $2`,
              [pagamento.usuarioId, pagamento.cardId]
            );
          } else {
            await query(
              `UPDATE "CardCliente"
               SET "updatedAt" = NOW()
               WHERE id = $1`,
              [pagamento.cardId]
            );
          }
        }
      }
    }

    const response = NextResponse.json({ success: true });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar callback PagBank', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
