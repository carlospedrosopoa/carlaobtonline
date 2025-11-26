// app/api/atleta/listarAtletasPaginados/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarAtletasPaginados } from '@/lib/atletaService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const busca = searchParams.get('busca') || '';
    const pagina = parseInt(searchParams.get('pagina') || '1', 10) || 1;
    const limite = parseInt(searchParams.get('limite') || '10', 10) || 10;

    const atletas = await listarAtletasPaginados(busca, pagina, limite);

    const response = NextResponse.json(atletas);
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao buscar atletas paginados:', error);
    const errorResponse = NextResponse.json(
      { error: "Erro ao buscar atletas" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



