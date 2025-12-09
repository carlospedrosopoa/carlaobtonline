// app/api/user/perfil/criar/route.ts - Criar perfil de atleta (para frontend externo)
// Esta é a nova rota organizada. A rota antiga /api/atleta/criarAtleta ainda funciona para compatibilidade.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { criarAtleta } from '@/lib/atletaService';
import { uploadImage, base64ToBuffer } from '@/lib/googleCloudStorage';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const body = await request.json();
    const { nome, categoria, dataNascimento, genero, fone, fotoUrl, pointIdPrincipal, pointIdsFrequentes } = body;

    if (!nome || !dataNascimento) {
      const errorResponse = NextResponse.json(
        { mensagem: "nome e dataNascimento são obrigatórios" },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o usuário já tem um atleta
    const { verificarAtletaUsuario } = await import('@/lib/atletaService');
    const atletaExistente = await verificarAtletaUsuario(user.id);
    
    if (atletaExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: "Você já possui um perfil de atleta. Use a rota de atualização." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Processar fotoUrl: se for base64, fazer upload para GCS
    let fotoUrlProcessada: string | null = null;
    if (fotoUrl && fotoUrl.startsWith('data:image/')) {
      try {
        const buffer = base64ToBuffer(fotoUrl);
        // Detectar extensão do base64
        const mimeMatch = fotoUrl.match(/data:image\/(\w+);base64,/);
        const extension = mimeMatch ? mimeMatch[1] : 'jpg';
        const fileName = `atleta-foto.${extension}`;
        
        const result = await uploadImage(buffer, fileName, 'atletas');
        fotoUrlProcessada = result.url;
      } catch (error) {
        console.error('Erro ao fazer upload da imagem:', error);
        const errorResponse = NextResponse.json(
          { mensagem: 'Erro ao fazer upload da imagem' },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }
    } else if (fotoUrl && (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://'))) {
      fotoUrlProcessada = fotoUrl;
    }

    const novoAtleta = await criarAtleta(user.id, {
      nome,
      dataNascimento,
      categoria: categoria || null,
      genero: genero || null,
      fone: fone || null,
      fotoUrl: fotoUrlProcessada,
      pointIdPrincipal: pointIdPrincipal || null,
      pointIdsFrequentes: Array.isArray(pointIdsFrequentes) ? pointIdsFrequentes : [],
    });

    const response = NextResponse.json(novoAtleta, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || "Erro ao criar atleta" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

