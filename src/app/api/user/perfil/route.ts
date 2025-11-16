// app/api/user/perfil/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as userService from '@/lib/userService';

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const { name, password } = body;

    await userService.atualizarUsuario(user.id, { name, password });

    return NextResponse.json(
      { mensagem: "Perfil atualizado com sucesso" },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { mensagem: "Erro ao atualizar perfil" },
      { status: 500 }
    );
  }
}

