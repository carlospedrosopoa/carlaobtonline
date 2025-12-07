// app/api/point/public/route.ts - Rota pública para listar arenas assinantes (frontend externo)
// Retorna apenas informações públicas de arenas assinantes e ativas, sem dados sensíveis
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

// GET /api/point/public - Listar arenas assinantes ativas (público, sem autenticação)
// IMPORTANTE: Esta rota retorna apenas arenas que são assinantes (assinante = true) e estão ativas
export async function GET(request: NextRequest) {
  try {
    // Retornar apenas campos públicos (sem tokens WhatsApp, etc)
    // Filtrar apenas arenas assinantes e ativas
    const result = await query(
      `SELECT 
        id, nome, endereco, telefone, email, descricao, "logoUrl", 
        latitude, longitude, ativo, assinante
      FROM "Point"
      WHERE assinante = true AND ativo = true
      ORDER BY nome ASC`
    );

    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar arenas públicas:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar arenas', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

