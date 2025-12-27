// app/api/user/auth/forgot-password/route.ts - Solicitar recuperação de senha
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';
import { withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailRaw = (body?.email ?? "") as string;
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      const errorResponse = NextResponse.json(
        { mensagem: "Informe o email." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar usuário
    const result = await query('SELECT * FROM "User" WHERE email = $1', [email]);
    const usuarioDb = result.rows[0];

    // Por segurança, sempre retornar sucesso mesmo se o usuário não existir
    // Isso previne enumeração de emails
    if (!usuarioDb) {
      const successResponse = NextResponse.json(
        { 
          mensagem: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha.",
          sucesso: true
        },
        { status: 200 }
      );
      return withCors(successResponse, request);
    }

    // Gerar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token válido por 1 hora

    // Salvar token no banco de dados
    // Primeiro, verificar se as colunas existem, se não, criar via ALTER TABLE
    try {
      await query(
        `UPDATE "User" 
         SET "resetToken" = $1, 
             "resetTokenExpiry" = $2,
             "updatedAt" = NOW()
         WHERE email = $3`,
        [resetToken, resetTokenExpiry, email]
      );
    } catch (error: any) {
      // Se as colunas não existirem, tentar adicioná-las
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.log('[FORGOT PASSWORD] Colunas resetToken não existem, tentando criar...');
        try {
          await query(`
            ALTER TABLE "User" 
            ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
            ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP
          `);
          
          // Tentar novamente o UPDATE
          await query(
            `UPDATE "User" 
             SET "resetToken" = $1, 
                 "resetTokenExpiry" = $2,
                 "updatedAt" = NOW()
             WHERE email = $3`,
            [resetToken, resetTokenExpiry, email]
          );
        } catch (alterError) {
          console.error('[FORGOT PASSWORD] Erro ao criar colunas:', alterError);
          throw alterError;
        }
      } else {
        throw error;
      }
    }

    // Em produção, aqui você enviaria um email com o link
    // Por enquanto, vamos retornar o token para desenvolvimento
    // Em produção, remover o token da resposta
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atleta.playnaquadra.com.br';
    const resetUrl = `${frontendUrl}/resetar-senha?token=${resetToken}`;
    
    console.log('[FORGOT PASSWORD] Token gerado para:', email);
    console.log('[FORGOT PASSWORD] URL de reset:', resetUrl);

    // TODO: Enviar email com o link de reset
    // await sendResetPasswordEmail(email, resetUrl);

    const response = NextResponse.json(
      { 
        mensagem: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha.",
        sucesso: true,
        // Remover em produção - apenas para desenvolvimento
        ...(process.env.NODE_ENV === 'development' && {
          resetUrl: resetUrl,
          token: resetToken
        })
      },
      { status: 200 }
    );
    
    return withCors(response, request);
  } catch (error: any) {
    console.error("forgot-password error:", error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: "Erro ao processar solicitação de recuperação de senha",
        error: error?.message || "Erro desconhecido"
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

