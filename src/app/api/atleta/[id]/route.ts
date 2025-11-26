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
        try {
          const buffer = base64ToBuffer(fotoUrl);
          // Detectar extensão do base64
          const mimeMatch = fotoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `atleta-foto.${extension}`;
          
          const result = await uploadImage(buffer, fileName, 'atletas');
          
          // Deletar foto antiga se existir
          if (atletaExistente.fotoUrl && atletaExistente.fotoUrl.startsWith('https://storage.googleapis.com/')) {
            try {
              await deleteImage(atletaExistente.fotoUrl);
            } catch (error) {
              console.error('Erro ao deletar imagem antiga:', error);
              // Continua mesmo se não conseguir deletar
            }
          }
          
          fotoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload da imagem:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload da imagem' },
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

