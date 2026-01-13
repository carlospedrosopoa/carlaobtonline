import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parsePeriodo(searchParams: URLSearchParams) {
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  return {
    dataInicio: dataInicio || null,
    dataFim: dataFim || null,
  };
}

async function obterAtletaDaArena(atletaId: string, pointId: string) {
  const sqlComAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId", u.email
    FROM "Atleta" a
    LEFT JOIN "User" u ON u.id = a."usuarioId"
    LEFT JOIN "AtletaPoint" ap ON ap."atletaId" = a.id AND ap."pointId" = $2
    WHERE a.id = $1 AND (a."pointIdPrincipal" = $2 OR ap."pointId" IS NOT NULL)
    LIMIT 1`;

  const sqlSemAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId", u.email
    FROM "Atleta" a
    LEFT JOIN "User" u ON u.id = a."usuarioId"
    WHERE a.id = $1 AND a."pointIdPrincipal" = $2
    LIMIT 1`;

  try {
    const r = await query(sqlComAtletaPoint, [atletaId, pointId]);
    return r.rows[0] || null;
  } catch (err: any) {
    if (err?.code === '42P01' || String(err?.message || '').includes('AtletaPoint')) {
      const r = await query(sqlSemAtletaPoint, [atletaId, pointId]);
      return r.rows[0] || null;
    }
    throw err;
  }
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ atletaId: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { atletaId } = await params;
    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const { dataInicio, dataFim } = parsePeriodo(searchParams);

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

    const atleta = await obterAtletaDaArena(atletaId, pointId);
    if (!atleta) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }
    if (!atleta.usuarioId) {
      return withCors(NextResponse.json({ mensagem: 'Atleta sem usuário vinculado' }, { status: 400 }), request);
    }

    const filtrosDataItem = [pointId, atleta.usuarioId];
    const filtrosDataPagamento = [pointId, atleta.usuarioId];
    const filtrosDataAg = [pointId, atletaId];
    const filtrosDataCC = [pointId, atleta.usuarioId];

    let whereItens = 'WHERE c."pointId" = $1 AND c."usuarioId" = $2';
    let wherePag = 'WHERE c."pointId" = $1 AND c."usuarioId" = $2';
    let whereAg = 'WHERE q."pointId" = $1 AND (a."atletaId" = $2 OR EXISTS (SELECT 1 FROM "AgendamentoAtleta" aa WHERE aa."agendamentoId" = a.id AND aa."atletaId" = $2))';
    let whereCC = 'WHERE cc."pointId" = $1 AND cc."usuarioId" = $2';

    if (dataInicio) {
      whereItens += ` AND i."createdAt" >= $${filtrosDataItem.length + 1}`;
      filtrosDataItem.push(dataInicio);
      wherePag += ` AND p."createdAt" >= $${filtrosDataPagamento.length + 1}`;
      filtrosDataPagamento.push(dataInicio);
      whereAg += ` AND a."dataHora" >= $${filtrosDataAg.length + 1}`;
      filtrosDataAg.push(dataInicio);
    }
    if (dataFim) {
      whereItens += ` AND i."createdAt" <= $${filtrosDataItem.length + 1}`;
      filtrosDataItem.push(dataFim);
      wherePag += ` AND p."createdAt" <= $${filtrosDataPagamento.length + 1}`;
      filtrosDataPagamento.push(dataFim);
      whereAg += ` AND a."dataHora" <= $${filtrosDataAg.length + 1}`;
      filtrosDataAg.push(dataFim);
    }

    const consumoResult = await query(
      `SELECT
        COALESCE(SUM(i."precoTotal"), 0) as total,
        COUNT(i.id) as quantidade
      FROM "ItemCard" i
      INNER JOIN "CardCliente" c ON c.id = i."cardId"
      ${whereItens}`,
      filtrosDataItem
    );

    const pagamentosResult = await query(
      `SELECT
        COALESCE(SUM(p.valor), 0) as total,
        COUNT(p.id) as quantidade
      FROM "PagamentoCard" p
      INNER JOIN "CardCliente" c ON c.id = p."cardId"
      ${wherePag}`,
      filtrosDataPagamento
    );

    const agendamentosResult = await query(
      `SELECT
        COUNT(a.id) as quantidade,
        COALESCE(SUM(COALESCE(a."valorNegociado", a."valorCalculado", 0)), 0) as total
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      ${whereAg}`,
      filtrosDataAg
    );

    const saldoResult = await query(
      `SELECT saldo
      FROM "ContaCorrenteCliente" cc
      ${whereCC}
      LIMIT 1`,
      filtrosDataCC
    );

    const resumo = {
      atleta: {
        id: atleta.id,
        nome: atleta.nome,
        fone: atleta.fone || null,
        usuarioId: atleta.usuarioId,
        email: atleta.email || null,
      },
      consumo: {
        total: parseFloat(consumoResult.rows[0]?.total || 0),
        quantidade: parseInt(consumoResult.rows[0]?.quantidade || 0, 10),
      },
      pagamentos: {
        total: parseFloat(pagamentosResult.rows[0]?.total || 0),
        quantidade: parseInt(pagamentosResult.rows[0]?.quantidade || 0, 10),
      },
      contaCorrente: {
        saldo: saldoResult.rows.length ? parseFloat(saldoResult.rows[0].saldo) : 0,
      },
      agendamentos: {
        total: parseFloat(agendamentosResult.rows[0]?.total || 0),
        quantidade: parseInt(agendamentosResult.rows[0]?.quantidade || 0, 10),
      },
    };

    return withCors(NextResponse.json(resumo), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao carregar resumo', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}

