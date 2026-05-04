import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';

type JsonRecord = Record<string, any>;

function safeJsonParse(rawBody: string): { payload: JsonRecord; parseError: string | null } {
  try {
    return {
      payload: JSON.parse(rawBody),
      parseError: null,
    };
  } catch (error: any) {
    return {
      payload: { rawBody },
      parseError: error?.message || 'Falha ao converter body para JSON',
    };
  }
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizarTelefone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const texto = String(value).trim();
  if (!texto) {
    return null;
  }

  const jidSemSufixo = texto.replace(/@.+$/, '');
  const somenteNumeros = jidSemSufixo.replace(/\D/g, '');
  return somenteNumeros || null;
}

function extrairEvento(payload: JsonRecord): string {
  const evento = firstDefined(
    payload.event,
    payload.eventType,
    payload.type,
    payload.name,
    payload.data?.event,
    payload.data?.type
  );

  if (typeof evento === 'string' && evento.trim()) {
    return evento.trim();
  }

  return 'unknown';
}

function extrairInstancia(payload: JsonRecord): string | null {
  const instancia = firstDefined(
    payload.public_instance_id,
    payload.publicInstanceId,
    payload.instanceId,
    payload.instance?.public_instance_id,
    payload.instance?.publicInstanceId,
    payload.instance?.id,
    payload.data?.public_instance_id,
    payload.data?.publicInstanceId,
    payload.data?.instanceId
  );

  return typeof instancia === 'string' && instancia.trim() ? instancia.trim() : null;
}

function extrairMensagem(payload: JsonRecord): JsonRecord | null {
  const candidates = [
    payload.message,
    payload.messages?.[0],
    payload.data?.message,
    payload.data?.messages?.[0],
    payload.data,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as JsonRecord;
    }
  }

  return null;
}

function extrairDirection(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const direction = firstDefined(
    payload.direction,
    payload.data?.direction,
    mensagem?.direction
  );

  if (typeof direction === 'string' && direction.trim()) {
    return direction.trim().toUpperCase();
  }

  const fromMe = firstDefined(
    payload.fromMe,
    payload.data?.fromMe,
    mensagem?.fromMe,
    mensagem?.key?.fromMe
  );

  if (typeof fromMe === 'boolean') {
    return fromMe ? 'OUTBOUND' : 'INBOUND';
  }

  return null;
}

function extrairTelefone(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  return normalizarTelefone(
    firstDefined(
      mensagem?.phone,
      mensagem?.from,
      mensagem?.to,
      mensagem?.remoteJid,
      mensagem?.key?.remoteJid,
      payload.phone,
      payload.from,
      payload.to,
      payload.remoteJid,
      payload.data?.phone,
      payload.data?.from,
      payload.data?.to
    )
  );
}

function extrairMessageId(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const messageId = firstDefined(
    mensagem?.messageId,
    mensagem?.id,
    mensagem?.key?.id,
    payload.messageId,
    payload.data?.messageId
  );

  return typeof messageId === 'string' && messageId.trim() ? messageId.trim() : null;
}

function extrairTextoMensagem(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const texto = firstDefined(
    mensagem?.message?.conversation,
    mensagem?.message?.extendedTextMessage?.text,
    mensagem?.message?.imageMessage?.caption,
    mensagem?.text,
    mensagem?.body,
    payload.message,
    payload.data?.message
  );

  return typeof texto === 'string' && texto.trim() ? texto.trim() : null;
}

function obterHeadersSeguros(request: NextRequest) {
  return {
    'content-type': request.headers.get('content-type'),
    'user-agent': request.headers.get('user-agent'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'x-real-ip': request.headers.get('x-real-ip'),
    'x-gzappy-event': request.headers.get('x-gzappy-event'),
  };
}

function validarToken(request: NextRequest): boolean {
  const expectedToken = process.env.GZAPPY_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }

  const providedToken = firstDefined(
    request.nextUrl.searchParams.get('token') || undefined,
    request.headers.get('x-gzappy-webhook-token') || undefined,
    request.headers.get('x-webhook-token') || undefined
  );

  return providedToken === expectedToken;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mensagem: 'Webhook da Gzappy ativo',
  });
}

export async function POST(request: NextRequest) {
  if (!validarToken(request)) {
    return NextResponse.json(
      { ok: false, mensagem: 'Token do webhook inválido' },
      { status: 401 }
    );
  }

  try {
    const rawBody = await request.text();
    const { payload, parseError } = safeJsonParse(rawBody);
    const evento = extrairEvento(payload);
    const mensagem = extrairMensagem(payload);
    const publicInstanceId = extrairInstancia(payload);
    const direction = extrairDirection(payload, mensagem);
    const phone = extrairTelefone(payload, mensagem);
    const messageId = extrairMessageId(payload, mensagem);
    const messageText = extrairTextoMensagem(payload, mensagem);
    const headers = obterHeadersSeguros(request);
    const processingNotes = parseError
      ? `Falha ao converter body para JSON: ${parseError}`
      : 'Payload armazenado para analise';

    await query(
      `INSERT INTO "GzappyWebhookEvento" (
        "publicInstanceId",
        "eventType",
        "messageId",
        "direction",
        phone,
        "messageText",
        payload,
        headers,
        "processingStatus",
        "processingNotes"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
      [
        publicInstanceId,
        evento,
        messageId,
        direction,
        phone,
        messageText,
        JSON.stringify(payload),
        JSON.stringify(headers),
        'RECEBIDO',
        processingNotes,
      ]
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[GZAPPY WEBHOOK] Evento recebido', {
        evento,
        publicInstanceId,
        direction,
        phone,
        messageId,
        hasMessageText: !!messageText,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Evento recebido com sucesso',
    });
  } catch (error: any) {
    console.error('[GZAPPY WEBHOOK] Erro ao processar evento:', error);
    return NextResponse.json(
      {
        ok: false,
        mensagem: 'Erro ao processar webhook da Gzappy',
        error: error?.message,
      },
      { status: 500 }
    );
  }
}
