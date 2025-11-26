// app/api/partida/[id]/route.ts - Rotas para atualizar partida
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { atualizarPlacar, buscarPartidaPorId } from '@/lib/partidaService';

// PUT /api/partida/[id] - Atualizar placar da partida
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { id } = await params;
    const body = await request.json();
    const {
      gamesTime1,
      gamesTime2,
      tiebreakTime1,
      tiebreakTime2,
    } = body;

    // Verificar se a partida existe
    const partida = await buscarPartidaPorId(id);
    if (!partida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Partida não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o usuário tem permissão para atualizar esta partida
    // Um usuário só pode atualizar placar de partidas onde ele participa
    const { user } = authResult;
    const atletaIds = [
      partida.atleta1?.id,
      partida.atleta2?.id,
      partida.atleta3?.id,
      partida.atleta4?.id,
    ].filter(Boolean);

    // Se o usuário não é ADMIN, verificar se ele participa da partida
    if (user.role !== 'ADMIN') {
      // Buscar o atleta do usuário
      const { query } = await import('@/lib/db');
      const atletaResult = await query(
        'SELECT id FROM "Atleta" WHERE "usuarioId" = $1',
        [user.id]
      );

      if (atletaResult.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você precisa ter um perfil de atleta para atualizar placar' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }

      const atletaIdUsuario = atletaResult.rows[0].id;
      if (!atletaIds.includes(atletaIdUsuario)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para atualizar o placar desta partida' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Validar valores do placar
    if (gamesTime1 !== null && gamesTime1 !== undefined && (isNaN(gamesTime1) || gamesTime1 < 0)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'gamesTime1 deve ser um número não negativo' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (gamesTime2 !== null && gamesTime2 !== undefined && (isNaN(gamesTime2) || gamesTime2 < 0)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'gamesTime2 deve ser um número não negativo' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (tiebreakTime1 !== null && tiebreakTime1 !== undefined && (isNaN(tiebreakTime1) || tiebreakTime1 < 0)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'tiebreakTime1 deve ser um número não negativo' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (tiebreakTime2 !== null && tiebreakTime2 !== undefined && (isNaN(tiebreakTime2) || tiebreakTime2 < 0)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'tiebreakTime2 deve ser um número não negativo' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar placar
    const partidaAtualizada = await atualizarPlacar(id, {
      gamesTime1: gamesTime1 !== undefined ? gamesTime1 : null,
      gamesTime2: gamesTime2 !== undefined ? gamesTime2 : null,
      tiebreakTime1: tiebreakTime1 !== undefined ? tiebreakTime1 : null,
      tiebreakTime2: tiebreakTime2 !== undefined ? tiebreakTime2 : null,
    });

    const response = NextResponse.json(partidaAtualizada);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar placar:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar placar', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

