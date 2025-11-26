// app/api/user/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
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
      const errorResponse = NextResponse.json(
        { mensagem: "Acesso negado" },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const users = await userService.getAllUsers();
    
    const response = NextResponse.json(
      users,
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
      { error: "Erro ao listar usuários" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



