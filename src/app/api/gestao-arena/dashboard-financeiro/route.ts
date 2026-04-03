import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

async function tableExists(tableName: string) {
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = $1
    ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

function ymd(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function getNextMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 999));
  return { start, end };
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseNumber(value: any) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
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
    const pointId = usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : pointIdParam;
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER') {
      const ok = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!ok) return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a esta arena' }, { status: 403 }), request);
    }

    const dataInicioParam = ymd(searchParams.get('dataInicio'));
    const dataFimParam = ymd(searchParams.get('dataFim'));
    const rangeDefault = getCurrentMonthRange();
    const dataInicio = dataInicioParam ?? toYMD(rangeDefault.start);
    const dataFim = dataFimParam ?? toYMD(rangeDefault.end);

    const nextMonth = getNextMonthRange();
    const nextInicio = toYMD(nextMonth.start);
    const nextFim = toYMD(nextMonth.end);

    const exists = {
      SaidaCaixa: false,
      Fornecedor: false,
      MovimentacaoContaBancaria: false,
      ContaBancaria: false,
      ContaPagarLiquidacao: false,
      ContaPagarParcela: false,
      ContaPagar: false,
      ItemCard: false,
      CardCliente: false,
      Produto: false,
      CardAgendamento: false,
      Agendamento: false,
      Quadra: false,
    };

    await Promise.all(
      Object.keys(exists).map(async (k) => {
        (exists as any)[k] = await tableExists(k);
      })
    );

    const despesasCaixaSemFornecedorSql = `
      SELECT
        'SEM_FORNECEDOR' as "fornecedorId",
        'Fornecedor não informado' as "fornecedorNome",
        COALESCE(SUM(s.valor), 0)::numeric(14,2) as total
      FROM "SaidaCaixa" s
      LEFT JOIN "ContaPagarLiquidacao" l ON l."saidaCaixaId" = s.id
      WHERE s."pointId" = $1
        AND s."fornecedorId" IS NULL
        AND (l.id IS NULL)
        AND s."dataSaida"::date >= $2::date
        AND s."dataSaida"::date <= $3::date
    `;

    const despesasCaixaManualSql = `
      SELECT
        f.id as "fornecedorId",
        f.nome as "fornecedorNome",
        COALESCE(SUM(s.valor), 0)::numeric(14,2) as total
      FROM "SaidaCaixa" s
      INNER JOIN "Fornecedor" f ON f.id = s."fornecedorId"
      LEFT JOIN "ContaPagarLiquidacao" l ON l."saidaCaixaId" = s.id
      WHERE s."pointId" = $1
        AND s."fornecedorId" IS NOT NULL
        AND l.id IS NULL
        AND s."dataSaida"::date >= $2::date
        AND s."dataSaida"::date <= $3::date
      GROUP BY f.id, f.nome
    `;

    const despesasCaixaSql = `
      SELECT
        f.id as "fornecedorId",
        f.nome as "fornecedorNome",
        COALESCE(SUM(s.valor), 0)::numeric(14,2) as total
      FROM "SaidaCaixa" s
      INNER JOIN "Fornecedor" f ON f.id = s."fornecedorId"
      WHERE s."pointId" = $1
        AND s."fornecedorId" IS NOT NULL
        AND s."dataSaida"::date >= $2::date
        AND s."dataSaida"::date <= $3::date
      GROUP BY f.id, f.nome
    `;

    const despesasLiquidacoesSql = `
      SELECT
        COALESCE(f.id, 'SEM_FORNECEDOR') as "fornecedorId",
        COALESCE(f.nome, 'Fornecedor não informado') as "fornecedorNome",
        l."origemFinanceira" as origem,
        COALESCE(SUM(l.valor), 0)::numeric(14,2) as total
      FROM "ContaPagarLiquidacao" l
      INNER JOIN "ContaPagarParcela" p ON p.id = l."parcelaId"
      INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
      LEFT JOIN "Fornecedor" f ON f.id = cp."fornecedorId"
      WHERE cp."pointId" = $1
        AND l.data::date >= $2::date
        AND l.data::date <= $3::date
      GROUP BY COALESCE(f.id, 'SEM_FORNECEDOR'), COALESCE(f.nome, 'Fornecedor não informado'), l."origemFinanceira"
    `;

    const despesasCaixaSemFornecedorPromise =
      exists.SaidaCaixa && exists.ContaPagarLiquidacao
        ? query(despesasCaixaSemFornecedorSql, [pointId, dataInicio, dataFim])
        : exists.SaidaCaixa
          ? query(
              `
              SELECT
                'SEM_FORNECEDOR' as "fornecedorId",
                'Fornecedor não informado' as "fornecedorNome",
                COALESCE(SUM(s.valor), 0)::numeric(14,2) as total
              FROM "SaidaCaixa" s
              WHERE s."pointId" = $1
                AND s."fornecedorId" IS NULL
                AND s."dataSaida"::date >= $2::date
                AND s."dataSaida"::date <= $3::date
              `,
              [pointId, dataInicio, dataFim]
            )
          : ({ rows: [] } as any);

    const despesasCaixaPromise =
      exists.SaidaCaixa && exists.Fornecedor
        ? exists.ContaPagarLiquidacao
          ? query(despesasCaixaManualSql, [pointId, dataInicio, dataFim])
          : query(despesasCaixaSql, [pointId, dataInicio, dataFim])
        : ({ rows: [] } as any);

    const despesasLiquidacoesPromise =
      exists.ContaPagarLiquidacao && exists.ContaPagarParcela && exists.ContaPagar && exists.Fornecedor
        ? query(despesasLiquidacoesSql, [pointId, dataInicio, dataFim])
        : ({ rows: [] } as any);

    const [despesasCaixaSemFornecedor, despesasCaixa, despesasLiquidacoes] = await Promise.all([
      despesasCaixaSemFornecedorPromise,
      despesasCaixaPromise,
      despesasLiquidacoesPromise,
    ]);

    const map = new Map<
      string,
      { fornecedorId: string; fornecedorNome: string; total: number; caixa: number; banco: number }
    >();

    for (const row of despesasCaixa.rows as any[]) {
      const id = String(row.fornecedorId);
      const current = map.get(id) ?? {
        fornecedorId: id,
        fornecedorNome: String(row.fornecedorNome),
        total: 0,
        caixa: 0,
        banco: 0,
      };
      current.caixa += parseNumber(row.total);
      current.total = current.caixa + current.banco;
      map.set(id, current);
    }

    for (const row of despesasCaixaSemFornecedor.rows as any[]) {
      const id = String(row.fornecedorId || 'SEM_FORNECEDOR');
      const current = map.get(id) ?? {
        fornecedorId: id,
        fornecedorNome: String(row.fornecedorNome || 'Fornecedor não informado'),
        total: 0,
        caixa: 0,
        banco: 0,
      };
      current.caixa += parseNumber(row.total);
      current.total = current.caixa + current.banco;
      map.set(id, current);
    }

    for (const row of despesasLiquidacoes.rows as any[]) {
      const id = String(row.fornecedorId);
      const current = map.get(id) ?? {
        fornecedorId: id,
        fornecedorNome: String(row.fornecedorNome),
        total: 0,
        caixa: 0,
        banco: 0,
      };
      const origem = String(row.origem || '').toUpperCase();
      if (origem === 'CAIXA') current.caixa += parseNumber(row.total);
      else if (origem === 'CONTA_BANCARIA') current.banco += parseNumber(row.total);
      else current.caixa += parseNumber(row.total);
      current.total = current.caixa + current.banco;
      map.set(id, current);
    }

    const despesasPorFornecedor = Array.from(map.values()).sort((a, b) => b.total - a.total);

    const receitasItensSql = exists.Produto
      ? `
        SELECT
          COALESCE(p.categoria, '') as categoria,
          COALESCE(SUM(i."precoTotal"), 0)::numeric(14,2) as total
        FROM "ItemCard" i
        INNER JOIN "CardCliente" c ON c.id = i."cardId"
        LEFT JOIN "Produto" p ON p.id = i."produtoId"
        WHERE c."pointId" = $1
          AND i."createdAt"::date >= $2::date
          AND i."createdAt"::date <= $3::date
          AND c.status <> 'CANCELADO'
        GROUP BY COALESCE(p.categoria, '')
      `
      : `
        SELECT
          '' as categoria,
          COALESCE(SUM(i."precoTotal"), 0)::numeric(14,2) as total
        FROM "ItemCard" i
        INNER JOIN "CardCliente" c ON c.id = i."cardId"
        WHERE c."pointId" = $1
          AND i."createdAt"::date >= $2::date
          AND i."createdAt"::date <= $3::date
          AND c.status <> 'CANCELADO'
        GROUP BY 1
      `;

    const receitasAgendamentoSql = `
      SELECT
        COALESCE(SUM(ca.valor), 0)::numeric(14,2) as total
      FROM "CardAgendamento" ca
      INNER JOIN "CardCliente" c ON c.id = ca."cardId"
      WHERE c."pointId" = $1
        AND ca."createdAt"::date >= $2::date
        AND ca."createdAt"::date <= $3::date
        AND c.status <> 'CANCELADO'
    `;

    const [receitasItens, receitasAgendamentos] = await Promise.all([
      exists.ItemCard && exists.CardCliente ? query(receitasItensSql, [pointId, dataInicio, dataFim]) : ({ rows: [] } as any),
      exists.CardAgendamento && exists.CardCliente ? query(receitasAgendamentoSql, [pointId, dataInicio, dataFim]) : ({ rows: [{ total: 0 }] } as any),
    ]);

    let receitaLocacao = 0;
    let receitaEvento = 0;
    let receitaProdutos = 0;
    const receitasPorCategoriaMap = new Map<string, number>();

    for (const row of receitasItens.rows as any[]) {
      const categoriaRaw = String(row.categoria ?? '').trim();
      const categoriaKey = categoriaRaw || 'Sem categoria';
      receitasPorCategoriaMap.set(categoriaKey, (receitasPorCategoriaMap.get(categoriaKey) ?? 0) + parseNumber(row.total));

      const categoria = categoriaKey.toLowerCase();
      const total = parseNumber(row.total);
      if (categoria.includes('loca')) receitaLocacao += total;
      else if (categoria.includes('event')) receitaEvento += total;
      else receitaProdutos += total;
    }

    receitaLocacao += parseNumber(receitasAgendamentos.rows[0]?.total);

    const receitas = {
      locacao: receitaLocacao,
      evento: receitaEvento,
      produtos: receitaProdutos,
      total: receitaLocacao + receitaEvento + receitaProdutos,
    };

    const receitasPorCategoriaProduto = Array.from(receitasPorCategoriaMap.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);

    const projecaoDespesasSql = `
      SELECT
        COALESCE(SUM(GREATEST(p.valor::numeric(14,2) - COALESCE(l.total_liquidado, 0)::numeric(14,2), 0)), 0)::numeric(14,2) as total
      FROM "ContaPagarParcela" p
      INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
      LEFT JOIN (
        SELECT "parcelaId", COALESCE(SUM(valor), 0)::numeric(14,2) AS total_liquidado
        FROM "ContaPagarLiquidacao"
        GROUP BY "parcelaId"
      ) l ON l."parcelaId" = p.id
      WHERE cp."pointId" = $1
        AND p.status IN ('PENDENTE', 'PARCIAL')
        AND p.vencimento >= $2::date
        AND p.vencimento <= $3::date
    `;

    const projecaoReceitasSqlPreferencial = `
      SELECT
        COALESCE(SUM(COALESCE(a."valorNegociado", a."valorCalculado", 0)::numeric(14,2)), 0)::numeric(14,2) as total
      FROM "Agendamento" a
      INNER JOIN "Quadra" q ON q.id = a."quadraId"
      WHERE q."pointId" = $1
        AND a.status <> 'CANCELADO'
        AND a."dataHora" >= ($2::date::timestamptz)
        AND a."dataHora" < (($3::date + INTERVAL '1 day')::timestamptz)
    `;

    const projecaoReceitasSqlFallback = `
      SELECT
        COALESCE(SUM(COALESCE(a."valorCalculado", 0)::numeric(14,2)), 0)::numeric(14,2) as total
      FROM "Agendamento" a
      INNER JOIN "Quadra" q ON q.id = a."quadraId"
      WHERE q."pointId" = $1
        AND a.status <> 'CANCELADO'
        AND a."dataHora" >= ($2::date::timestamptz)
        AND a."dataHora" < (($3::date + INTERVAL '1 day')::timestamptz)
    `;

    const projecaoDespesasPromise =
      exists.ContaPagarParcela && exists.ContaPagar && exists.ContaPagarLiquidacao
        ? query(projecaoDespesasSql, [pointId, nextInicio, nextFim])
        : ({ rows: [{ total: 0 }] } as any);

    const projecaoReceitasPromise =
      exists.Agendamento && exists.Quadra
        ? query(projecaoReceitasSqlPreferencial, [pointId, nextInicio, nextFim]).catch(async () => {
            return query(projecaoReceitasSqlFallback, [pointId, nextInicio, nextFim]);
          })
        : ({ rows: [{ total: 0 }] } as any);

    const [projecaoDespesas, projecaoReceitas] = await Promise.all([projecaoDespesasPromise, projecaoReceitasPromise]);

    const despesasProvisionadas = parseNumber(projecaoDespesas.rows[0]?.total);
    const receitasProvisionadas = parseNumber(projecaoReceitas.rows[0]?.total);

    const response = NextResponse.json({
      periodo: { dataInicio, dataFim },
      despesasPorFornecedor,
      receitas,
      receitasPorCategoriaProduto,
      projecaoProximoMes: {
        dataInicio: nextInicio,
        dataFim: nextFim,
        despesasProvisionadas,
        receitasProvisionadas,
        saldoProjetado: receitasProvisionadas - despesasProvisionadas,
      },
    });

    return withCors(response, request);
  } catch (error: any) {
    const resp = NextResponse.json(
      { mensagem: 'Erro ao gerar dashboard financeiro', error: error?.message || 'Erro interno', code: error?.code || null },
      { status: 500 }
    );
    return withCors(resp, request);
  }
}
