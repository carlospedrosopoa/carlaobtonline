// app/api/user/completar-cadastro/route.ts - Completar cadastro de usuário incompleto por telefone
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import * as userService from '@/lib/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefone, email, password, dadosAtleta } = body;

    if (!telefone || !email || !password) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Telefone, e-mail e senha são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Completar cadastro
    const usuarioCompleto = await userService.completarCadastroUsuario(
      telefone,
      email,
      password,
      dadosAtleta
    );

    const response = NextResponse.json(
      {
        usuario: usuarioCompleto,
        mensagem: 'Cadastro completado com sucesso! Agora você pode fazer login.'
      },
      { status: 200 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao completar cadastro:', error);
    
    // Mensagem amigável para telefone não encontrado
    let mensagem = error.message || 'Erro ao completar cadastro';
    if (error.message?.includes('Telefone não encontrado')) {
      mensagem = 'Telefone não encontrado. Verifique o número e tente novamente, ou crie uma nova conta.';
    }

    const errorResponse = NextResponse.json(
      {
        mensagem,
        error: error.message,
        codigo: error.message?.includes('Telefone não encontrado') ? 'TELEFONE_NAO_ENCONTRADO' : 'ERRO_GENERICO'
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

