import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT id, nome, "centroLat", "centroLng"
       FROM "Regiao"
       WHERE ativo = true
       ORDER BY nome ASC`
    );

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao listar regiões', error: error.message },
        { status: 500 }
      ),
      request
    );
  }
}
