// app/api/user/auth/validate-password/route.ts - Validar senha do usuário logado
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyJwtAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, request);
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação do usuário
    const usuario = await verifyJwtAuth(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const senha = (body?.password ?? body?.senha ?? "") as string;

    if (!senha) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Senha é obrigatória' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar usuário no banco
    const result = await query('SELECT password FROM "User" WHERE id = $1', [usuario.id]);
    const usuarioDb = result.rows[0];

    if (!usuarioDb) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const senhaHash = usuarioDb.password;
    if (!senhaHash) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro na configuração do usuário' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    // Validar senha
    const senhaValida = await bcrypt.compare(senha, senhaHash);

    if (!senhaValida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Senha incorreta' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Senha válida
    const successResponse = NextResponse.json(
      { mensagem: 'Senha válida', valido: true },
      { status: 200 }
    );
    return withCors(successResponse, request);

  } catch (error: any) {
    console.error('Erro ao validar senha:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error?.message || 'Erro ao validar senha' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

