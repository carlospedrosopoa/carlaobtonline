// app/api/user/getUsuarioLogado/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsuarioById } from '@/lib/userService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const usuario = await getUsuarioById(user.id);

    if (!usuario) {
      return NextResponse.json(
        { mensagem: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      usuario,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { mensagem: "Erro ao buscar usuário" },
      { status: 500 }
    );
  }
}

