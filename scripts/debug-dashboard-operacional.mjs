import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 1,
  options: '-c timezone=UTC',
});

async function runOne(name, text, params) {
  const started = Date.now();
  try {
    const res = await pool.query(text, params);
    const ms = Date.now() - started;
    console.log(`[OK] ${name}: ${res.rowCount} rows (${ms}ms)`);
    return res;
  } catch (err) {
    const ms = Date.now() - started;
    console.error(`[ERRO] ${name} (${ms}ms)`);
    console.error(err);
    throw err;
  }
}

async function main() {
  const pointId = process.env.DEBUG_POINT_ID || '2d77100f-aec8-45ca-b802-fcc964f539a9';
  const dataInicio = process.env.DEBUG_DATA_INICIO || '2025-12-15T00:00:00.000Z';
  const dataFim = process.env.DEBUG_DATA_FIM || '2026-01-14T23:59:59.999Z';

  const params = [pointId, dataInicio, dataFim];

  const kpisAgendamentoSql = `
    SELECT
      COUNT(*)::int as total,
      COALESCE(SUM(a.duracao), 0)::int as "totalMinutos"
    FROM "Agendamento" a
    JOIN "Quadra" q ON q.id = a."quadraId"
    WHERE q."pointId" = $1
      AND a.status <> 'CANCELADO'
      AND a."dataHora" >= $2
      AND a."dataHora" <= $3
  `;

  const duracaoRankingSql = `
    SELECT
      a.duracao::int as duracao,
      COUNT(*)::int as quantidade,
      (a.duracao * COUNT(*))::int as "totalMinutos"
    FROM "Agendamento" a
    JOIN "Quadra" q ON q.id = a."quadraId"
    WHERE q."pointId" = $1
      AND a.status <> 'CANCELADO'
      AND a."dataHora" >= $2
      AND a."dataHora" <= $3
    GROUP BY a.duracao
    ORDER BY "totalMinutos" DESC, quantidade DESC
    LIMIT 12
  `;

  const porTurnoSql = `
    WITH base AS (
      SELECT
        a.duracao::int as duracao,
        EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int as hora,
        CASE
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 6 AND 11 THEN 'Manhã'
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 12 AND 17 THEN 'Tarde'
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 18 AND 23 THEN 'Noite'
          ELSE 'Madrugada'
        END as turno,
        CASE
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 6 AND 11 THEN 1
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 12 AND 17 THEN 2
          WHEN EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int BETWEEN 18 AND 23 THEN 3
          ELSE 4
        END as turno_ordem
      FROM "Agendamento" a
      JOIN "Quadra" q ON q.id = a."quadraId"
      WHERE q."pointId" = $1
        AND a.status <> 'CANCELADO'
        AND a."dataHora" >= $2
        AND a."dataHora" <= $3
    )
    SELECT
      turno,
      COUNT(*)::int as quantidade,
      COALESCE(SUM(duracao), 0)::int as "totalMinutos"
    FROM base
    GROUP BY turno, turno_ordem
    ORDER BY turno_ordem
  `;

  const porDiaSemanaSql = `
    SELECT
      EXTRACT(DOW FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int as "diaSemana",
      COUNT(*)::int as quantidade,
      COALESCE(SUM(a.duracao), 0)::int as "totalMinutos"
    FROM "Agendamento" a
    JOIN "Quadra" q ON q.id = a."quadraId"
    WHERE q."pointId" = $1
      AND a.status <> 'CANCELADO'
      AND a."dataHora" >= $2
      AND a."dataHora" <= $3
    GROUP BY 1
    ORDER BY 1
  `;

  const horariosMaisVendidosSql = `
    WITH base AS (
      SELECT
        a.duracao::int as duracao,
        EXTRACT(HOUR FROM (a."dataHora" AT TIME ZONE 'America/Sao_Paulo'))::int as hora
      FROM "Agendamento" a
      JOIN "Quadra" q ON q.id = a."quadraId"
      WHERE q."pointId" = $1
        AND a.status <> 'CANCELADO'
        AND a."dataHora" >= $2
        AND a."dataHora" <= $3
    )
    SELECT
      hora,
      COUNT(*)::int as quantidade,
      COALESCE(SUM(duracao), 0)::int as "totalMinutos"
    FROM base
    GROUP BY 1
    ORDER BY "totalMinutos" DESC, quantidade DESC
    LIMIT 12
  `;

  const produtosSql = `
    SELECT
      COALESCE(p.id::text, 'removido') as "produtoId",
      COALESCE(p.nome, '(produto removido)') as nome,
      COALESCE(p.categoria, '') as categoria,
      COALESCE(SUM(i.quantidade), 0)::int as quantidade,
      COALESCE(SUM(i."precoTotal"), 0)::numeric as "valorTotal"
    FROM "ItemCard" i
    JOIN "CardCliente" c ON c.id = i."cardId"
    LEFT JOIN "Produto" p ON p.id = i."produtoId"
    WHERE c."pointId" = $1
      AND c.status <> 'CANCELADO'
      AND i."createdAt" >= $2
      AND i."createdAt" <= $3
    GROUP BY 1, 2, 3
    ORDER BY quantidade DESC, "valorTotal" DESC
    LIMIT 10
  `;

  const comandasKpisSql = `
    SELECT
      COALESCE(SUM(i.quantidade), 0)::int as "totalItens",
      COALESCE(SUM(i."precoTotal"), 0)::numeric as "faturamento"
    FROM "ItemCard" i
    JOIN "CardCliente" c ON c.id = i."cardId"
    WHERE c."pointId" = $1
      AND c.status <> 'CANCELADO'
      AND i."createdAt" >= $2
      AND i."createdAt" <= $3
  `;

  const ticketMedioSql = `
    WITH card_totals AS (
      SELECT
        c.id as "cardId",
        COALESCE(SUM(i."precoTotal"), 0)::numeric as total
      FROM "ItemCard" i
      JOIN "CardCliente" c ON c.id = i."cardId"
      WHERE c."pointId" = $1
        AND c.status <> 'CANCELADO'
        AND i."createdAt" >= $2
        AND i."createdAt" <= $3
      GROUP BY c.id
    )
    SELECT
      COUNT(*)::int as "totalComandas",
      COALESCE(AVG(total), 0)::numeric as "ticketMedio"
    FROM card_totals
  `;

  const faturamentoPorDiaSemanaSql = `
    SELECT
      EXTRACT(DOW FROM (i."createdAt" AT TIME ZONE 'America/Sao_Paulo'))::int as "diaSemana",
      COALESCE(SUM(i."precoTotal"), 0)::numeric as "valorTotal"
    FROM "ItemCard" i
    JOIN "CardCliente" c ON c.id = i."cardId"
    WHERE c."pointId" = $1
      AND c.status <> 'CANCELADO'
      AND i."createdAt" >= $2
      AND i."createdAt" <= $3
    GROUP BY 1
    ORDER BY 1
  `;

  await runOne('kpisAgendamento', kpisAgendamentoSql, params);
  await runOne('duracaoRanking', duracaoRankingSql, params);
  await runOne('porTurno', porTurnoSql, params);
  await runOne('porDiaSemana', porDiaSemanaSql, params);
  await runOne('horariosMaisVendidos', horariosMaisVendidosSql, params);
  await runOne('produtos', produtosSql, params);
  await runOne('comandasKpis', comandasKpisSql, params);
  await runOne('ticketMedio', ticketMedioSql, params);
  await runOne('faturamentoPorDiaSemana', faturamentoPorDiaSemanaSql, params);
}

main()
  .catch(() => process.exitCode = 1)
  .finally(async () => {
    await pool.end();
  });

