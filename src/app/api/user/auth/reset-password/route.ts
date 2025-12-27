// app/api/user/auth/reset-password/route.ts - Redefinir senha com token
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body?.token ?? "") as string;
    const novaSenha = (body?.password ?? body?.senha ?? "") as string;

    if (!token || !novaSenha) {
      const errorResponse = NextResponse.json(
        { mensagem: "Token e nova senha são obrigatórios." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (novaSenha.length < 6) {
      const errorResponse = NextResponse.json(
        { mensagem: "A senha deve ter no mínimo 6 caracteres." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar usuário pelo token
    const result = await query(
      `SELECT * FROM "User" 
       WHERE "resetToken" = $1 
       AND "resetTokenExpiry" > NOW()`,
      [token]
    );

    const usuarioDb = result.rows[0];

    if (!usuarioDb) {
      const errorResponse = NextResponse.json(
        { mensagem: "Token inválido ou expirado. Solicite uma nova recuperação de senha." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha e limpar token
    await query(
      `UPDATE "User" 
       SET password = $1,
           "resetToken" = NULL,
           "resetTokenExpiry" = NULL
       WHERE id = $2`,
      [senhaHash, usuarioDb.id]
    );

    const response = NextResponse.json(
      { 
        mensagem: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha.",
        sucesso: true
      },
      { status: 200 }
    );
    
    return withCors(response, request);
  } catch (error: any) {
    console.error("reset-password error:", error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: "Erro ao redefinir senha",
        error: error?.message || "Erro desconhecido"
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

