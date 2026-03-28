import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

type OrigemDestinoTipo = 'CAIXA' | 'CONTA_BANCARIA';

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function parseTipo(value: unknown): OrigemDestinoTipo | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toUpperCase();
  return t === 'CAIXA' || t === 'CONTA_BANCARIA' ? (t as OrigemDestinoTipo) : null;
}

async function podeAcessarPoint(usuario: any, pointId: string) {
  if (usuario.role === 'ADMIN') return true;
  if (usuario.role === 'ORGANIZER') return usuarioTemAcessoAoPoint(usuario, pointId);
  return false;
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const pointId = usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : pointIdParam;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const result = await query(
      `
      SELECT
        t.id, t."pointId", t.data, t.valor, t.descricao, t.observacoes, t."createdAt", t."createdById",
        t."origemTipo", t."origemAberturaCaixaId", t."origemContaBancariaId",
        t."destinoTipo", t."destinoAberturaCaixaId", t."destinoContaBancariaId",
        o.nome AS "origemContaBancariaNome",
        d.nome AS "destinoContaBancariaNome"
      FROM "TransferenciaFinanceira" t
      LEFT JOIN "ContaBancaria" o ON o.id = t."origemContaBancariaId"
      LEFT JOIN "ContaBancaria" d ON d.id = t."destinoContaBancariaId"
      WHERE t."pointId" = $1
        AND ($2::date IS NULL OR t.data >= $2::date)
        AND ($3::date IS NULL OR t.data <= $3::date)
      ORDER BY t.data DESC, t."createdAt" DESC
      `,
      [pointId, dataInicio || null, dataFim || null]
    );

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar transferências', error: error.message }, { status: 500 }), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const body = await request.json();
    const pointId = typeof body?.pointId === 'string' ? body.pointId.trim() : '';
    const data = parseDate(body?.data);
    const valor = typeof body?.valor === 'number' ? body.valor : Number(body?.valor);
    const descricao = typeof body?.descricao === 'string' ? body.descricao.trim() : '';
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';
    const origemTipo = parseTipo(body?.origemTipo);
    const destinoTipo = parseTipo(body?.destinoTipo);
    const origemContaBancariaId = typeof body?.origemContaBancariaId === 'string' ? body.origemContaBancariaId.trim() : '';
    const destinoContaBancariaId = typeof body?.destinoContaBancariaId === 'string' ? body.destinoContaBancariaId.trim() : '';

    if (!pointId || !data || !Number.isFinite(valor) || valor <= 0 || !descricao || !origemTipo || !destinoTipo) {
      return withCors(NextResponse.json({ mensagem: 'Dados obrigatórios inválidos para transferência' }, { status: 400 }), request);
    }

    if (!(await podeAcessarPoint(usuario, pointId))) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    if (origemTipo === destinoTipo) {
      if (origemTipo === 'CAIXA') {
        return withCors(NextResponse.json({ mensagem: 'Transferência entre caixa e caixa não é permitida' }, { status: 400 }), request);
      }
      if (!origemContaBancariaId || !destinoContaBancariaId || origemContaBancariaId === destinoContaBancariaId) {
        return withCors(NextResponse.json({ mensagem: 'Selecione contas bancárias diferentes para transferir' }, { status: 400 }), request);
      }
    }

    if (origemTipo === 'CONTA_BANCARIA' && !origemContaBancariaId) {
      return withCors(NextResponse.json({ mensagem: 'Conta bancária de origem é obrigatória' }, { status: 400 }), request);
    }
    if (destinoTipo === 'CONTA_BANCARIA' && !destinoContaBancariaId) {
      return withCors(NextResponse.json({ mensagem: 'Conta bancária de destino é obrigatória' }, { status: 400 }), request);
    }

    const created = await transaction(async (client) => {
      let aberturaCaixaId: string | null = null;
      if (origemTipo === 'CAIXA' || destinoTipo === 'CAIXA') {
        const aberturaResult = await client.query(
          `SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = 'ABERTA' ORDER BY "dataAbertura" DESC LIMIT 1`,
          [pointId]
        );
        if (aberturaResult.rows.length === 0) {
          throw new Error('Não há caixa aberto para transferências com caixa');
        }
        aberturaCaixaId = aberturaResult.rows[0].id;
      }

      if (origemTipo === 'CONTA_BANCARIA') {
        const contaOrigem = await client.query(`SELECT id, ativo, "pointId" FROM "ContaBancaria" WHERE id = $1`, [origemContaBancariaId]);
        if (contaOrigem.rows.length === 0 || !contaOrigem.rows[0].ativo || contaOrigem.rows[0].pointId !== pointId) {
          throw new Error('Conta bancária de origem inválida');
        }
      }

      if (destinoTipo === 'CONTA_BANCARIA') {
        const contaDestino = await client.query(`SELECT id, ativo, "pointId" FROM "ContaBancaria" WHERE id = $1`, [destinoContaBancariaId]);
        if (contaDestino.rows.length === 0 || !contaDestino.rows[0].ativo || contaDestino.rows[0].pointId !== pointId) {
          throw new Error('Conta bancária de destino inválida');
        }
      }

      const transferenciaResult = await client.query(
        `
        INSERT INTO "TransferenciaFinanceira" (
          id, "pointId", data, valor, "origemTipo", "origemAberturaCaixaId", "origemContaBancariaId",
          "destinoTipo", "destinoAberturaCaixaId", "destinoContaBancariaId", descricao, observacoes, "createdAt", "createdById"
        ) VALUES (
          gen_random_uuid()::text, $1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12
        ) RETURNING *
        `,
        [
          pointId,
          data,
          valor,
          origemTipo,
          origemTipo === 'CAIXA' ? aberturaCaixaId : null,
          origemTipo === 'CONTA_BANCARIA' ? origemContaBancariaId : null,
          destinoTipo,
          destinoTipo === 'CAIXA' ? aberturaCaixaId : null,
          destinoTipo === 'CONTA_BANCARIA' ? destinoContaBancariaId : null,
          descricao,
          observacoes || null,
          usuario.id,
        ]
      );

      const transferencia = transferenciaResult.rows[0];

      if (origemTipo === 'CONTA_BANCARIA') {
        await client.query(
          `
          INSERT INTO "MovimentacaoContaBancaria" (
            id, "contaBancariaId", tipo, valor, data, descricao, origem, "transferenciaFinanceiraId", observacoes, "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, 'SAIDA', $2, $3::date, $4, 'TRANSFERENCIA', $5, $6, NOW(), $7
          )
          `,
          [origemContaBancariaId, valor, data, descricao, transferencia.id, observacoes || null, usuario.id]
        );
      }

      if (destinoTipo === 'CONTA_BANCARIA') {
        await client.query(
          `
          INSERT INTO "MovimentacaoContaBancaria" (
            id, "contaBancariaId", tipo, valor, data, descricao, origem, "transferenciaFinanceiraId", observacoes, "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, 'ENTRADA', $2, $3::date, $4, 'TRANSFERENCIA', $5, $6, NOW(), $7
          )
          `,
          [destinoContaBancariaId, valor, data, descricao, transferencia.id, observacoes || null, usuario.id]
        );
      }

      return transferencia;
    });

    return withCors(NextResponse.json(created, { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar transferência', error: error.message }, { status: 500 }), request);
  }
}
