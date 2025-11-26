// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import * as userService from '@/lib/userService';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação - apenas ADMIN pode criar usuários
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    
    // Apenas ADMIN pode criar usuários
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: "Acesso negado. Apenas administradores podem criar usuários." },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { name, email, password, role } = body;
    
    // Se role for fornecido, usar; caso contrário, criar como USER
    const roleFinal = role || 'USER';
    
    const novoUsuario = await userService.createUser(name, email, password, roleFinal);

    const response = NextResponse.json(
      { user: novoUsuario },
      { status: 201 }
    );
    return withCors(response, request);
  } catch (err: any) {
    const errorResponse = NextResponse.json(
      { error: err.message ?? "Erro ao registrar" },
      { status: 400 }
    );
    return withCors(errorResponse, request);
  }
}



