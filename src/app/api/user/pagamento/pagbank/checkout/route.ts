import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

export async function POST(request: NextRequest) {
  try {
    const deprecatedResponse = NextResponse.json(
      {
        mensagem: 'Endpoint descontinuado. Use /api/user/pagamento/online/checkout (Hub Pagamentos BT).',
      },
      { status: 410 }
    );
    return withCors(deprecatedResponse, request);

    const authResult = await requireAuth(request);
    if (!('user' in authResult)) {
      return withCors(authResult as NextResponse, request);
    }

    const { user } = authResult;
    const body = await request.json();
    const { cardId, valor, orderId, descricao, parcelas, cpf } = body;

    if (!cardId || !valor || !orderId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'cardId, valor e orderId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
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
        { mensagem: 'CPF é obrigatório para processar o pagamento. Por favor, informe seu CPF.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    let pagBankToken: string | null = null;
    let pagBankEnv: string | null = null;
    let pagBankWebhookToken: string | null = null;
    let pagBankAtivo: boolean | null = null;

    try {
      const pointCfg = await query(
        `SELECT "pagBankToken", "pagBankEnv", "pagBankWebhookToken", "pagBankAtivo"
         FROM "Point"
         WHERE id = $1
         LIMIT 1`,
        [card.pointId]
      );

      if (pointCfg.rows.length > 0) {
        pagBankToken = pointCfg.rows[0].pagBankToken || null;
        pagBankEnv = pointCfg.rows[0].pagBankEnv || null;
        pagBankWebhookToken = pointCfg.rows[0].pagBankWebhookToken || null;
        pagBankAtivo = pointCfg.rows[0].pagBankAtivo ?? null;
      }
    } catch (e: any) {
      if (e?.code !== '42703') {
        throw e;
      }
    }

    const token = pagBankToken || process.env.PAGBANK_TOKEN || null;
    if (!token) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PagBank não configurado para esta arena (token ausente)' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (pagBankAtivo === false) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PagBank não está ativo para esta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appatleta.playnaquadra.com.br';
    const redirectUrl = `${appUrl}/app/atleta/consumo?pagbank_callback=${encodeURIComponent(orderId)}`;

    const backendBaseUrl =
      process.env.BACKEND_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://carlaobtonline.vercel.app');

    const webhookToken = pagBankWebhookToken || process.env.PAGBANK_WEBHOOK_TOKEN || '';
    const webhookUrl = webhookToken
      ? `${backendBaseUrl}/api/user/pagamento/pagbank/callback?token=${encodeURIComponent(webhookToken)}`
      : `${backendBaseUrl}/api/user/pagamento/pagbank/callback`;

    await query(
      `INSERT INTO "PagamentoPagBank" (
        id, "cardId", "referenceId", status, valor, parcelas, cpf, "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, 'PENDING', $3, $4, $5, NOW(), NOW(), $6
      )
      ON CONFLICT ("referenceId") DO UPDATE SET
        "cardId" = EXCLUDED."cardId",
        valor = EXCLUDED.valor,
        parcelas = EXCLUDED.parcelas,
        cpf = EXCLUDED.cpf,
        "updatedAt" = NOW(),
        "createdBy" = EXCLUDED."createdBy"`,
      [cardId, orderId, valor, parcelas || 1, cpfLimpo, user.id]
    );

    const env = ((pagBankEnv || process.env.PAGBANK_ENV || 'sandbox') as string).toLowerCase();
    const baseUrl = env === 'prod' || env === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';

    const unitAmount = Math.round(Number(valor) * 100);
    const maxParcelas = Math.min(12, Math.max(1, Number(parcelas || 1)));

    const payload: any = {
      reference_id: orderId,
      items: [
        {
          name: descricao || `Pagamento Card #${card.numeroCard || ''}`,
          quantity: 1,
          unit_amount: unitAmount,
        },
      ],
      redirect_url: redirectUrl,
      return_url: redirectUrl,
      notification_urls: [webhookUrl],
      payment_notification_urls: [webhookUrl],
      customer_modifiable: true,
      payment_methods: [
        { type: 'CREDIT_CARD' },
        { type: 'PIX' },
        { type: 'TICKET' },
        { type: 'PAGBANK' },
      ],
      payment_methods_configs: [
        {
          type: 'CREDIT_CARD',
          config_options: [{ option: 'INSTALLMENTS_LIMIT', value: String(maxParcelas) }],
        },
      ],
      customer: {
        name: atleta.nome || user.nome || 'Cliente',
        email: user.email || undefined,
        tax_id: cpfLimpo,
      },
    };

    const pagbankResponse = await fetch(`${baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!pagbankResponse.ok) {
      const errorText = await pagbankResponse.text();
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro ao gerar checkout PagBank', error: process.env.NODE_ENV === 'development' ? errorText : undefined },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const data = await pagbankResponse.json();
    const payLink = Array.isArray(data?.links) ? data.links.find((l: any) => l?.rel === 'PAY') : null;
    const checkoutUrl = payLink?.href;
    const checkoutId = data?.id || null;
    const status = data?.status || 'PENDING';

    await query(
      `UPDATE "PagamentoPagBank"
       SET "checkoutId" = $1,
           status = $2,
           payload = $3,
           "updatedAt" = NOW()
       WHERE "referenceId" = $4`,
      [checkoutId, status, JSON.stringify(data), orderId]
    );

    const response = NextResponse.json({
      success: true,
      checkoutUrl,
      orderId,
      checkoutId,
    });

    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar checkout PagBank', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
