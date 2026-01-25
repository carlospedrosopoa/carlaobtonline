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

    // Buscar panelinhas vinculadas a cada partida
    const partidasComPanelinhas = await Promise.all(
      partidas.map(async (partida: any) => {
        const panelinhasResult = await query(
          `SELECT 
            pp."panelinhaId",
            p.nome as "panelinhaNome",
            p."esporte" as "panelinhaEsporte"
          FROM "PartidaPanelinha" pp
          INNER JOIN "Panelinha" p ON pp."panelinhaId" = p.id
          WHERE pp."partidaId" = $1`,
          [partida.id]
        );

        return {
          ...partida,
          panelinhas: panelinhasResult.rows.map((row: any) => ({
            id: row.panelinhaId,
            nome: row.panelinhaNome,
            esporte: row.panelinhaEsporte,
          })),
        };
      })
    );

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



