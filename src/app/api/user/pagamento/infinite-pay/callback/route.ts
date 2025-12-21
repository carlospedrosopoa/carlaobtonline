// app/api/user/pagamento/infinite-pay/callback/route.ts - Callback do Infinite Pay
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

// POST /api/user/pagamento/infinite-pay/callback - Webhook do Infinite Pay
// Esta rota será chamada pelo Infinite Pay quando o pagamento for aprovado
// IMPORTANTE: Esta rota deve ser pública (sem autenticação) para o Infinite Pay poder chamar
// Conforme documentação: responder com 200 OK para sucesso, 400 para erro
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    console.log('[INFINITE PAY WEBHOOK] Recebendo webhook...');
    console.log('[INFINITE PAY WEBHOOK] URL:', request.url);
    console.log('[INFINITE PAY WEBHOOK] Origin:', origin);
    console.log('[INFINITE PAY WEBHOOK] Headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    console.log('[INFINITE PAY WEBHOOK] Dados recebidos:', JSON.stringify(body, null, 2));
    // Estrutura do webhook conforme documentação:
    // invoice_slug, amount, paid_amount, installments, capture_method, 
    // transaction_nsu, order_nsu, receipt_url, items
    const { 
      order_nsu, 
      transaction_nsu, 
      invoice_slug,
      amount,
      paid_amount,
      installments,
      capture_method,
      receipt_url
    } = body;

    if (!order_nsu) {
      console.error('[INFINITE PAY WEBHOOK] order_nsu não fornecido');
      // Responder com 400 conforme documentação (para que o Infinite Pay tente novamente)
      const errorResponse = NextResponse.json(
        { mensagem: 'order_nsu é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar pagamento pelo order_nsu (orderId)
    const pagamentoResult = await query(
      `SELECT p.*, c."usuarioId", c."valorTotal", c."pointId",
              COALESCE(SUM(p2.valor), 0) as "totalPago"
       FROM "PagamentoInfinitePay" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       LEFT JOIN "PagamentoCard" p2 ON p2."cardId" = c.id 
         AND (p2."infinitePayOrderId" IS NULL OR p2."infinitePayOrderId" != p."orderId")
       WHERE p."orderId" = $1
       GROUP BY p.id, c.id`,
      [order_nsu]
    );

    if (pagamentoResult.rows.length === 0) {
      console.error('[INFINITE PAY WEBHOOK] Pagamento não encontrado para order_nsu:', order_nsu);
      // Responder com 400 para que o Infinite Pay tente novamente
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];

    // Atualizar status do pagamento (webhook só é chamado quando aprovado)
    await query(
      `UPDATE "PagamentoInfinitePay"
       SET status = 'APPROVED',
           "transactionId" = $1,
           message = $2,
           "updatedAt" = NOW()
       WHERE "orderId" = $3`,
      [transaction_nsu || null, `Pagamento aprovado via ${capture_method || 'N/A'}`, order_nsu]
    );

    // Webhook só é chamado quando pagamento é aprovado
    if (true) {
      // Verificar se já existe pagamento criado
      const pagamentoExistente = await query(
        'SELECT id FROM "PagamentoCard" WHERE "infinitePayOrderId" = $1',
        [order_nsu]
      );

      if (pagamentoExistente.rows.length === 0) {
        // Buscar pointId do card para criar/buscar forma de pagamento
        const cardPointResult = await query(
          'SELECT "pointId" FROM "CardCliente" WHERE id = $1',
          [pagamento.cardId]
        );
        const pointId = cardPointResult.rows[0]?.pointId;

        if (!pointId) {
          console.error('[INFINITE PAY WEBHOOK] PointId não encontrado para o card:', pagamento.cardId);
          const errorResponse = NextResponse.json(
            { mensagem: 'Arena não encontrada para este card' },
            { status: 400 }
          );
          return withCors(errorResponse, request);
        }

        // Buscar forma de pagamento Infinite Pay para esta arena ou criar uma padrão
        let formaPagamentoId = await query(
          'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome ILIKE $2 LIMIT 1',
          [pointId, '%infinite pay%']
        );

        if (formaPagamentoId.rows.length === 0) {
          // Criar forma de pagamento se não existir para esta arena
          // Usar 'OUTRO' pois Infinite Pay pode processar PIX, cartão de crédito ou débito
          const novaForma = await query(
            `INSERT INTO "FormaPagamento" (id, "pointId", nome, tipo, ativo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, 'Infinite Pay', 'OUTRO', true, NOW(), NOW())
             RETURNING id`,
            [pointId]
          );
          formaPagamentoId = novaForma;
        }

        // Criar pagamento no card
        // paid_amount está em centavos, converter para reais
        const valorPago = (paid_amount || amount) / 100;
        
        // Montar observações detalhadas para identificar a operação
        const observacoes = [
          `Pagamento via Infinite Pay`,
          `Método: ${capture_method || 'N/A'}`,
          `Order NSU: ${order_nsu}`,
          transaction_nsu ? `Transaction NSU: ${transaction_nsu}` : '',
          invoice_slug ? `Invoice Slug: ${invoice_slug}` : '',
          installments && installments > 1 ? `Parcelado em ${installments}x` : 'À vista',
          receipt_url ? `Comprovante: ${receipt_url}` : '',
          `Valor pago: R$ ${valorPago.toFixed(2)}`,
          `Processado em: ${new Date().toLocaleString('pt-BR')}`,
        ].filter(Boolean).join(' | ');
        
        console.log('[INFINITE PAY WEBHOOK] Criando pagamento no card:', {
          cardId: pagamento.cardId,
          valor: valorPago,
          order_nsu,
          transaction_nsu,
        });
        
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
            valorPago,
            observacoes,
            order_nsu,
            transaction_nsu || null,
            pagamento.usuarioId,
          ]
        );
        
        console.log('[INFINITE PAY WEBHOOK] Pagamento criado no card com sucesso:', pagamentoCard.rows[0].id);

        // Verificar se o card deve ser fechado
        const totalPago = parseFloat(pagamento.totalPago) + valorPago;
        const valorTotal = parseFloat(pagamento.valorTotal);

        console.log('[INFINITE PAY WEBHOOK] Verificando fechamento do card:', {
          cardId: pagamento.cardId,
          totalPago,
          valorTotal,
          saldoPendente: valorTotal - totalPago,
          deveFechar: totalPago >= valorTotal,
        });

        if (totalPago >= valorTotal) {
          // Fechar o card automaticamente
          await query(
            `UPDATE "CardCliente"
             SET status = 'FECHADO',
                 "fechadoAt" = NOW(),
                 "fechadoBy" = $1,
                 "updatedAt" = NOW()
             WHERE id = $2`,
            [pagamento.usuarioId, pagamento.cardId]
          );
          console.log('[INFINITE PAY WEBHOOK] ✅ Card fechado automaticamente - saldo quitado');
        } else {
          const saldoPendente = valorTotal - totalPago;
          console.log('[INFINITE PAY WEBHOOK] ⚠️ Card mantido aberto - saldo pendente: R$', saldoPendente.toFixed(2));
        }
      }
    }

    // Responder com 200 OK conforme documentação do Infinite Pay
    // Importante: responder rapidamente (menos de 1 segundo)
    console.log('[INFINITE PAY WEBHOOK] Pagamento processado com sucesso para order_nsu:', order_nsu);
    const response = NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso',
    });

    // Para webhook, permitir qualquer origem (o Infinite Pay pode chamar de qualquer lugar)
    // Webhooks geralmente não têm origem (são chamadas server-to-server)
    const corsResponse = withCors(response, request);
    
    // Adicionar headers CORS permissivos para webhook
    // Se não tiver origem, permitir qualquer origem
    const webhookOrigin = origin || '*';
    corsResponse.headers.set('Access-Control-Allow-Origin', webhookOrigin);
    corsResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    corsResponse.headers.set('Access-Control-Allow-Credentials', 'false');
    
    return corsResponse;
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
// IMPORTANTE: Webhook precisa aceitar preflight de qualquer origem
// Webhooks são chamadas server-to-server, então podem não ter origem
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  
  // Para webhook, sempre permitir (pode ser chamado de qualquer lugar)
  const webhookOrigin = origin || '*';
  response.headers.set('Access-Control-Allow-Origin', webhookOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'false');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

