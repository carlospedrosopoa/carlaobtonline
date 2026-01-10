// app/api/user/panelinha/[id]/jogos/[jogoId]/route.ts - Deletar jogo da panelinha
// DELETE: Remover jogo da panelinha (apenas criador)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';
import { recalcularRankingCompleto } from '@/lib/rankingPanelinhaService';

// DELETE /api/user/panelinha/[id]/jogos/[jogoId] - Deletar jogo da panelinha
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jogoId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id: panelinhaId, jogoId } = await params;

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe
    const panelinhaCheck = await query(
      `SELECT p.id, p."atletaIdCriador"
       FROM "Panelinha" p
       WHERE p.id = $1`,
      [panelinhaId]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o jogo existe e buscar informações da partida
    const partidaCheck = await query(
      `SELECT p.id, p."createdById", p."atleta1Id", p."atleta2Id", p."atleta3Id", p."atleta4Id"
       FROM "Partida" p
       WHERE p.id = $1`,
      [jogoId]
    );

    if (partidaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Jogo não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const partida = partidaCheck.rows[0];
    
    // Verificar se o atleta é o criador da partida OU o criador da panelinha
    const atletaEhCriadorPartida = partida.createdById === user.id;
    const atletaEhCriadorPanelinha = panelinhaCheck.rows[0].atletaIdCriador === atleta.id;
    
    if (!atletaEhCriadorPartida && !atletaEhCriadorPanelinha) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas o criador do jogo ou o criador da panelinha podem deletar jogos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o jogo está vinculado à panelinha
    const jogoCheck = await query(
      `SELECT pp.id
       FROM "PartidaPanelinha" pp
       WHERE pp."partidaId" = $1 AND pp."panelinhaId" = $2`,
      [jogoId, panelinhaId]
    );

    if (jogoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Jogo não encontrado nesta panelinha' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Remover vínculo entre partida e panelinha
    await query(
      `DELETE FROM "PartidaPanelinha"
       WHERE "partidaId" = $1 AND "panelinhaId" = $2`,
      [jogoId, panelinhaId]
    );

    // Verificar se a partida ainda está vinculada a outras panelinhas
    const outrasPanelinhas = await query(
      `SELECT COUNT(*) as total
       FROM "PartidaPanelinha"
       WHERE "partidaId" = $1`,
      [jogoId]
    );

    // Se não estiver vinculada a nenhuma panelinha, deletar a partida também
    if (parseInt(outrasPanelinhas.rows[0].total) === 0) {
      // Deletar a partida (o ranking será recalculado abaixo)
      await query(
        `DELETE FROM "Partida"
         WHERE id = $1`,
        [jogoId]
      );
    }

    // Recalcular ranking da panelinha após deletar o jogo
    try {
      await recalcularRankingCompleto(panelinhaId);
    } catch (error: any) {
      console.error('[DELETE JOGO] Erro ao recalcular ranking:', error);
      // Não falha a deleção se o ranking falhar
    }

    const response = NextResponse.json({
      mensagem: 'Jogo deletado com sucesso',
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[DELETE JOGO] Erro ao deletar jogo:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao deletar jogo',
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

