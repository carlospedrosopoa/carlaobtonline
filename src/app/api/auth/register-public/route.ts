// app/api/auth/register-public/route.ts - Registro público de usuários (para frontend externo)
// ⚠️ DEPRECATED: Esta rota está mantida para compatibilidade.
// Use /api/user/auth/register para novas implementações.
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import * as userService from '@/lib/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;
    
    if (!name || !email || !password) {
      const errorResponse = NextResponse.json(
        { mensagem: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Criar usuário com role USER (padrão para registro público)
    const novoUsuario = await userService.createUser(name, email, password, 'USER');

    const response = NextResponse.json(
      { 
        user: novoUsuario,
        mensagem: "Conta criada com sucesso"
      },
      { status: 201 }
    );
    return withCors(response, request);
  } catch (err: any) {
    const errorResponse = NextResponse.json(
      { 
        mensagem: err.message || "Erro ao criar conta",
        error: err.message 
      },
      { status: 400 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

