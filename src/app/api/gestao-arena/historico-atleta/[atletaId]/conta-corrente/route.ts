import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

async function obterAtletaDaArena(atletaId: string, pointId: string) {
  const sqlComAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId"
    FROM "Atleta" a
    LEFT JOIN "AtletaPoint" ap ON ap."atletaId" = a.id AND ap."pointId" = $2
    WHERE a.id = $1 AND (a."pointIdPrincipal" = $2 OR ap."pointId" IS NOT NULL)
    LIMIT 1`;
  const sqlSemAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId"
    FROM "Atleta" a
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
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

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

    const contaResult = await query(
      'SELECT id, saldo FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2 LIMIT 1',
      [atleta.usuarioId, pointId]
    );

    if (contaResult.rows.length === 0) {
      return withCors(NextResponse.json({ saldo: 0, movimentacoes: [] }), request);
    }

    const contaCorrenteId = contaResult.rows[0].id as string;
    const saldo = parseFloat(contaResult.rows[0].saldo);

    const values: any[] = [contaCorrenteId];
    let where = 'WHERE m."contaCorrenteId" = $1';
    if (dataInicio) {
      where += ` AND m."createdAt" >= $${values.length + 1}`;
      values.push(dataInicio);
    }
    if (dataFim) {
      where += ` AND m."createdAt" <= $${values.length + 1}`;
      values.push(dataFim);
    }
    values.push(limit);
    values.push(offset);

    const sql = `SELECT
      m.id, m.tipo, m.valor, m.justificativa, m."pagamentoCardId", m."createdAt",
      u.id as "createdBy_id", u.name as "createdBy_name", u.email as "createdBy_email",
      pc.id as "pagamento_id",
      c.id as "card_id", c."numeroCard" as "card_numero"
    FROM "MovimentacaoContaCorrente" m
    LEFT JOIN "User" u ON u.id = m."createdById"
    LEFT JOIN "PagamentoCard" pc ON pc.id = m."pagamentoCardId"
    LEFT JOIN "CardCliente" c ON c.id = pc."cardId"
    ${where}
    ORDER BY m."createdAt" DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const movResult = await query(sql, values);
    const movimentacoes = movResult.rows.map((row: any) => ({
      id: row.id,
      tipo: row.tipo,
      valor: parseFloat(row.valor),
      justificativa: row.justificativa,
      pagamentoCardId: row.pagamentoCardId || null,
      createdAt: row.createdAt,
      createdBy: row.createdBy_id ? {
        id: row.createdBy_id,
        name: row.createdBy_name,
        email: row.createdBy_email,
      } : null,
      card: row.card_id ? { id: row.card_id, numeroCard: row.card_numero } : null,
    }));

    return withCors(NextResponse.json({ saldo, movimentacoes }), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao listar conta corrente', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}

