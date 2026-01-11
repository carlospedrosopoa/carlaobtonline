// app/api/user/pagamento/infinite-pay/callback/route.ts - Callback do Infinite Pay
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { enviarMensagemWhatsApp, formatarNumeroWhatsApp } from '@/lib/whatsappService';

// POST /api/user/pagamento/infinite-pay/callback - Webhook do Infinite Pay
// Esta rota será chamada pelo Infinite Pay quando o pagamento for aprovado
// IMPORTANTE: Esta rota deve ser pública (sem autenticação) para o Infinite Pay poder chamar
// Conforme documentação: responder com 200 OK para sucesso, 400 para erro
export async function POST(request: NextRequest) {
  try {
    console.log('[INFINITE PAY WEBHOOK] Recebendo webhook...');
    console.log('[INFINITE PAY WEBHOOK] URL:', request.url);
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
      `SELECT p.*, c."usuarioId", c."valorTotal", c.id as "cardId", c."pointId"
       FROM "PagamentoInfinitePay" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       WHERE p."orderId" = $1`,
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

    // Buscar total pago do card (excluindo este pagamento se já existir)
    const totalPagoResult = await query(
      `SELECT COALESCE(SUM(valor), 0) as "totalPago"
       FROM "PagamentoCard"
       WHERE "cardId" = $1
         AND ("infinitePayOrderId" IS NULL OR "infinitePayOrderId" != $2)`,
      [pagamento.cardId, order_nsu]
    );
    
    const totalPago = parseFloat(totalPagoResult.rows[0].totalPago || '0');

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
        console.log('[INFINITE PAY WEBHOOK] Criando pagamento no card para order_nsu:', order_nsu);
        
        // Buscar forma de pagamento Infinite Pay ou criar uma padrão
        let formaPagamentoId = await query(
          'SELECT id FROM "FormaPagamento" WHERE nome ILIKE $1 LIMIT 1',
          ['%infinite pay%']
        );

        if (formaPagamentoId.rows.length === 0) {
          console.log('[INFINITE PAY WEBHOOK] Criando forma de pagamento Infinite Pay');
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
        // paid_amount está em centavos, converter para reais
        const valorPago = (paid_amount || amount) / 100;
        console.log('[INFINITE PAY WEBHOOK] Valor pago:', valorPago, 'CardId:', pagamento.cardId);
        
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
            `Pagamento via Infinite Pay - ${capture_method || 'N/A'} - Order: ${order_nsu}${receipt_url ? ` - Comprovante: ${receipt_url}` : ''}`,
            order_nsu,
            transaction_nsu || null,
            pagamento.usuarioId,
          ]
        );

        console.log('[INFINITE PAY WEBHOOK] Pagamento criado no card com ID:', pagamentoCard.rows[0].id);

        // Verificar se o card deve ser fechado
        const novoTotalPago = totalPago + valorPago;
        const valorTotal = parseFloat(pagamento.valorTotal);
        console.log('[INFINITE PAY WEBHOOK] Total pago:', novoTotalPago, 'Valor total:', valorTotal);

        if (novoTotalPago >= valorTotal) {
          console.log('[INFINITE PAY WEBHOOK] Fechando card', pagamento.cardId);
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
          console.log('[INFINITE PAY WEBHOOK] Card fechado com sucesso');
        }

        // Enviar WhatsApp para a arena informando o pagamento
        try {
          if (pagamento.pointId) {
            // Buscar telefone da arena
            const pointResult = await query(
              `SELECT telefone, nome FROM "Point" WHERE id = $1`,
              [pagamento.pointId]
            );

            if (pointResult.rows.length > 0 && pointResult.rows[0].telefone) {
              const telefoneArena = pointResult.rows[0].telefone;
              const nomeArena = pointResult.rows[0].nome || 'Arena';
              
              // Formatar valor do pagamento
              const valorFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(valorPago);

              const mensagem = `💰 *Pagamento Online Recebido*

Valor: ${valorFormatado}
Método: Infinite Pay${capture_method ? ` (${capture_method})` : ''}
Order ID: ${order_nsu}${transaction_nsu ? `\nTransaction ID: ${transaction_nsu}` : ''}

Pagamento recebido com sucesso! ✅`;

              const enviado = await enviarMensagemWhatsApp(
                {
                  destinatario: formatarNumeroWhatsApp(telefoneArena),
                  mensagem,
                  tipo: 'texto',
                },
                pagamento.pointId
              );

              if (enviado) {
                console.log('[INFINITE PAY WEBHOOK] WhatsApp enviado para a arena:', telefoneArena);
              } else {
                console.warn('[INFINITE PAY WEBHOOK] Falha ao enviar WhatsApp para a arena:', telefoneArena);
              }
            } else {
              console.log('[INFINITE PAY WEBHOOK] Arena não possui telefone cadastrado para envio de WhatsApp');
            }
          }
        } catch (error: any) {
          // Não bloquear o processamento do pagamento se houver erro no WhatsApp
          console.error('[INFINITE PAY WEBHOOK] Erro ao enviar WhatsApp para a arena:', error);
        }
      } else {
        console.log('[INFINITE PAY WEBHOOK] Pagamento já existe no card para order_nsu:', order_nsu);
      }
    }

    // Responder com 200 OK conforme documentação do Infinite Pay
    // Importante: responder rapidamente (menos de 1 segundo)
    console.log('[INFINITE PAY WEBHOOK] Pagamento processado com sucesso para order_nsu:', order_nsu);
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

