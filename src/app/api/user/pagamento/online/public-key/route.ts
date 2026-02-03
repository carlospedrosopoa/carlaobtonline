import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { hubGetPublicKey } from '@/lib/hubPaymentsClient';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const pk = await hubGetPublicKey();

    const response = NextResponse.json({
      publicKey: pk.public_key,
      createdAt: pk.created_at ?? null,
    });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      {
        mensagem: 'Erro ao obter chave pública do PagBank',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

