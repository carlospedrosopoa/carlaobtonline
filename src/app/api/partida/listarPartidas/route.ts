// app/api/partida/listarPartidas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarPartidas } from '@/lib/partidaService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const partidas = await listarPartidas();

    const response = NextResponse.json(
      partidas,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao listar partidas:', error);
    const errorResponse = NextResponse.json(
      { erro: "Erro ao listar partidas" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



