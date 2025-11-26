// app/api/atleta/listarAtletas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarAtletas } from '@/lib/atletaService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const resultado = await listarAtletas(user);

    const response = NextResponse.json(
      resultado,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao listar atletas:', error);
    const errorResponse = NextResponse.json(
      { erro: "Erro ao listar atletas." },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



