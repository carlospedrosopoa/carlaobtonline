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
    const status = searchParams.get('status');
    const nome = searchParams.get('nome');

    if (!sourcePointId) {
      const errorResponse = NextResponse.json({ mensagem: 'sourcePointId é obrigatório' }, { status: 400 });
      return withCors(errorResponse, request);
    }

    let sql = `
      SELECT
        c.id,
        c.nome,
        c.tipo,
        c.formato,
        c.status,
        c."dataInicio",
        c."dataFim",
        c."createdAt",
        (SELECT COUNT(*)::int FROM "JogoCompeticao" j WHERE j."competicaoId" = c.id) as "jogosCount",
        (SELECT COUNT(*)::int FROM "JogoCompeticao" j WHERE j."competicaoId" = c.id AND j.status = 'CONCLUIDO') as "jogosConcluidosCount",
        (SELECT COUNT(*)::int FROM "AtletaCompeticao" ac WHERE ac."competicaoId" = c.id) as "inscritosCount"
      FROM "Competicao" c
      WHERE c."pointId" = $1
    `;

    const params: any[] = [sourcePointId];
    let pc = 2;

    if (status) {
      sql += ` AND c.status = $${pc}`;
      params.push(status);
      pc++;
    }

    if (nome) {
      sql += ` AND c.nome ILIKE $${pc}`;
      params.push(`%${nome}%`);
      pc++;
    }

    sql += ` ORDER BY c."createdAt" DESC`;

    const result = await query(sql, params);
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar competições', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

