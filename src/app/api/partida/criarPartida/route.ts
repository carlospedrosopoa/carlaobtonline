// app/api/partida/criarPartida/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { criarPartida } from '@/lib/partidaService';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const {
      data,
      local,
      atleta1Id,
      atleta2Id,
      atleta3Id,
      atleta4Id,
      gamesTime1,
      gamesTime2,
      tiebreakTime1,
      tiebreakTime2,
    } = body;

    if (!atleta1Id || !atleta2Id) {
      return NextResponse.json(
        { error: "Atleta1Id e Atleta2Id são obrigatórios" },
        { status: 400 }
      );
    }

    const novaPartida = await criarPartida({
      data,
      local,
      atleta1Id,
      atleta2Id,
      atleta3Id: atleta3Id || null,
      atleta4Id: atleta4Id || null,
      gamesTime1: gamesTime1 || null,
      gamesTime2: gamesTime2 || null,
      tiebreakTime1: tiebreakTime1 || null,
      tiebreakTime2: tiebreakTime2 || null,
    });

    return NextResponse.json(
      novaPartida,
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar partida:', error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar partida" },
      { status: 500 }
    );
  }
}

