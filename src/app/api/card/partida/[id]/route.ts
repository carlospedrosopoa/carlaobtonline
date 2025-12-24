// app/api/card/partida/[id]/route.ts - Gerar card promocional da partida
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarPartidaParaCard, salvarTemplatePartida, obterTemplatePadrao, obterTemplateArenaPorPointId, salvarCardUrl } from '@/lib/cardService';
import { generateMatchCard } from '@/lib/generateCard';
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
    
    // Buscar dados da partida
    const partida = await buscarPartidaParaCard(id);
    
    if (!partida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Partida não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Validar que a partida tem pelo menos 2 atletas
    const atletasCount = [
      partida.atleta1,
      partida.atleta2,
      partida.atleta3,
      partida.atleta4,
    ].filter(Boolean).length;

    if (atletasCount < 2) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Partida deve ter pelo menos 2 atletas' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Determinar qual template usar
    // Prioridade: templateUrl da partida > template da arena (cardTemplateUrl do Point) > template padrão (variável de ambiente)
    const templatePadrao = obterTemplatePadrao();
    let templateArena: string | null = null;
    
    // Se a partida não tem template próprio, tentar buscar template da arena pelo pointId
    if (!partida.templateUrl && partida.pointId) {
      templateArena = await obterTemplateArenaPorPointId(partida.pointId);
    }
    
    const templateUrlParaUsar = partida.templateUrl || templateArena || templatePadrao;
    
    console.log('[Card] Template da partida:', partida.templateUrl || 'null');
    console.log('[Card] Template da arena:', templateArena || 'null');
    console.log('[Card] Template padrão:', templatePadrao || 'null');
    console.log('[Card] Template que será usado:', templateUrlParaUsar || 'fundo programático');
    
    // Se a partida não tem template salvo e temos um template (da arena ou padrão), salvar na partida
    if (!partida.templateUrl && templateUrlParaUsar) {
      try {
        await salvarTemplatePartida(partida.id, templateUrlParaUsar);
        console.log('[Card] Template salvo na partida:', templateUrlParaUsar.substring(0, 50) + '...');
        // Atualizar objeto partida para refletir a mudança
        partida.templateUrl = templateUrlParaUsar;
      } catch (error: any) {
        console.warn('[Card] Erro ao salvar template na partida:', error.message);
        // Continuar mesmo se falhar ao salvar
      }
    }
    
    // Gerar card
    console.log('[Card] Gerando card para partida:', id);
    console.log('[Card] Template final usado:', templateUrlParaUsar ? templateUrlParaUsar.substring(0, 100) : 'fundo programático');
    console.log('[Card] Dados da partida:', {
      atleta1: partida.atleta1?.nome,
      atleta2: partida.atleta2?.nome,
      atleta3: partida.atleta3?.nome,
      atleta4: partida.atleta4?.nome,
    });
    
    const cardBuffer = await generateMatchCard(partida, templateUrlParaUsar);
    
    if (!cardBuffer || cardBuffer.length === 0) {
      throw new Error('Card gerado está vazio');
    }
    
    console.log('[Card] Card gerado com sucesso, tamanho:', cardBuffer.length, 'bytes');

    // Se forçar refresh, salvar o card no GCS e atualizar a URL no banco
    if (forceRefresh) {
      try {
        console.log('[Card] Salvando card no GCS...');
        
        // Deletar card antigo se existir
        const partidaComCardUrl = await query(
          'SELECT "cardUrl" FROM "Partida" WHERE id = $1',
          [id]
        );
        
        if (partidaComCardUrl.rows.length > 0 && partidaComCardUrl.rows[0].cardUrl) {
          const cardUrlAntigo = partidaComCardUrl.rows[0].cardUrl;
          console.log('[Card] Deletando card antigo:', cardUrlAntigo);
          await deleteImage(cardUrlAntigo);
        }
        
        // Fazer upload do novo card
        const uploadResult = await uploadImage(cardBuffer, `card-partida-${id}.png`, 'cards');
        
        // Salvar URL no banco de dados
        await salvarCardUrl(id, uploadResult.url);
        
        console.log('[Card] Card salvo no GCS e URL atualizada no banco:', uploadResult.url);
      } catch (error: any) {
        console.error('[Card] Erro ao salvar card no GCS:', error);
        // Continuar mesmo se falhar ao salvar - o card ainda será retornado
        console.warn('[Card] Continuando sem salvar no GCS...');
      }
    }

    // Gerar ETag baseado no templateUrl e updatedAt para invalidar cache quando necessário
    const etagValue = partida.templateUrl 
      ? `"${id}-${partida.templateUrl.substring(partida.templateUrl.length - 20)}"`
      : `"${id}-no-template"`;
    
    // Headers de cache
    const cacheHeaders: Record<string, string> = {
      'Content-Type': 'image/png',
      'ETag': etagValue,
      'Content-Disposition': `inline; filename="card-partida-${id}.png"`,
    };
    
    // Se forçar refresh, não usar cache
    if (forceRefresh) {
      cacheHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      cacheHeaders['Pragma'] = 'no-cache';
      cacheHeaders['Expires'] = '0';
      console.log('[Card] Cache desabilitado - regeneração forçada');
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
    console.error('[Card] Erro ao gerar card da partida:', error);
    console.error('[Card] Stack:', error.stack);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao gerar card da partida',
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

