import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

async function podeAcessarPoint(usuario: any, pointId: string) {
  if (usuario.role === 'ADMIN') return true;
  if (usuario.role === 'ORGANIZER') return usuarioTemAcessoAoPoint(usuario, pointId);
  return false;
}

async function recalcularStatusConta(client: any, contaPagarId: string) {
  const statusContaResult = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status <> 'CANCELADA') AS total,
      COUNT(*) FILTER (WHERE status = 'LIQUIDADA') AS liquidadas,
      COUNT(*) FILTER (WHERE status IN ('PARCIAL', 'LIQUIDADA')) AS com_movimento
    FROM "ContaPagarParcela"
    WHERE "contaPagarId" = $1
    `,
    [contaPagarId]
  );

  const total = Number(statusContaResult.rows[0]?.total ?? 0);
  const liquidadas = Number(statusContaResult.rows[0]?.liquidadas ?? 0);
  const comMovimento = Number(statusContaResult.rows[0]?.com_movimento ?? 0);
  const statusConta = total > 0 && liquidadas === total ? 'LIQUIDADA' : comMovimento > 0 ? 'PARCIAL' : 'ABERTA';

  await client.query(
    `UPDATE "ContaPagar" SET status = $2, "updatedAt" = NOW() WHERE id = $1`,
    [contaPagarId, statusConta]
  );
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ parcelaId: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    const { parcelaId } = await params;
    const parcelaResult = await query(
      `
      SELECT
        p.id AS "parcelaId",
        cp.id AS "contaId",
        cp."pointId",
        cp."fornecedorId",
        f.nome AS "fornecedorNome",
        cp.descricao,
        cp.status AS "statusConta",
        p.status AS "statusParcela",
        p.numero,
        p."createdAt"::date AS "dataLancamento",
        p.vencimento,
        p.valor::numeric(14,2) AS valor,
        p.observacoes,
        COALESCE(SUM(l.valor), 0)::numeric(14,2) AS "valorLiquidado"
      FROM "ContaPagarParcela" p
      INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
      LEFT JOIN "ContaPagarLiquidacao" l ON l."parcelaId" = p.id
      LEFT JOIN "Fornecedor" f ON f.id = cp."fornecedorId"
      WHERE p.id = $1
      GROUP BY p.id, cp.id, f.nome
      `,
      [parcelaId]
    );

    if (parcelaResult.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Despesa não encontrada' }, { status: 404 }), request);
    }

    const despesa = parcelaResult.rows[0];
    if (!(await podeAcessarPoint(usuario, despesa.pointId))) {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
    }

    const liquidacoesResult = await query(
      `
      SELECT
        l.id, l.data, l.valor::numeric(14,2) AS valor, l.observacoes, l."createdAt",
        l."formaPagamentoId",
        fp.nome AS "formaPagamentoNome",
        l."origemFinanceira",
        l."contaBancariaId",
        cb.nome AS "contaBancariaNome"
      FROM "ContaPagarLiquidacao" l
      LEFT JOIN "FormaPagamento" fp ON fp.id = l."formaPagamentoId"
      LEFT JOIN "ContaBancaria" cb ON cb.id = l."contaBancariaId"
      WHERE l."parcelaId" = $1
      ORDER BY l.data ASC, l."createdAt" ASC
      `,
      [parcelaId]
    );

    return withCors(NextResponse.json({ despesa, liquidacoes: liquidacoesResult.rows }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar despesa', error: error.message }, { status: 500 }),
      request
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ parcelaId: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { parcelaId } = await params;
    const body = await request.json();
    const vencimento = parseDate(body?.vencimento);
    const valor = typeof body?.valor === 'number' ? body.valor : Number(body?.valor);
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';

    if (!vencimento || !Number.isFinite(valor) || valor <= 0) {
      return withCors(NextResponse.json({ mensagem: 'Vencimento e valor são obrigatórios' }, { status: 400 }), request);
    }

    const updated = await transaction(async (client) => {
      const parcelaAtual = await client.query(
        `
        SELECT p.id, p.valor, p."contaPagarId", cp."pointId"
        FROM "ContaPagarParcela" p
        INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
        WHERE p.id = $1
        `,
        [parcelaId]
      );
      if (parcelaAtual.rows.length === 0) return null;

      const row = parcelaAtual.rows[0];
      if (!(await podeAcessarPoint(usuario, row.pointId))) {
        throw new Error('FORBIDDEN_POINT');
      }

      const soma = await client.query(
        `SELECT COALESCE(SUM(valor), 0)::numeric(14,2) AS total FROM "ContaPagarLiquidacao" WHERE "parcelaId" = $1`,
        [parcelaId]
      );
      const totalLiquidado = Number(soma.rows[0]?.total ?? 0);
      const statusParcela = totalLiquidado >= valor ? 'LIQUIDADA' : totalLiquidado > 0 ? 'PARCIAL' : 'PENDENTE';

      const parcelaUpdate = await client.query(
        `
        UPDATE "ContaPagarParcela"
        SET vencimento = $2::date, valor = $3, status = $4, observacoes = $5, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [parcelaId, vencimento, valor, statusParcela, observacoes || null]
      );

      await recalcularStatusConta(client, row.contaPagarId);
      return parcelaUpdate.rows[0];
    });

    if (!updated) {
      return withCors(NextResponse.json({ mensagem: 'Despesa não encontrada' }, { status: 404 }), request);
    }

    return withCors(NextResponse.json(updated), request);
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN_POINT') {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao atualizar despesa', error: error.message }, { status: 500 }),
      request
    );
  }
}
