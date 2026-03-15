import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;

    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const sourcePointId = searchParams.get('sourcePointId') || '';
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    if (!sourcePointId) {
      const errorResponse = NextResponse.json({ mensagem: 'sourcePointId é obrigatório' }, { status: 400 });
      return withCors(errorResponse, request);
    }

    let sql = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email
      FROM "PagamentoCard" p
      INNER JOIN "CardCliente" c ON p."cardId" = c.id
      INNER JOIN "User" u ON u.id = COALESCE(p."createdById", p."createdBy")
      WHERE c."pointId" = $1
    `;

    const params: any[] = [sourcePointId];
    let pc = 2;

    if (dataInicio) {
      sql += ` AND p."createdAt"::date >= $${pc}`;
      params.push(dataInicio);
      pc++;
    }

    if (dataFim) {
      sql += ` AND p."createdAt"::date <= $${pc}`;
      params.push(dataFim);
      pc++;
    }

    sql += ` ORDER BY u.name ASC`;

    const result = await query(sql, params);
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar operadores', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

