// app/api/user/perfil/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
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

    const response = NextResponse.json(
      { mensagem: "Perfil atualizado com sucesso" },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error) {
    console.error(error);
    const errorResponse = NextResponse.json(
      { mensagem: "Erro ao atualizar perfil" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



