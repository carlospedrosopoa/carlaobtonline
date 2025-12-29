// app/api/card/competicao/[id]/route.ts - Gerar card promocional da competição
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarCompeticaoParaCard, salvarCardUrlCompeticao } from '@/lib/cardService';
import { generateCompetitionCard } from '@/lib/generateCard';
import { uploadImage, deleteImage } from '@/lib/googleCloudStorage';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { id } = await params;
    
    // Verificar se deve forçar regeneração (query parameter ?refresh=true ou ?nocache=true)
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('nocache') === 'true';
    
    // Buscar dados da competição
    const competicao = await buscarCompeticaoParaCard(id);
    
    if (!competicao) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Validar que a competição tem card de divulgação
    if (!competicao.cardDivulgacaoUrl) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não possui card de divulgação cadastrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar que tem pelo menos alguns atletas
    if (competicao.atletas.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não possui atletas cadastrados' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Gerar card
    console.log('[Card Competição] Gerando card para competição:', id);
    console.log('[Card Competição] Template usado:', competicao.cardDivulgacaoUrl.substring(0, 100) + '...');
    console.log('[Card Competição] Número de atletas:', competicao.atletas.length);
    
    const cardBuffer = await generateCompetitionCard(competicao);
    
    if (!cardBuffer || cardBuffer.length === 0) {
      throw new Error('Card gerado está vazio');
    }
    
    console.log('[Card Competição] Card gerado com sucesso, tamanho:', cardBuffer.length, 'bytes');

    // Se forçar refresh, salvar o card no GCS e atualizar a URL no banco
    if (forceRefresh) {
      try {
        console.log('[Card Competição] Salvando card no GCS...');
        
        // Deletar card antigo se existir
        try {
          const competicaoComCardUrl = await query(
            'SELECT "cardUrl" FROM "Competicao" WHERE id = $1',
            [id]
          );
          
          if (competicaoComCardUrl.rows.length > 0 && competicaoComCardUrl.rows[0].cardUrl) {
            const cardUrlAntigo = competicaoComCardUrl.rows[0].cardUrl;
            console.log('[Card Competição] Deletando card antigo:', cardUrlAntigo);
            await deleteImage(cardUrlAntigo);
          }
        } catch (error: any) {
          // Se o campo cardUrl não existir, ignorar (pode ser que ainda não tenha sido adicionado)
          if (!error.message?.includes('cardUrl') && error.code !== '42703') {
            console.warn('[Card Competição] Erro ao verificar card antigo:', error.message);
          }
        }
        
        // Fazer upload do novo card
        const uploadResult = await uploadImage(cardBuffer, `card-competicao-${id}.png`, 'cards');
        
        // Salvar URL no banco de dados
        await salvarCardUrlCompeticao(id, uploadResult.url);
        
        console.log('[Card Competição] Card salvo no GCS e URL atualizada no banco:', uploadResult.url);
      } catch (error: any) {
        console.error('[Card Competição] Erro ao salvar card no GCS:', error);
        // Continuar mesmo se falhar ao salvar - o card ainda será retornado
        console.warn('[Card Competição] Continuando sem salvar no GCS...');
      }
    }

    // Headers de cache
    const cacheHeaders: Record<string, string> = {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="card-competicao-${id}.png"`,
    };
    
    // Se forçar refresh, não usar cache
    if (forceRefresh) {
      cacheHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      cacheHeaders['Pragma'] = 'no-cache';
      cacheHeaders['Expires'] = '0';
      console.log('[Card Competição] Cache desabilitado - regeneração forçada');
    } else {
      // Cache normal por 1 hora
      cacheHeaders['Cache-Control'] = 'public, max-age=3600, s-maxage=3600';
    }

    // Retornar imagem PNG
    const response = new NextResponse(new Uint8Array(cardBuffer), {
      status: 200,
      headers: cacheHeaders,
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[Card Competição] Erro ao gerar card da competição:', error);
    console.error('[Card Competição] Stack:', error.stack);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao gerar card da competição',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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

