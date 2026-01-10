// app/api/user/panelinha/[id]/ranking/route.ts - Ranking da panelinha
// GET: Obter ranking completo da panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';
import { buscarRankingPanelinha, recalcularRankingCompleto } from '@/lib/rankingPanelinhaService';

// GET /api/user/panelinha/[id]/ranking - Obter ranking da panelinha
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id: panelinhaId } = await params;

    // Se for ORGANIZER, verificar acesso através da arena
    if (user.role === 'ORGANIZER' && user.pointIdGestor) {
      // Verificar se a panelinha tem membros da arena do ORGANIZER
      const panelinhaCheck = await query(
        `SELECT p.id, p."atletaIdCriador"
         FROM "Panelinha" p
         WHERE p.id = $1
         AND EXISTS (
           SELECT 1 
           FROM "PanelinhaAtleta" pa
           INNER JOIN "Atleta" a ON pa."atletaId" = a.id
           WHERE pa."panelinhaId" = p.id
           AND a."pointIdPrincipal" = $2
         )`,
        [panelinhaId, user.pointIdGestor]
      );

      if (panelinhaCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Panelinha não encontrada ou você não tem acesso a esta panelinha' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }
      // ORGANIZER tem acesso - continuar para buscar ranking
    } else {
      // Para USER: buscar atleta e verificar acesso normalmente
      const atleta = await verificarAtletaUsuario(user.id);
      if (!atleta) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você ainda não possui um perfil de atleta' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      // Verificar se a panelinha existe e se o atleta é membro ou criador
      const panelinhaCheck = await query(
        `SELECT p.id, p."atletaIdCriador",
           EXISTS(
             SELECT 1 FROM "PanelinhaAtleta" pa 
             WHERE pa."panelinhaId" = p.id AND pa."atletaId" = $1
           ) as "ehMembro"
         FROM "Panelinha" p
         WHERE p.id = $2`,
        [atleta.id, panelinhaId]
      );

      if (panelinhaCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Panelinha não encontrada' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      const ehMembro = panelinhaCheck.rows[0].ehMembro;
      const ehCriador = panelinhaCheck.rows[0].atletaIdCriador === atleta.id;

      // Debug: log para verificar valores
      if (process.env.NODE_ENV === 'development') {
        console.log('[RANKING] Verificação de acesso:', {
          atletaId: atleta.id,
          panelinhaId,
          ehMembro,
          ehCriador,
          atletaIdCriador: panelinhaCheck.rows[0].atletaIdCriador,
        });
      }

      // Permitir acesso se for membro OU criador
      if (!ehMembro && !ehCriador) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para ver o ranking desta panelinha. Você precisa ser membro ou criador da panelinha.' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Buscar ranking
    const rankingRaw = await buscarRankingPanelinha(panelinhaId);

    // Transformar ranking no formato esperado pelo frontend
    const ranking = rankingRaw.map((r, index) => {
      const totalJogos = r.vitorias + r.derrotas;
      const porcentagemVitorias = totalJogos > 0 
        ? (r.vitorias / totalJogos) * 100 
        : 0;

      return {
        id: r.id,
        panelinhaId: r.panelinhaId,
        atletaId: r.atletaId,
        pontuacao: r.pontuacao || 0,
        vitorias: r.vitorias || 0,
        derrotas: r.derrotas || 0,
        derrotasTieBreak: r.derrotasTieBreak || 0,
        partidasJogadas: r.partidasJogadas || totalJogos,
        saldoGames: (r.gamesFeitos || 0) - (r.gamesSofridos || 0),
        gamesFeitos: r.gamesFeitos || 0,
        gamesSofridos: r.gamesSofridos || 0,
        posicao: r.posicao || index + 1,
        ultimaAtualizacao: r.ultimaAtualizacao?.toISOString() || new Date().toISOString(),
        atleta: {
          id: r.atleta?.id || r.atletaId,
          nome: r.atleta?.nome || 'Atleta Desconhecido',
          fotoUrl: r.atleta?.fotoUrl,
        },
      };
    });

    const response = NextResponse.json({ ranking });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[RANKING] Erro ao obter ranking:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao obter ranking',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/user/panelinha/[id]/ranking/recalcular - Recalcular ranking (apenas criador)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id: panelinhaId } = await params;

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se é o criador
    const panelinhaCheck = await query(
      'SELECT "atletaIdCriador" FROM "Panelinha" WHERE id = $1',
      [panelinhaId]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (panelinhaCheck.rows[0].atletaIdCriador !== atleta.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas o criador da panelinha pode recalcular o ranking' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Recalcular ranking completo (do zero, baseado em todas as partidas)
    await recalcularRankingCompleto(panelinhaId);

    // Buscar ranking atualizado
    const rankingRaw = await buscarRankingPanelinha(panelinhaId);

    // Transformar ranking no formato esperado pelo frontend
    const ranking = rankingRaw.map((r, index) => {
      const totalJogos = r.vitorias + r.derrotas;
      const porcentagemVitorias = totalJogos > 0 
        ? (r.vitorias / totalJogos) * 100 
        : 0;

      return {
        id: r.id,
        panelinhaId: r.panelinhaId,
        atletaId: r.atletaId,
        pontuacao: r.pontuacao || 0,
        vitorias: r.vitorias || 0,
        derrotas: r.derrotas || 0,
        derrotasTieBreak: r.derrotasTieBreak || 0,
        partidasJogadas: r.partidasJogadas || totalJogos,
        saldoGames: (r.gamesFeitos || 0) - (r.gamesSofridos || 0),
        gamesFeitos: r.gamesFeitos || 0,
        gamesSofridos: r.gamesSofridos || 0,
        posicao: r.posicao || index + 1,
        ultimaAtualizacao: r.ultimaAtualizacao?.toISOString() || new Date().toISOString(),
        atleta: {
          id: r.atleta?.id || r.atletaId,
          nome: r.atleta?.nome || 'Atleta Desconhecido',
          fotoUrl: r.atleta?.fotoUrl,
        },
      };
    });

    const response = NextResponse.json({ 
      mensagem: 'Ranking recalculado com sucesso',
      ranking 
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[RANKING] Erro ao recalcular ranking:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao recalcular ranking',
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

