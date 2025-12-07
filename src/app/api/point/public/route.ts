// app/api/point/public/route.ts - Rota pública para listar arenas (frontend externo)
// Retorna apenas informações públicas, sem dados sensíveis
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

// GET /api/point/public - Listar arenas ativas (público, sem autenticação)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get('apenasAtivos') !== 'false'; // Por padrão, apenas ativos
    
    const whereClause = apenasAtivos ? 'WHERE ativo = true' : '';
    
    // Retornar apenas campos públicos (sem tokens WhatsApp, etc)
    const result = await query(
      `SELECT 
        id, nome, endereco, telefone, email, descricao, "logoUrl", 
        latitude, longitude, ativo, assinante
      FROM "Point"
      ${whereClause}
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

