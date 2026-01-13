import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

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
    const q = (searchParams.get('q') || '').trim();
    const pointIdParam = searchParams.get('pointId');

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

    const qLower = q.toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    const baseWhere = `WHERE (a."pointIdPrincipal" = $1 OR ap."pointId" IS NOT NULL)`;
    const filtroBusca = q
      ? ` AND (
        LOWER(a.nome) LIKE $2 OR
        LOWER(u.email) LIKE $2 OR
        REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') LIKE $3
      )`
      : '';

    const sqlComAtletaPoint = `SELECT
      a.id, a.nome, a.fone, a."usuarioId",
      u.name as "usuarioName", u.email as "usuarioEmail"
    FROM "Atleta" a
    LEFT JOIN "User" u ON u.id = a."usuarioId"
    LEFT JOIN "AtletaPoint" ap ON ap."atletaId" = a.id AND ap."pointId" = $1
    ${baseWhere}
    ${filtroBusca}
    ORDER BY a.nome ASC
    LIMIT 30`;

    const sqlSemAtletaPoint = `SELECT
      a.id, a.nome, a.fone, a."usuarioId",
      u.name as "usuarioName", u.email as "usuarioEmail"
    FROM "Atleta" a
    LEFT JOIN "User" u ON u.id = a."usuarioId"
    WHERE a."pointIdPrincipal" = $1
    ${q ? ` AND (
      LOWER(a.nome) LIKE $2 OR
      LOWER(u.email) LIKE $2 OR
      REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') LIKE $3
    )` : ''}
    ORDER BY a.nome ASC
    LIMIT 30`;

    const params = q
      ? [pointId, `%${qLower}%`, `%${qDigits}%`]
      : [pointId];

    let result;
    try {
      result = await query(sqlComAtletaPoint, params);
    } catch (err: any) {
      if (err?.code === '42P01' || String(err?.message || '').includes('AtletaPoint')) {
        result = await query(sqlSemAtletaPoint, params);
      } else {
        throw err;
      }
    }

    const atletas = result.rows.map((row: any) => ({
      id: row.id,
      nome: row.nome,
      fone: row.fone || null,
      usuarioId: row.usuarioId || null,
      usuario: row.usuarioId ? {
        id: row.usuarioId,
        name: row.usuarioName || null,
        email: row.usuarioEmail || null,
      } : null,
    }));

    return withCors(NextResponse.json(atletas), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao buscar atletas', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}

