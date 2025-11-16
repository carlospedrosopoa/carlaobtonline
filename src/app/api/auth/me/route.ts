// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Retorna erro 401
    }

    const { user } = authResult;
    
    return NextResponse.json(
      user,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao obter usuário" },
      { status: 500 }
    );
  }
}

