// app/api/partida/listarPartidas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarPartidas } from '@/lib/partidaService';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const partidas = await listarPartidas();

    // Otimização: Buscar todas as panelinhas de uma vez usando uma única query
    // Em vez de fazer N queries (uma para cada partida), fazemos apenas 1 query
    const partidasIds = partidas.map((p: any) => p.id);
    
    let panelinhasPorPartida: Record<string, any[]> = {};
    
    if (partidasIds.length > 0) {
      // Buscar todas as panelinhas vinculadas às partidas em uma única query
      const panelinhasResult = await query(
        `SELECT 
          pp."partidaId",
          pp."panelinhaId",
          p.nome as "panelinhaNome",
          p."esporte" as "panelinhaEsporte"
        FROM "PartidaPanelinha" pp
        INNER JOIN "Panelinha" p ON pp."panelinhaId" = p.id
        WHERE pp."partidaId" = ANY($1::text[])`,
        [partidasIds]
      );

      // Agrupar panelinhas por partidaId
      panelinhasPorPartida = panelinhasResult.rows.reduce((acc: Record<string, any[]>, row: any) => {
        if (!acc[row.partidaId]) {
          acc[row.partidaId] = [];
        }
        acc[row.partidaId].push({
          id: row.panelinhaId,
          nome: row.panelinhaNome,
          esporte: row.panelinhaEsporte,
        });
        return acc;
      }, {});
    }

    // Mapear partidas com suas panelinhas (ou array vazio se não tiver)
    const partidasComPanelinhas = partidas.map((partida: any) => ({
      ...partida,
      createdById: partida.createdById || null,
      criadorNome: partida.criadorNome || null,
      criadorEmail: partida.criadorEmail || null,
      panelinhas: panelinhasPorPartida[partida.id] || [],
    }));

    const response = NextResponse.json(
      partidasComPanelinhas,
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



