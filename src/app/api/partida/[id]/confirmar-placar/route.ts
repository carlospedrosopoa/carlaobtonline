// app/api/partida/[id]/confirmar-placar/route.ts - Confirmar placar da partida
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarPartidaPorId, confirmarPlacar } from '@/lib/partidaService';

// POST /api/partida/[id]/confirmar-placar - Confirmar placar (apenas criador)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { id } = await params;
    const { user } = authResult;

    // Verificar se a partida existe
    const partida = await buscarPartidaPorId(id);
    if (!partida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Partida não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o usuário é o criador da partida
    if (user.role !== 'ADMIN' && partida.createdById !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas o criador da partida pode confirmar o placar' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Confirmar placar
    const partidaAtualizada = await confirmarPlacar(id, user.id);

    const response = NextResponse.json({
      mensagem: 'Placar confirmado com sucesso',
      partida: partidaAtualizada,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao confirmar placar:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: error.message || 'Erro ao confirmar placar',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

