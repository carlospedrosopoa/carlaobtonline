import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

function parseIso(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');

    const dataInicio = parseIso(dataInicioParam);
    const dataFim = parseIso(dataFimParam);
    if (!dataInicio || !dataFim) {
      return withCors(NextResponse.json({ mensagem: 'dataInicio e dataFim são obrigatórios (ISO)' }, { status: 400 }), request);
    }

    let pointId: string | null = null;
    if (usuario.role === 'ORGANIZER') {
      pointId = usuario.pointIdGestor || null;
    } else {
      pointId = pointIdParam || null;
    }

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

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

    const params = [pointId, dataInicio.toISOString(), dataFim.toISOString()];

    const [kpisAg, duracoes, turnos, dows, horarios, topProdutos, kpisComandas, ticketMedio, fatDows] = await Promise.all([
      query(kpisAgendamentoSql, params),
      query(duracaoRankingSql, params),
      query(porTurnoSql, params),
      query(porDiaSemanaSql, params),
      query(horariosMaisVendidosSql, params),
      query(produtosSql, params),
      query(comandasKpisSql, params),
      query(ticketMedioSql, params),
      query(faturamentoPorDiaSemanaSql, params),
    ]);

    const ag = kpisAg.rows?.[0] || { total: 0, totalMinutos: 0 };
    const kc = kpisComandas.rows?.[0] || { totalItens: 0, faturamento: 0 };
    const tm = ticketMedio.rows?.[0] || { totalComandas: 0, ticketMedio: 0 };

    const payload = {
      periodo: {
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      },
      agendamentos: {
        total: Number(ag.total) || 0,
        totalMinutos: Number(ag.totalMinutos) || 0,
        duracaoRanking: duracoes.rows.map((r: any) => ({
          duracao: Number(r.duracao) || 0,
          quantidade: Number(r.quantidade) || 0,
          totalMinutos: Number(r.totalMinutos) || 0,
        })),
        porTurno: turnos.rows.map((r: any) => ({
          turno: String(r.turno),
          quantidade: Number(r.quantidade) || 0,
          totalMinutos: Number(r.totalMinutos) || 0,
        })),
        porDiaSemana: dows.rows.map((r: any) => ({
          diaSemana: Number(r.diaSemana) || 0,
          quantidade: Number(r.quantidade) || 0,
          totalMinutos: Number(r.totalMinutos) || 0,
        })),
        horariosMaisVendidos: horarios.rows.map((r: any) => ({
          hora: Number(r.hora) || 0,
          quantidade: Number(r.quantidade) || 0,
          totalMinutos: Number(r.totalMinutos) || 0,
        })),
      },
      comandas: {
        totalItens: Number(kc.totalItens) || 0,
        faturamento: Number(kc.faturamento) || 0,
        totalComandas: Number(tm.totalComandas) || 0,
        ticketMedio: Number(tm.ticketMedio) || 0,
        faturamentoPorDiaSemana: fatDows.rows.map((r: any) => ({
          diaSemana: Number(r.diaSemana) || 0,
          valorTotal: Number(r.valorTotal) || 0,
        })),
        topProdutos: topProdutos.rows.map((r: any) => ({
          produtoId: String(r.produtoId),
          nome: String(r.nome),
          categoria: String(r.categoria || ''),
          quantidade: Number(r.quantidade) || 0,
          valorTotal: Number(r.valorTotal) || 0,
        })),
      },
    };

    return withCors(NextResponse.json(payload), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao carregar dashboard operacional', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}

