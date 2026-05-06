import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';

type JsonRecord = Record<string, any>;

type EventoExtraido = {
  eventType: string;
  publicInstanceId: string | null;
  instanceName: string | null;
  direction: string | null;
  phone: string | null;
  messageId: string | null;
  messageText: string | null;
  pushName: string | null;
  messageType: string | null;
  messageTimestamp: string | null;
};

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

function extrairNomeInstancia(payload: JsonRecord): string | null {
  const instanceName = firstDefined(
    payload.instance_name,
    payload.instanceName,
    payload.instance?.name,
    payload.data?.instance_name,
    payload.data?.instanceName
  );

  return typeof instanceName === 'string' && instanceName.trim() ? instanceName.trim() : null;
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
    payload.data?.key_from_me,
    mensagem?.fromMe,
    mensagem?.key?.fromMe,
    mensagem?.key_from_me
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
      mensagem?.remote_jid,
      mensagem?.remoteJid,
      mensagem?.key?.remoteJid,
      mensagem?.key?.remote_jid,
      payload.phone,
      payload.from,
      payload.to,
      payload.remoteJid,
      payload.remote_jid,
      payload.data?.phone,
      payload.data?.from,
      payload.data?.to,
      payload.data?.remote_jid
    )
  );
}

function extrairMessageId(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const messageId = firstDefined(
    mensagem?.messageId,
    mensagem?.id,
    mensagem?.key_id,
    mensagem?.key?.id,
    payload.messageId,
    payload.data?.messageId,
    payload.data?.key_id
  );

  return typeof messageId === 'string' && messageId.trim() ? messageId.trim() : null;
}

function extrairTextoMensagem(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const texto = firstDefined(
    mensagem?.message?.conversation,
    mensagem?.message?.extendedTextMessage?.text,
    mensagem?.message?.imageMessage?.caption,
    mensagem?.conversation,
    mensagem?.text,
    mensagem?.body,
    payload.message,
    payload.data?.message
  );

  return typeof texto === 'string' && texto.trim() ? texto.trim() : null;
}

function extrairPushName(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const pushName = firstDefined(
    mensagem?.push_name,
    mensagem?.pushName,
    payload.push_name,
    payload.pushName,
    payload.data?.push_name,
    payload.data?.pushName
  );

  return typeof pushName === 'string' && pushName.trim() ? pushName.trim() : null;
}

function extrairMessageType(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const messageType = firstDefined(
    mensagem?.message_type,
    mensagem?.messageType,
    payload.message_type,
    payload.messageType,
    payload.data?.message_type,
    payload.data?.messageType
  );

  return typeof messageType === 'string' && messageType.trim() ? messageType.trim() : null;
}

function extrairMessageTimestamp(payload: JsonRecord, mensagem: JsonRecord | null): string | null {
  const timestampValue = firstDefined(
    mensagem?.message_timestamp,
    mensagem?.messageTimestamp,
    payload.message_timestamp,
    payload.messageTimestamp,
    payload.data?.message_timestamp,
    payload.data?.messageTimestamp
  );

  if (typeof timestampValue === 'number' && Number.isFinite(timestampValue)) {
    return new Date(timestampValue * 1000).toISOString();
  }

  if (typeof timestampValue === 'string' && timestampValue.trim()) {
    const numericValue = Number(timestampValue);
    if (Number.isFinite(numericValue)) {
      return new Date(numericValue * 1000).toISOString();
    }
    return timestampValue.trim();
  }

  return null;
}

function extrairDadosEvento(payload: JsonRecord): EventoExtraido {
  const mensagem = extrairMensagem(payload);

  return {
    eventType: extrairEvento(payload),
    publicInstanceId: extrairInstancia(payload),
    instanceName: extrairNomeInstancia(payload),
    direction: extrairDirection(payload, mensagem),
    phone: extrairTelefone(payload, mensagem),
    messageId: extrairMessageId(payload, mensagem),
    messageText: extrairTextoMensagem(payload, mensagem),
    pushName: extrairPushName(payload, mensagem),
    messageType: extrairMessageType(payload, mensagem),
    messageTimestamp: extrairMessageTimestamp(payload, mensagem),
  };
}

function normalizarRespostaInterativa(texto: string | null): '1' | '2' | null {
  if (!texto) {
    return null;
  }

  const resposta = texto.trim();
  if (resposta === '1' || resposta === '2') {
    return resposta;
  }

  return null;
}

function formatarDataHoraMensagem(dataHoraIso: string | null | undefined): string | null {
  if (!dataHoraIso) {
    return null;
  }

  const match = dataHoraIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const [, ano, mes, dia, hora, minuto] = match;
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  const data = new Date(dataHoraIso);
  if (Number.isNaN(data.getTime())) {
    return dataHoraIso;
  }

  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function inferirProcessingStatus(parseError: string | null, processingNotes: string): string {
  if (parseError) {
    return 'ERRO_PARSE';
  }

  if (processingNotes.includes('processada')) {
    return 'PROCESSADO';
  }

  if (
    processingNotes.includes('sem contexto') ||
    processingNotes.includes('sem comando') ||
    processingNotes.includes('armazenado para analise')
  ) {
    return 'IGNORADO';
  }

  return 'RECEBIDO';
}

async function processarRespostaInterativa(evento: EventoExtraido): Promise<string> {
  if (
    evento.eventType !== 'messages_upsert' ||
    evento.direction !== 'INBOUND' ||
    !evento.phone
  ) {
    return 'Evento armazenado para analise';
  }

  const resposta = normalizarRespostaInterativa(evento.messageText);
  if (!resposta) {
    return 'Mensagem inbound recebida sem comando interativo reconhecido';
  }

  try {
    const interacaoResult = await query(
      `SELECT
         gi.id,
         gi."pointId",
         gi.tipo,
         gi.metadata,
         p.nome AS "arenaNome"
       FROM "GzappyInteracaoAgendamento" gi
       LEFT JOIN "Point" p ON p.id = gi."pointId"
       WHERE gi.phone = $1
         AND gi.status = 'AGUARDANDO_RESPOSTA'
         AND ($2::text IS NULL OR gi."publicInstanceId" = $2 OR gi."publicInstanceId" IS NULL)
       ORDER BY gi."createdAt" DESC
       LIMIT 1`,
      [evento.phone, evento.publicInstanceId]
    );

    if (interacaoResult.rows.length === 0) {
      return `Resposta interativa "${resposta}" recebida sem contexto pendente`;
    }

    const interacao = interacaoResult.rows[0];
    const interacaoId = interacao.id as string;
    const pointId = interacao.pointId as string;
    const arenaNome = (interacao.arenaNome as string | null) || 'Arena';
    const metadata =
      interacao.metadata && typeof interacao.metadata === 'object'
        ? (interacao.metadata as JsonRecord)
        : {};
    const novoStatus =
      resposta === '1' ? 'CONFIRMADO_RECEBIMENTO' : 'SOLICITOU_CONTATO';

    await query(
      `UPDATE "GzappyInteracaoAgendamento"
       SET status = $2,
           "respostaRecebida" = $3,
           "respostaMessageId" = $4,
           "respostaRecebidaEm" = COALESCE($5::timestamptz, NOW()),
           "updatedAt" = NOW()
       WHERE id = $1`,
      [
        interacaoId,
        novoStatus,
        evento.messageText,
        evento.messageId,
        evento.messageTimestamp,
      ]
    );

    const { enviarMensagemGzappy, obterWhatsAppGestor } = await import('@/lib/gzappyService');

    const mensagemAtleta =
      resposta === '1'
        ? `*${arenaNome}*\n\nRecebemos sua confirmacao do agendamento. Obrigado!`
        : `*${arenaNome}*\n\nRecebemos seu pedido de contato. A equipe da arena foi avisada.`;

    await enviarMensagemGzappy(
      {
        destinatario: evento.phone,
        mensagem: mensagemAtleta,
        tipo: 'texto',
      },
      pointId
    );

    if (resposta === '2') {
      const whatsappGestor = await obterWhatsAppGestor(pointId);
      if (whatsappGestor) {
        const nomeAtleta =
          evento.pushName ||
          (typeof metadata.nomeAtleta === 'string' ? metadata.nomeAtleta : null) ||
          'Atleta';
        const quadra =
          typeof metadata.quadra === 'string' ? metadata.quadra : 'Quadra';
        const dataHora =
          formatarDataHoraMensagem(
            typeof metadata.dataHoraNova === 'string'
              ? metadata.dataHoraNova
              : typeof metadata.dataHora === 'string'
                ? metadata.dataHora
                : null
          ) || 'Nao informado';

        await enviarMensagemGzappy(
          {
            destinatario: whatsappGestor,
            mensagem: `*${arenaNome}*\n\n📲 *Atleta solicitou contato*\n\n👤 *Atleta:* ${nomeAtleta}\n🔍 *Quadra:* ${quadra}\n📅 *Agendamento:* ${dataHora}\n💬 *Resposta:* ${evento.messageText || '2'}`,
            tipo: 'texto',
          },
          pointId
        );
      }
    }

    return resposta === '1'
      ? 'Resposta 1 processada: atleta confirmou recebimento'
      : 'Resposta 2 processada: atleta solicitou contato da arena';
  } catch (error: any) {
    if (error?.code === '42P01' || String(error?.message || '').includes('does not exist')) {
      return 'Tabela de interacao ainda nao existe; evento armazenado para analise';
    }

    throw error;
  }
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
    const evento = extrairDadosEvento(payload);
    const headers = obterHeadersSeguros(request);
    const processingNotesBase = parseError
      ? `Falha ao converter body para JSON: ${parseError}`
      : 'Payload armazenado para analise';
    const processingNotes = parseError
      ? processingNotesBase
      : await processarRespostaInterativa(evento);

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
        evento.publicInstanceId,
        evento.eventType,
        evento.messageId,
        evento.direction,
        evento.phone,
        evento.messageText,
        JSON.stringify(payload),
        JSON.stringify(headers),
        inferirProcessingStatus(parseError, processingNotes),
        processingNotes,
      ]
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[GZAPPY WEBHOOK] Evento recebido', {
        evento: evento.eventType,
        publicInstanceId: evento.publicInstanceId,
        instanceName: evento.instanceName,
        direction: evento.direction,
        phone: evento.phone,
        messageId: evento.messageId,
        pushName: evento.pushName,
        messageType: evento.messageType,
        hasMessageText: !!evento.messageText,
        processingNotes,
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
