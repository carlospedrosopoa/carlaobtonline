// app/api/user/criar-incompleto/route.ts - Criar usuário incompleto (para vínculo posterior)
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { getUsuarioFromRequest } from '@/lib/auth';
import * as userService from '@/lib/userService';

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem criar usuários incompletos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem criar usuários incompletos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { name, telefone } = body;

    if (!name || !telefone) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Criar usuário incompleto
    const novoUsuario = await userService.createUserIncompleto(name, telefone, 'USER');

    const response = NextResponse.json(
      {
        usuario: novoUsuario,
        mensagem: 'Usuário criado com sucesso. Ele poderá completar o cadastro usando o telefone no appatleta.'
      },
      { status: 201 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar usuário incompleto:', error);
    const errorResponse = NextResponse.json(
      {
        mensagem: error.message || 'Erro ao criar usuário incompleto',
        error: error.message
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

