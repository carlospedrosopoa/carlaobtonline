// app/api/user/auth/forgot-password/route.ts - Solicitar recuperação de senha
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';
import { withCors } from '@/lib/cors';
import { enviarMensagemGzappy, formatarNumeroGzappy } from '@/lib/gzappyService';

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

    // Buscar usuário com dados do atleta (para obter telefone)
    const result = await query(
      `SELECT 
        u.*,
        at.fone as "atleta_fone",
        at.nome as "atleta_nome"
      FROM "User" u
      LEFT JOIN "Atleta" at ON u.id = at."usuarioId"
      WHERE u.email = $1`,
      [email]
    );
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
             "resetTokenExpiry" = $2
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
                 "resetTokenExpiry" = $2
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

    // Gerar URL de reset
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atleta.playnaquadra.com.br';
    const resetUrl = `${frontendUrl}/resetar-senha?token=${resetToken}`;
    
    console.log('[FORGOT PASSWORD] Token gerado para:', email);
    console.log('[FORGOT PASSWORD] URL de reset:', resetUrl);

    // Tentar enviar via WhatsApp se o atleta tiver telefone cadastrado
    const telefoneAtleta = (usuarioDb as any).atleta_fone;
    const nomeAtleta = (usuarioDb as any).atleta_nome || (usuarioDb as any).nome || 'Usuário';
    let whatsappEnviado = false;

    if (telefoneAtleta) {
      try {
        const telefoneFormatado = formatarNumeroGzappy(telefoneAtleta);
        
        // Buscar pointId do usuário ou usar variável de ambiente
        // Se o usuário tiver pointIdGestor, usar ele, senão tentar buscar de algum card ou usar padrão
        let pointIdParaGzappy: string | undefined = undefined;
        
        // Tentar obter pointId do usuário (se for ORGANIZER)
        if ((usuarioDb as any).pointIdGestor) {
          pointIdParaGzappy = (usuarioDb as any).pointIdGestor;
        } else {
          // Tentar buscar de algum card do usuário
          const cardResult = await query(
            `SELECT "pointId" FROM "CardCliente" WHERE "usuarioId" = $1 LIMIT 1`,
            [usuarioDb.id]
          );
          if (cardResult.rows.length > 0) {
            pointIdParaGzappy = cardResult.rows[0].pointId;
          }
        }

        const mensagem = `🔐 *Recuperação de Senha - Play Na Quadra*

Olá, ${nomeAtleta}!

Você solicitou a recuperação de senha. Clique no link abaixo para redefinir sua senha:

${resetUrl}

⚠️ Este link é válido por 1 hora.

Se você não solicitou esta recuperação, ignore esta mensagem.`;

        whatsappEnviado = await enviarMensagemGzappy(
          {
            destinatario: telefoneFormatado,
            mensagem,
            tipo: 'texto',
          },
          pointIdParaGzappy
        );

        if (whatsappEnviado) {
          console.log('[FORGOT PASSWORD] ✅ Link enviado via WhatsApp para:', telefoneFormatado);
        } else {
          console.warn('[FORGOT PASSWORD] ⚠️ Falha ao enviar via WhatsApp, mas token foi gerado');
        }
      } catch (whatsappError: any) {
        console.error('[FORGOT PASSWORD] ❌ Erro ao enviar via WhatsApp:', whatsappError);
        // Não falhar a requisição se o WhatsApp falhar, apenas logar o erro
      }
    } else {
      console.log('[FORGOT PASSWORD] ℹ️ Usuário não possui telefone cadastrado, não será enviado via WhatsApp');
    }

    // TODO: Enviar email com o link de reset (fallback se WhatsApp não funcionar)
    // await sendResetPasswordEmail(email, resetUrl);

    // Mensagem de resposta baseada no método de envio
    let mensagemResposta = "Se o email estiver cadastrado, você receberá um link para redefinir sua senha.";
    if (whatsappEnviado) {
      mensagemResposta = "Link de recuperação enviado via WhatsApp! Verifique suas mensagens.";
    } else if (telefoneAtleta) {
      mensagemResposta = "Não foi possível enviar via WhatsApp. Verifique se o Gzappy está configurado corretamente.";
    }

    const response = NextResponse.json(
      { 
        mensagem: mensagemResposta,
        sucesso: true,
        enviadoViaWhatsApp: whatsappEnviado,
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

