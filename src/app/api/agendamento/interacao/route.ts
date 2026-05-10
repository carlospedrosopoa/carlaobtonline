import { NextRequest, NextResponse } from 'next/server';

import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { query } from '@/lib/db';

type JsonRecord = Record<string, any>;

function normalizarTelefoneContexto(value: unknown, fallbackId: string): string {
  if (typeof value === 'string' && value.trim()) {
    const somenteNumeros = value.replace(/\D/g, '');
    if (somenteNumeros) {
      return somenteNumeros;
    }
  }

  return `manual:${fallbackId}`;
}

async function buscarUltimasInteracoesPorAgendamento(
  agendamentoIds: string[],
  pointIdPermitido?: string | null
) {
  if (agendamentoIds.length === 0) {
    return [];
  }

  const params: any[] = [agendamentoIds];
  let sql = `
    SELECT DISTINCT ON (gi."agendamentoId")
      gi.id,
      gi."agendamentoId",
      gi."pointId",
      gi."publicInstanceId",
      gi.phone,
      gi.tipo,
      gi.status,
      gi."mensagemEnviada",
      gi."respostaRecebida",
      gi."respostaMessageId",
      gi."respostaRecebidaEm",
      gi.metadata,
      gi."createdAt",
      gi."updatedAt"
    FROM "GzappyInteracaoAgendamento" gi
    INNER JOIN "Agendamento" a ON a.id = gi."agendamentoId"
    INNER JOIN "Quadra" q ON q.id = a."quadraId"
    WHERE gi."agendamentoId" = ANY($1::text[])
  `;

  if (pointIdPermitido) {
    params.push(pointIdPermitido);
    sql += ` AND q."pointId" = $${params.length}`;
  }

  sql += ` ORDER BY gi."agendamentoId", gi."createdAt" DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(
        NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }),
        request
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(
        NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }),
        request
      );
    }

    const { searchParams } = new URL(request.url);
    const agendamentoIdsParam = searchParams.get('agendamentoIds') || '';
    const agendamentoIds = agendamentoIdsParam
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (agendamentoIds.length === 0) {
      return withCors(NextResponse.json([]), request);
    }

    const interacoes = await buscarUltimasInteracoesPorAgendamento(
      agendamentoIds,
      usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : null
    );

    return withCors(NextResponse.json(interacoes), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao listar interações do agendamento', error: error?.message },
        { status: 500 }
      ),
      request
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(
        NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }),
        request
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(
        NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }),
        request
      );
    }

    const body = (await request.json()) as {
      acao?: string;
      agendamentoId?: string;
      observacao?: string;
    };

    if (body.acao !== 'CONFIRMAR_MANUALMENTE' || !body.agendamentoId) {
      return withCors(
        NextResponse.json(
          { mensagem: 'Ação inválida. Informe acao=CONFIRMAR_MANUALMENTE e agendamentoId.' },
          { status: 400 }
        ),
        request
      );
    }

    const agendamentoResult = await query(
      `SELECT
         a.id,
         a."telefoneAvulso",
         a."nomeAvulso",
         a."dataHora",
         q."pointId",
         q.nome AS "quadraNome",
         p.nome AS "arenaNome",
         at.fone AS "atletaFone",
         at.nome AS "atletaNome"
       FROM "Agendamento" a
       INNER JOIN "Quadra" q ON q.id = a."quadraId"
       INNER JOIN "Point" p ON p.id = q."pointId"
       LEFT JOIN "Atleta" at ON at.id = a."atletaId"
       WHERE a.id = $1
       LIMIT 1`,
      [body.agendamentoId]
    );

    if (agendamentoResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Agendamento não encontrado' }, { status: 404 }),
        request
      );
    }

    const agendamento = agendamentoResult.rows[0];
    const pointId = agendamento.pointId as string;

    if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(
        NextResponse.json({ mensagem: 'Você não tem acesso a este agendamento' }, { status: 403 }),
        request
      );
    }

    const interacaoAtualResult = await buscarUltimasInteracoesPorAgendamento([body.agendamentoId], pointId);
    const interacaoAtual = interacaoAtualResult[0] as JsonRecord | undefined;
    const telefone = normalizarTelefoneContexto(
      interacaoAtual?.phone || agendamento.atletaFone || agendamento.telefoneAvulso,
      body.agendamentoId
    );

    const metadataManual: JsonRecord = {
      arena: agendamento.arenaNome,
      quadra: agendamento.quadraNome,
      dataHora: agendamento.dataHora,
      nomeAtleta: agendamento.atletaNome || agendamento.nomeAvulso || null,
      confirmadoManualmente: true,
      confirmadoManualPorUsuarioId: usuario.id,
      confirmadoManualPorNome: usuario.nome,
      confirmadoManualEm: new Date().toISOString(),
      observacaoConfirmacaoManual: body.observacao?.trim() || null,
    };

    let interacaoId = interacaoAtual?.id as string | undefined;

    if (interacaoId) {
      await query(
        `UPDATE "GzappyInteracaoAgendamento"
         SET status = 'CONFIRMADO_RECEBIMENTO',
             "respostaRecebida" = 'CONFIRMACAO_MANUAL',
             "respostaRecebidaEm" = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [interacaoId, JSON.stringify(metadataManual)]
      );
    } else {
      const insertResult = await query(
        `INSERT INTO "GzappyInteracaoAgendamento" (
          "agendamentoId",
          "pointId",
          phone,
          tipo,
          status,
          "mensagemEnviada",
          "respostaRecebida",
          "respostaRecebidaEm",
          metadata
        ) VALUES ($1, $2, $3, 'NOVO_AGENDAMENTO', 'CONFIRMADO_RECEBIMENTO', $4, 'CONFIRMACAO_MANUAL', NOW(), $5::jsonb)
        RETURNING id`,
        [
          body.agendamentoId,
          pointId,
          telefone,
          'Confirmacao manual registrada pelo gestor',
          JSON.stringify(metadataManual),
        ]
      );

      interacaoId = insertResult.rows[0]?.id as string;
    }

    const interacaoAtualizadaResult = await query(
      `SELECT
         id,
         "agendamentoId",
         "pointId",
         "publicInstanceId",
         phone,
         tipo,
         status,
         "mensagemEnviada",
         "respostaRecebida",
         "respostaMessageId",
         "respostaRecebidaEm",
         metadata,
         "createdAt",
         "updatedAt"
       FROM "GzappyInteracaoAgendamento"
       WHERE id = $1
       LIMIT 1`,
      [interacaoId]
    );

    return withCors(
      NextResponse.json({
        mensagem: 'Confirmação manual registrada com sucesso',
        interacao: interacaoAtualizadaResult.rows[0],
      }),
      request
    );
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao registrar confirmação manual', error: error?.message },
        { status: 500 }
      ),
      request
    );
  }
}
