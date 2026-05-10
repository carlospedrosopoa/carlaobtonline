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
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      'SELECT 1 AS ok, current_database() AS database_name, NOW() AS server_time'
    );

    const row = result.rows[0];

    const response = NextResponse.json(
      {
        ok: true,
        mensagem: 'Conexao com banco validada com sucesso',
        databaseName: row?.database_name ?? null,
        serverTime: row?.server_time ?? null,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    return withCors(response, request);
  } catch (error: any) {
    console.error('[ADMIN DB PING] Erro ao validar conexao com banco:', error);

    const errorResponse = NextResponse.json(
      {
        ok: false,
        mensagem: 'Erro ao validar conexao com banco',
        error: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    );

    return withCors(errorResponse, request);
  }
}
