// app/api/user/panelinha/[id]/jogos/route.ts - Jogos da panelinha
// GET: Listar jogos da panelinha
// POST: Criar jogo na panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';
import { criarPartida } from '@/lib/partidaService';
import { atualizarRankingAposPartida } from '@/lib/rankingPanelinhaService';

// GET /api/user/panelinha/[id]/jogos - Listar jogos da panelinha
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

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é membro
    const panelinhaCheck = await query(
      `SELECT p.id,
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

    if (!panelinhaCheck.rows[0].ehMembro) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para ver os jogos desta panelinha' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar jogos da panelinha
    const jogosResult = await query(
      `SELECT 
        p.id,
        p.data,
        p.local,
        p."gamesTime1",
        p."gamesTime2",
        p."tiebreakTime1",
        p."tiebreakTime2",
        p."pointId",
        p."createdAt",
        p."updatedAt",
        a1.id as "atleta1Id",
        a1.nome as "atleta1Nome",
        a1."fotoUrl" as "atleta1FotoUrl",
        a2.id as "atleta2Id",
        a2.nome as "atleta2Nome",
        a2."fotoUrl" as "atleta2FotoUrl",
        a3.id as "atleta3Id",
        a3.nome as "atleta3Nome",
        a3."fotoUrl" as "atleta3FotoUrl",
        a4.id as "atleta4Id",
        a4.nome as "atleta4Nome",
        a4."fotoUrl" as "atleta4FotoUrl"
      FROM "Partida" p
      INNER JOIN "PartidaPanelinha" pp ON p.id = pp."partidaId"
      LEFT JOIN "Atleta" a1 ON p."atleta1Id" = a1.id
      LEFT JOIN "Atleta" a2 ON p."atleta2Id" = a2.id
      LEFT JOIN "Atleta" a3 ON p."atleta3Id" = a3.id
      LEFT JOIN "Atleta" a4 ON p."atleta4Id" = a4.id
      WHERE pp."panelinhaId" = $1
      ORDER BY p.data DESC, p."createdAt" DESC`,
      [panelinhaId]
    );

    const jogos = jogosResult.rows.map((row: any) => ({
      id: row.id,
      data: row.data,
      local: row.local,
      pointId: row.pointId || null,
      gamesTime1: row.gamesTime1,
      gamesTime2: row.gamesTime2,
      tiebreakTime1: row.tiebreakTime1,
      tiebreakTime2: row.tiebreakTime2,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      atleta1: row.atleta1Id ? {
        id: row.atleta1Id,
        nome: row.atleta1Nome,
        fotoUrl: row.atleta1FotoUrl,
      } : null,
      atleta2: row.atleta2Id ? {
        id: row.atleta2Id,
        nome: row.atleta2Nome,
        fotoUrl: row.atleta2FotoUrl,
      } : null,
      atleta3: row.atleta3Id ? {
        id: row.atleta3Id,
        nome: row.atleta3Nome,
        fotoUrl: row.atleta3FotoUrl,
      } : null,
      atleta4: row.atleta4Id ? {
        id: row.atleta4Id,
        nome: row.atleta4Nome,
        fotoUrl: row.atleta4FotoUrl,
      } : null,
    }));

    const response = NextResponse.json({ jogos });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[JOGOS PANELINHA] Erro ao listar jogos:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao listar jogos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/user/panelinha/[id]/jogos - Criar jogo na panelinha
export async function POST(
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
    const body = await request.json();
    const { 
      data, 
      local, 
      pointId,
      atleta1Id, 
      atleta2Id, 
      atleta3Id, 
      atleta4Id,
      gamesTime1,
      gamesTime2,
      tiebreakTime1,
      tiebreakTime2,
    } = body;

    // Validações
    if (!data || !local || !atleta1Id || !atleta2Id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Data, local e pelo menos 2 atletas são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é membro
    const panelinhaCheck = await query(
      `SELECT p.id,
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

    if (!panelinhaCheck.rows[0].ehMembro) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar jogos nesta panelinha' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se todos os atletas são membros da panelinha
    const atletasIds = [atleta1Id, atleta2Id, atleta3Id, atleta4Id].filter(Boolean) as string[];
    const membrosCheck = await query(
      `SELECT "atletaId" 
       FROM "PanelinhaAtleta" 
       WHERE "panelinhaId" = $1 AND "atletaId" = ANY($2::text[])`,
      [panelinhaId, atletasIds]
    );

    if (membrosCheck.rows.length !== atletasIds.length) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Todos os atletas devem ser membros da panelinha' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Criar partida
    const partida = await criarPartida({
      data,
      local,
      pointId: pointId || null,
      atleta1Id,
      atleta2Id,
      atleta3Id: atleta3Id || null,
      atleta4Id: atleta4Id || null,
      gamesTime1: gamesTime1 || null,
      gamesTime2: gamesTime2 || null,
      tiebreakTime1: tiebreakTime1 || null,
      tiebreakTime2: tiebreakTime2 || null,
    });

    // Vincular partida à panelinha
    await query(
      `INSERT INTO "PartidaPanelinha" (id, "partidaId", "panelinhaId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, NOW())
       ON CONFLICT ("partidaId", "panelinhaId") DO NOTHING`,
      [partida.id, panelinhaId]
    );

    // Se a partida tem resultado, atualizar ranking
    if (gamesTime1 !== null && gamesTime2 !== null) {
      try {
        await atualizarRankingAposPartida(panelinhaId, partida.id);
      } catch (error: any) {
        console.error('[JOGOS PANELINHA] Erro ao atualizar ranking:', error);
        // Não falha a criação do jogo se o ranking falhar
      }
    }

    const response = NextResponse.json({
      mensagem: 'Jogo criado com sucesso',
      partida,
    }, { status: 201 });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[JOGOS PANELINHA] Erro ao criar jogo:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao criar jogo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/user/panelinha/[id]/jogos/[jogoId] - Deletar jogo da panelinha
// Esta rota será criada em um arquivo separado: [id]/jogos/[jogoId]/route.ts

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}


