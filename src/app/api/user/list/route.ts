// app/api/user/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as userService from '@/lib/userService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    
    // Apenas ADMIN pode listar usuários
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: "Acesso negado" },
        { status: 403 }
      );
    }

    const users = await userService.getAllUsers();
    
    return NextResponse.json(
      users,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao listar usuários" },
      { status: 500 }
    );
  }
}

