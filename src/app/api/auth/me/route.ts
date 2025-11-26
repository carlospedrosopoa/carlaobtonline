// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Retorna erro 401
    }

    const { user } = authResult;
    
    const response = NextResponse.json(
      user,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error) {
    const errorResponse = NextResponse.json(
      { error: "Erro ao obter usuário" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



