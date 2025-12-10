// app/api/atleta/[id]/route.ts - Buscar e atualizar atleta
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { atualizarAtleta, buscarAtletaPorId } from '@/lib/atletaService';
import { uploadImage, base64ToBuffer, deleteImage } from '@/lib/googleCloudStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    
    const atleta = await buscarAtletaPorId(id);
    
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o atleta pertence ao usuário (ou se é ADMIN)
    if (user.role !== 'ADMIN' && atleta.usuarioId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para visualizar este atleta' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(atleta);
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao buscar atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao buscar atleta' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    const body = await request.json();
    
    const { nome, categoria, dataNascimento, genero, fone, fotoUrl, pointIdPrincipal, pointIdsFrequentes } = body;

    // Verificar se o atleta existe
    const atletaExistente = await buscarAtletaPorId(id);
    
    if (!atletaExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o atleta pertence ao usuário (ou se é ADMIN)
    if (user.role !== 'ADMIN' && atletaExistente.usuarioId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar este atleta' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Processar fotoUrl: se for base64, fazer upload para GCS
    let fotoUrlProcessada: string | null = null;
    if (fotoUrl !== undefined) {
      if (fotoUrl === null) {
        // Remover foto: deletar do GCS se existir
        if (atletaExistente.fotoUrl && atletaExistente.fotoUrl.startsWith('https://storage.googleapis.com/')) {
          try {
            await deleteImage(atletaExistente.fotoUrl);
          } catch (error) {
            console.error('Erro ao deletar imagem antiga:', error);
            // Continua mesmo se não conseguir deletar
          }
        }
        fotoUrlProcessada = null;
      } else if (fotoUrl.startsWith('data:image/')) {
        // É base64 - fazer upload para GCS
        let buffer: Buffer | undefined;
        let fileName: string | undefined;
        let extension: string | undefined;
        
        try {
          console.log('[UPLOAD FOTO DEBUG] Iniciando upload de foto base64');
          buffer = base64ToBuffer(fotoUrl);
          console.log('[UPLOAD FOTO DEBUG] Buffer criado, tamanho:', buffer.length);
          
          // Detectar extensão do base64
          const mimeMatch = fotoUrl.match(/data:image\/(\w+);base64,/);
          extension = mimeMatch ? mimeMatch[1] : 'jpg';
          fileName = `atleta-foto.${extension}`;
          console.log('[UPLOAD FOTO DEBUG] File name:', fileName, 'Extension:', extension);
          
          console.log('[UPLOAD FOTO DEBUG] Chamando uploadImage...');
          const result = await uploadImage(buffer, fileName, 'atletas');
          console.log('[UPLOAD FOTO DEBUG] Upload concluído, URL:', result.url);
          
          // Deletar foto antiga se existir
          if (atletaExistente.fotoUrl && atletaExistente.fotoUrl.startsWith('https://storage.googleapis.com/')) {
            try {
              console.log('[UPLOAD FOTO DEBUG] Deletando foto antiga:', atletaExistente.fotoUrl);
              await deleteImage(atletaExistente.fotoUrl);
              console.log('[UPLOAD FOTO DEBUG] Foto antiga deletada com sucesso');
            } catch (error: any) {
              console.error('[UPLOAD FOTO DEBUG] Erro ao deletar imagem antiga (não crítico):', error?.message);
              // Continua mesmo se não conseguir deletar
            }
          }
          
          fotoUrlProcessada = result.url;
        } catch (error: any) {
          console.error('[UPLOAD FOTO DEBUG] ❌ Erro ao fazer upload da imagem:', error);
          console.error('[UPLOAD FOTO DEBUG] Erro message:', error?.message);
          console.error('[UPLOAD FOTO DEBUG] Erro name:', error?.name);
          console.error('[UPLOAD FOTO DEBUG] Erro code:', error?.code);
          console.error('[UPLOAD FOTO DEBUG] Stack:', error?.stack);
          
          // Verificar variáveis de ambiente
          console.error('[UPLOAD FOTO DEBUG] GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? 'configurado' : 'não configurado');
          console.error('[UPLOAD FOTO DEBUG] GOOGLE_CLOUD_STORAGE_BUCKET:', process.env.GOOGLE_CLOUD_STORAGE_BUCKET ? 'configurado' : 'não configurado');
          console.error('[UPLOAD FOTO DEBUG] GOOGLE_CLOUD_KEY:', process.env.GOOGLE_CLOUD_KEY ? 'configurado' : 'não configurado');
          
          if (buffer) {
            console.error('[UPLOAD FOTO DEBUG] Buffer size:', buffer.length);
          }
          if (fileName) {
            console.error('[UPLOAD FOTO DEBUG] File name:', fileName);
          }
          if (extension) {
            console.error('[UPLOAD FOTO DEBUG] Extension:', extension);
          }
          
          // Verificar se é erro de configuração do GCS
          const isGcsConfigError = error?.message?.includes('não configurado') || 
                                   error?.message?.includes('not configured') ||
                                   error?.message?.includes('não configurado') ||
                                   error?.code === 'ENOENT' ||
                                   error?.message?.includes('GOOGLE_CLOUD');
          
          const errorResponse = NextResponse.json(
            { 
              mensagem: isGcsConfigError 
                ? 'Serviço de armazenamento de imagens não configurado. Entre em contato com o suporte.'
                : `Erro ao fazer upload da imagem: ${error?.message || 'Erro desconhecido'}`,
              error: error?.message || 'Erro desconhecido',
              code: error?.code,
              details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
        // Já é uma URL - usar diretamente
        fotoUrlProcessada = fotoUrl;
      } else {
        // String vazia ou inválida
        fotoUrlProcessada = null;
      }
    }

    const dadosAtualizacao: {
      nome?: string;
      dataNascimento?: string;
      categoria?: string | null;
      genero?: string | null;
      fone?: string | null;
      fotoUrl?: string | null;
      pointIdPrincipal?: string | null;
      pointIdsFrequentes?: string[];
    } = {};

    if (nome !== undefined) dadosAtualizacao.nome = nome;
    if (dataNascimento !== undefined) dadosAtualizacao.dataNascimento = dataNascimento;
    if (categoria !== undefined) dadosAtualizacao.categoria = categoria || null;
    if (genero !== undefined) dadosAtualizacao.genero = genero || null;
    if (fone !== undefined) dadosAtualizacao.fone = fone || null;
    if (fotoUrl !== undefined) dadosAtualizacao.fotoUrl = fotoUrlProcessada;
    if (pointIdPrincipal !== undefined) dadosAtualizacao.pointIdPrincipal = pointIdPrincipal || null;
    if (pointIdsFrequentes !== undefined) dadosAtualizacao.pointIdsFrequentes = Array.isArray(pointIdsFrequentes) ? pointIdsFrequentes : [];

    const atletaAtualizado = await atualizarAtleta(id, dadosAtualizacao);

    if (!atletaAtualizado) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro ao atualizar atleta' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(atletaAtualizado);
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao atualizar atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar atleta' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

