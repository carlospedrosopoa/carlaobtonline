// app/api/card/test/route.ts - Endpoint de teste para geração de card
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { generateMatchCard } from '@/lib/generateCard';
import { PartidaParaCard } from '@/lib/cardService';
import sharp from 'sharp';

export async function GET(request: NextRequest) {
  try {
    console.log('[Card Test] Iniciando teste de geração de card...');
    
    // Criar dados de teste
    const partidaTeste: PartidaParaCard = {
      id: 'test-id',
      data: new Date(),
      local: 'Quadra Central - Arena Teste',
      gamesTime1: 6,
      gamesTime2: 4,
      tiebreakTime1: null,
      tiebreakTime2: null,
      atleta1: {
        id: 'atleta1',
        nome: 'João Silva',
        fotoUrl: null, // Sem foto - vai usar silhueta padrão
      },
      atleta2: {
        id: 'atleta2',
        nome: 'Maria Santos',
        fotoUrl: null,
      },
      atleta3: {
        id: 'atleta3',
        nome: 'Pedro Oliveira',
        fotoUrl: null,
      },
      atleta4: {
        id: 'atleta4',
        nome: 'Ana Costa',
        fotoUrl: null,
      },
    };

    console.log('[Card Test] Dados de teste criados:', {
      atleta1: partidaTeste.atleta1.nome,
      atleta2: partidaTeste.atleta2.nome,
      atleta3: partidaTeste.atleta3.nome,
      atleta4: partidaTeste.atleta4.nome,
    });

    // Gerar card
    console.log('[Card Test] Gerando card...');
    const cardBuffer = await generateMatchCard(partidaTeste);
    
    if (!cardBuffer || cardBuffer.length === 0) {
      throw new Error('Card gerado está vazio');
    }
    
    console.log('[Card Test] Card gerado com sucesso! Tamanho:', cardBuffer.length, 'bytes');

    // Debug: Verificar metadata final
    const finalMetadata = await sharp(cardBuffer).metadata();
    console.log('[Card Test] Metadata final:', {
      format: finalMetadata.format,
      width: finalMetadata.width,
      height: finalMetadata.height,
      hasAlpha: finalMetadata.hasAlpha,
      channels: finalMetadata.channels,
    });

    // Retornar imagem PNG
    const response = new NextResponse(cardBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'Content-Disposition': 'inline; filename="card-test.png"',
      },
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[Card Test] Erro:', error);
    console.error('[Card Test] Stack:', error.stack);
    
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao gerar card de teste',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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

