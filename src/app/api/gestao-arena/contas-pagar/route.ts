import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

type ParcelaInput = {
  vencimento: string;
  valor: number;
  numero?: number;
  observacoes?: string;
};

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function parseOptionalUuid(value: unknown) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

async function validarPointAcesso(usuario: any, pointId: string) {
  if (usuario.role === 'ORGANIZER') {
    return usuarioTemAcessoAoPoint(usuario, pointId);
  }
  return usuario.role === 'ADMIN';
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const pointId = usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : pointIdParam;
    const status = searchParams.get('status');
    const pessoa = (searchParams.get('pessoa') || '').trim();
    const vencimentoInicio = searchParams.get('vencimentoInicio');
    const vencimentoFim = searchParams.get('vencimentoFim');
    const fornecedorId = searchParams.get('fornecedorId');
    const statusParcela = searchParams.get('statusParcela');
    const tipoDespesaId = searchParams.get('tipoDespesaId');
    const centroCustoId = searchParams.get('centroCustoId');
    const valorMin = searchParams.get('valorMin');
    const valorMax = searchParams.get('valorMax');

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const sql = `
      SELECT
        p.id AS "parcelaId",
        cp.id AS "contaId",
        cp."pointId",
        cp."fornecedorId",
        f.nome AS "fornecedorNome",
        td.nome AS "tipoDespesaNome",
        cc.nome AS "centroCustoNome",
        cp.descricao,
        cp.status AS "statusConta",
        p.status AS "statusParcela",
        p.numero,
        COALESCE(tp."totalParcelas", 1) AS "totalParcelas",
        p."createdAt"::date AS "dataLancamento",
        p.vencimento,
        p.valor::numeric(14,2) AS valor,
        COALESCE(SUM(l.valor), 0)::numeric(14,2) AS "valorLiquidado"
      FROM "ContaPagar" cp
      INNER JOIN "ContaPagarParcela" p
        ON p."contaPagarId" = cp.id
        AND p.status <> 'CANCELADA'
      LEFT JOIN "ContaPagarLiquidacao" l
        ON l."parcelaId" = p.id
      LEFT JOIN "Fornecedor" f
        ON f.id = cp."fornecedorId"
      LEFT JOIN "TipoDespesa" td
        ON td.id = cp."tipoDespesaId"
      LEFT JOIN "CentroCusto" cc
        ON cc.id = cp."centroCustoId"
      LEFT JOIN (
        SELECT "contaPagarId", COUNT(*) AS "totalParcelas"
        FROM "ContaPagarParcela"
        WHERE status <> 'CANCELADA'
        GROUP BY "contaPagarId"
      ) tp ON tp."contaPagarId" = cp.id
      WHERE cp."pointId" = $1
        AND ($2::text IS NULL OR (
          cp.descricao ILIKE $2
          OR COALESCE(f.nome, '') ILIKE $2
          OR COALESCE(f.cnpj, '') ILIKE $2
          OR COALESCE(f.cpf, '') ILIKE $2
        ))
        AND ($3::date IS NULL OR p.vencimento >= $3::date)
        AND ($4::date IS NULL OR p.vencimento <= $4::date)
        AND ($5::text IS NULL OR cp."fornecedorId" = $5::text)
        AND ($6::text IS NULL OR p.status = $6::text)
        AND ($7::numeric IS NULL OR p.valor >= $7::numeric)
        AND ($8::numeric IS NULL OR p.valor <= $8::numeric)
        AND ($9::text IS NULL OR cp.status = $9::text OR p.status = $9::text)
        AND ($10::text IS NULL OR cp."tipoDespesaId" = $10::text)
        AND ($11::text IS NULL OR cp."centroCustoId" = $11::text)
      GROUP BY p.id, cp.id, f.nome, td.nome, cc.nome, tp."totalParcelas"
      ORDER BY p.vencimento ASC, cp."createdAt" DESC, p.numero ASC
    `;

    const pessoaParam = pessoa.length >= 2 ? `%${pessoa}%` : null;
    const valorMinNum = valorMin ? Number(valorMin) : null;
    const valorMaxNum = valorMax ? Number(valorMax) : null;
    const result = await query(sql, [
      pointId,
      pessoaParam,
      vencimentoInicio || null,
      vencimentoFim || null,
      fornecedorId || null,
      statusParcela ? statusParcela.toUpperCase() : null,
      Number.isFinite(valorMinNum as number) ? valorMinNum : null,
      Number.isFinite(valorMaxNum as number) ? valorMaxNum : null,
      status ? status.toUpperCase() : null,
      tipoDespesaId || null,
      centroCustoId || null,
    ]);

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao listar contas a pagar', error: error.message }, { status: 500 }),
      request
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const body = await request.json();
    const pointId = (body?.pointId || '').trim();
    const descricao = (body?.descricao || '').trim();
    const fornecedorId = parseOptionalUuid(body?.fornecedorId);
    const tipoDespesaId = parseOptionalUuid(body?.tipoDespesaId);
    const centroCustoId = parseOptionalUuid(body?.centroCustoId);
    const codigoExterno = (body?.codigoExterno || '').trim();
    const observacoes = (body?.observacoes || '').trim();
    const parcelas = Array.isArray(body?.parcelas) ? (body.parcelas as ParcelaInput[]) : [];

    if (!pointId || !descricao || parcelas.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'pointId, descrição e parcelas são obrigatórios' }, { status: 400 }),
        request
      );
    }

    const temAcesso = await validarPointAcesso(usuario, pointId);
    if (!temAcesso) {
      return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a esta arena' }, { status: 403 }), request);
    }

    const parcelasNormalizadas = parcelas.map((p, idx) => {
      const vencimento = parseDate(p?.vencimento);
      const valor = typeof p?.valor === 'number' ? p.valor : Number(p?.valor);
      const numero = typeof p?.numero === 'number' ? Math.trunc(p.numero) : idx + 1;
      const obs = typeof p?.observacoes === 'string' ? p.observacoes.trim() : '';
      return { vencimento, valor, numero, observacoes: obs || null };
    });

    if (parcelasNormalizadas.some((p) => !p.vencimento)) {
      return withCors(
        NextResponse.json({ mensagem: 'Vencimento inválido nas parcelas' }, { status: 400 }),
        request
      );
    }

    if (parcelasNormalizadas.some((p) => !Number.isFinite(p.valor) || p.valor <= 0)) {
      return withCors(
        NextResponse.json({ mensagem: 'Valor inválido nas parcelas' }, { status: 400 }),
        request
      );
    }

    const conta = await transaction(async (client) => {
      if (fornecedorId) {
        const fornecedor = await client.query('SELECT id, ativo, "pointId" FROM "Fornecedor" WHERE id = $1', [fornecedorId]);
        if (fornecedor.rows.length === 0 || !fornecedor.rows[0].ativo || fornecedor.rows[0].pointId !== pointId) {
          throw new Error('Fornecedor inválido para esta arena');
        }
      }

      if (tipoDespesaId) {
        const tipo = await client.query('SELECT id, ativo, "pointId" FROM "TipoDespesa" WHERE id = $1', [tipoDespesaId]);
        if (tipo.rows.length === 0 || !tipo.rows[0].ativo || tipo.rows[0].pointId !== pointId) {
          throw new Error('Tipo de despesa inválido para esta arena');
        }
      }

      if (centroCustoId) {
        const centro = await client.query('SELECT id, ativo, "pointId" FROM "CentroCusto" WHERE id = $1', [centroCustoId]);
        if (centro.rows.length === 0 || !centro.rows[0].ativo || centro.rows[0].pointId !== pointId) {
          throw new Error('Centro de custo inválido para esta arena');
        }
      }

      const contaResult = await client.query(
        `INSERT INTO "ContaPagar" (
          id, "pointId", "fornecedorId", descricao, status, "tipoDespesaId", "centroCustoId",
          "codigoExterno", observacoes, "createdAt", "updatedAt", "createdById", "updatedById"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, 'ABERTA', $4, $5, $6, $7, NOW(), NOW(), $8, $8
        ) RETURNING *`,
        [pointId, fornecedorId, descricao, tipoDespesaId, centroCustoId, codigoExterno || null, observacoes || null, usuario.id]
      );

      const contaCriada = contaResult.rows[0];
      for (const parcela of parcelasNormalizadas) {
        await client.query(
          `INSERT INTO "ContaPagarParcela" (
            id, "contaPagarId", numero, vencimento, valor, status, observacoes, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3::date, $4, 'PENDENTE', $5, NOW(), NOW()
          )`,
          [contaCriada.id, parcela.numero, parcela.vencimento, parcela.valor, parcela.observacoes]
        );
      }

      return contaCriada;
    });

    return withCors(NextResponse.json(conta, { status: 201 }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao criar conta a pagar', error: error.message }, { status: 500 }),
      request
    );
  }
}
