// app/api/whatsapp/webhook/route.ts - Webhook para receber mensagens e status do WhatsApp
// TODO: Temporariamente desabilitado - migrando para Gzappy
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_VERIFY_TOKEN = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'meu_token_secreto_123';
const APP_SECRET = process.env.META_WHATSAPP_APP_SECRET;

/**
 * GET /api/whatsapp/webhook
 * Verificação do webhook pelo Meta (requerido na configuração)
 * 
 * Query params:
 * - hub.mode: deve ser "subscribe"
 * - hub.verify_token: token de verificação
 * - hub.challenge: código de desafio do Meta
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Verificar se é uma requisição de verificação do Meta
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado com sucesso');
      return new NextResponse(challenge, { status: 200 });
    }

    // Se não for verificação válida, retornar erro
    console.warn('⚠️ Tentativa de verificação de webhook inválida:', {
      mode,
      token: token ? 'fornecido' : 'não fornecido',
    });

    return NextResponse.json(
      { mensagem: 'Token de verificação inválido' },
      { status: 403 }
    );
  } catch (error: any) {
    console.error('Erro ao verificar webhook:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao processar verificação' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/webhook
 * Recebe mensagens e status de entrega do WhatsApp
 * 
 * Body: JSON do Meta com eventos do WhatsApp
 */
export async function POST(request: NextRequest) {
  // TODO: Temporariamente desabilitado - migrando para Gzappy
  return NextResponse.json(
    { mensagem: 'Webhook temporariamente desabilitado. Migrando para Gzappy.' },
    { status: 503 }
  );
  
  /* Código original comentado - será removido após migração para Gzappy
  try {
    let data: any;
    
    // Verificar assinatura do webhook (se APP_SECRET estiver configurado)
    if (APP_SECRET) {
      const signature = request.headers.get('x-hub-signature-256');
      if (!signature) {
        console.warn('⚠️ Webhook sem assinatura');
        return NextResponse.json(
          { mensagem: 'Assinatura não fornecida' },
          { status: 403 }
        );
      }

      const body = await request.text();
      const expectedSignature = crypto
        .createHmac('sha256', APP_SECRET)
        .update(body)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      if (expectedSignature !== providedSignature) {
        console.warn('⚠️ Assinatura do webhook inválida');
        return NextResponse.json(
          { mensagem: 'Assinatura inválida' },
          { status: 403 }
        );
      }

      // Parse do body após verificação
      data = JSON.parse(body);
    } else {
      // Se não tiver APP_SECRET configurado, apenas parse do body
      const bodyText = await request.text();
      data = JSON.parse(bodyText);
    }

    // Processar eventos do webhook
    if (data.object === 'whatsapp_business_account') {
      const entries = data.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          const value = change.value;

          // Processar mensagens recebidas
          if (value.messages) {
            for (const message of value.messages) {
              await processarMensagemRecebida(message);
            }
          }

          // Processar status de mensagens
          if (value.statuses) {
            for (const status of value.statuses) {
              await processarStatusMensagem(status);
            }
          }
        }
      }
    }

    // Sempre retornar 200 para o Meta
    return NextResponse.json({ sucesso: true }, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    // Retornar 200 mesmo em caso de erro para não bloquear o webhook
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 200 });
  }
  */
}

