// app/api/partida/[id]/route.ts - Rotas para atualizar partida
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { atualizarPlacar, buscarPartidaPorId } from '@/lib/partidaService';
import { recalcularRankingCompleto } from '@/lib/rankingPanelinhaService';
import { query } from '@/lib/db';

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
    // ADMIN: pode atualizar qualquer partida
    // ORGANIZER: pode atualizar partidas vinculadas a panelinhas da sua arena
    // USER: só pode atualizar partidas onde ele participa
    const { user } = authResult;
    const atletaIds = [
      partida.atleta1?.id,
      partida.atleta2?.id,
      partida.atleta3?.id,
      partida.atleta4?.id,
    ].filter(Boolean);

    // Se o usuário não é ADMIN, verificar permissões
    if (user.role !== 'ADMIN') {
      // ORGANIZER: verificar se a partida está vinculada a uma panelinha da sua arena
      if (user.role === 'ORGANIZER' && user.pointIdGestor) {
        // Verificar se a partida está vinculada a uma panelinha que tem membros da arena
        const partidaCheck = await query(
          `SELECT 1
           FROM "PartidaPanelinha" pp
           INNER JOIN "Panelinha" p ON pp."panelinhaId" = p.id
           INNER JOIN "PanelinhaAtleta" pa ON p.id = pa."panelinhaId"
           INNER JOIN "Atleta" a ON pa."atletaId" = a.id
           WHERE pp."partidaId" = $1
           AND a."pointIdPrincipal" = $2
           LIMIT 1`,
          [id, user.pointIdGestor]
        );

        if (partidaCheck.rows.length === 0) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Você não tem permissão para atualizar o placar desta partida' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
        // ORGANIZER tem acesso - continuar
      } else {
        // USER: verificar se ele participa da partida
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

    // Verificar se a partida tinha placar anterior
    const tinhaPlacarAnterior = partida.gamesTime1 !== null && partida.gamesTime2 !== null;
    const teraPlacarNovo = gamesTime1 !== null && gamesTime2 !== null && 
                          gamesTime1 !== undefined && gamesTime2 !== undefined;
    const placarMudou = tinhaPlacarAnterior && teraPlacarNovo && 
                       (partida.gamesTime1 !== gamesTime1 || partida.gamesTime2 !== gamesTime2 ||
                        partida.tiebreakTime1 !== tiebreakTime1 || partida.tiebreakTime2 !== tiebreakTime2);

    // Atualizar placar
    const partidaAtualizada = await atualizarPlacar(id, {
      gamesTime1: gamesTime1 !== undefined ? gamesTime1 : null,
      gamesTime2: gamesTime2 !== undefined ? gamesTime2 : null,
      tiebreakTime1: tiebreakTime1 !== undefined ? tiebreakTime1 : null,
      tiebreakTime2: tiebreakTime2 !== undefined ? tiebreakTime2 : null,
    });

    // Se a partida tem placar e está vinculada a panelinhas, atualizar rankings
    if (teraPlacarNovo || placarMudou) {
      try {
        // Buscar todas as panelinhas vinculadas a esta partida
        const panelinhasResult = await query(
          'SELECT "panelinhaId" FROM "PartidaPanelinha" WHERE "partidaId" = $1',
          [id]
        );

        // Recalcular ranking completo de cada panelinha (mais seguro quando placar muda)
        for (const row of panelinhasResult.rows) {
          try {
            await recalcularRankingCompleto(row.panelinhaId);
          } catch (error: any) {
            console.error(`[PARTIDA] Erro ao recalcular ranking da panelinha ${row.panelinhaId}:`, error);
            // Não falha a atualização do placar se o ranking falhar
          }
        }
      } catch (error: any) {
        console.error('[PARTIDA] Erro ao buscar panelinhas da partida:', error);
        // Não falha a atualização do placar se não conseguir atualizar rankings
      }
    }

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

// DELETE /api/partida/[id] - Deletar partida (apenas criador)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id } = await params;

    // Verificar se a partida existe e buscar informações
    const partidaCheck = await query(
      `SELECT p.id, p."createdById", p."atleta1Id", p."atleta2Id", p."atleta3Id", p."atleta4Id"
       FROM "Partida" p
       WHERE p.id = $1`,
      [id]
    );

    if (partidaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Partida não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const partida = partidaCheck.rows[0];

    // Verificar permissões
    // ADMIN: pode deletar qualquer partida
    // ORGANIZER: pode deletar partidas vinculadas a panelinhas da sua arena
    // USER: só pode deletar partidas que ele criou
    if (user.role !== 'ADMIN') {
      if (user.role === 'ORGANIZER' && user.pointIdGestor) {
        // Verificar se a partida está vinculada a uma panelinha que tem membros da arena
        const partidaCheck = await query(
          `SELECT 1
           FROM "PartidaPanelinha" pp
           INNER JOIN "Panelinha" p ON pp."panelinhaId" = p.id
           INNER JOIN "PanelinhaAtleta" pa ON p.id = pa."panelinhaId"
           INNER JOIN "Atleta" a ON pa."atletaId" = a.id
           WHERE pp."partidaId" = $1
           AND a."pointIdPrincipal" = $2
           LIMIT 1`,
          [id, user.pointIdGestor]
        );

        if (partidaCheck.rows.length === 0) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Você não tem permissão para deletar esta partida' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
        // ORGANIZER tem acesso - continuar
      } else {
        // USER: verificar se ele criou a partida
        if (partida.createdById !== user.id) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Apenas o criador da partida pode deletá-la' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
      }
    }

    // Buscar todas as panelinhas vinculadas a esta partida para recalcular rankings
    const panelinhasResult = await query(
      'SELECT "panelinhaId" FROM "PartidaPanelinha" WHERE "partidaId" = $1',
      [id]
    );

    // Remover vínculos com panelinhas
    await query(
      'DELETE FROM "PartidaPanelinha" WHERE "partidaId" = $1',
      [id]
    );

    // Deletar a partida
    await query(
      'DELETE FROM "Partida" WHERE id = $1',
      [id]
    );

    // Recalcular ranking de cada panelinha que tinha esta partida
    for (const row of panelinhasResult.rows) {
      try {
        await recalcularRankingCompleto(row.panelinhaId);
      } catch (error: any) {
        console.error(`[DELETE PARTIDA] Erro ao recalcular ranking da panelinha ${row.panelinhaId}:`, error);
        // Não falha a deleção se o ranking falhar
      }
    }

    const response = NextResponse.json({
      mensagem: 'Partida deletada com sucesso',
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar partida:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao deletar partida',
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

