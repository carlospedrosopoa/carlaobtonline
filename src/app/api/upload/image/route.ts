// app/api/upload/image/route.ts - Upload de imagens para Google Cloud Storage
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, validateImage } from '@/lib/googleCloudStorage';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    // Obter FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Arquivo não fornecido' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar imagem
    const validation = validateImage(file);
    if (!validation.valid) {
      const errorResponse = NextResponse.json(
        { mensagem: validation.error },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fazer upload para Google Cloud Storage
    const result = await uploadImage(buffer, file.name, folder);

    const response = NextResponse.json({
      url: result.url,
      fileName: result.fileName,
      size: result.size,
      mensagem: 'Upload realizado com sucesso',
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao fazer upload:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao fazer upload da imagem',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

