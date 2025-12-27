// app/api/auth/reset-password/route.ts - Resetar senha com código (para professores - PROFESSOR)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { withCors } from '@/lib/cors';
import {
  obterCodigoVerificacaoPorEmail,
  removerCodigoVerificacaoPorEmail,
} from '@/lib/verificacaoService';

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, codigo, novaSenha } = body;

    // Validações
    if (!email || !codigo || !novaSenha) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Email, código e nova senha são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (novaSenha.length < 6) {
      const errorResponse = NextResponse.json(
        { mensagem: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar email
    const emailNormalizado = email.trim().toLowerCase();

    // Verificar código
    const codigoDados = obterCodigoVerificacaoPorEmail(emailNormalizado);
    if (!codigoDados || codigoDados.codigo !== codigo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Código inválido ou expirado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar usuário
    const usuarioResult = await query(
      `SELECT id, email, role FROM "User" WHERE email = $1 AND role = 'PROFESSOR'`,
      [emailNormalizado]
    );

    if (usuarioResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const usuario = usuarioResult.rows[0];

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha no banco
    await query(
      `UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
      [senhaHash, usuario.id]
    );

    // Remover código usado
    removerCodigoVerificacaoPorEmail(emailNormalizado);

    const response = NextResponse.json({
      mensagem: 'Senha redefinida com sucesso',
      sucesso: true,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao resetar senha:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar solicitação. Tente novamente.' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
