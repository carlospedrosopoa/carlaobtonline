// app/api/user/auth/forgot-password/route.ts - Solicitar reset de senha (para atletas - USER)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';
import {
  gerarCodigoVerificacao,
  armazenarCodigoVerificacaoPorEmail,
} from '@/lib/verificacaoService';
import { enviarMensagemGzappy, formatarNumeroGzappy } from '@/lib/gzappyService';

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, telefone } = body;

    // Validar que pelo menos um campo foi fornecido
    if (!email && !telefone) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Informe o email ou telefone cadastrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar email se fornecido
    const emailNormalizado = email ? email.trim().toLowerCase() : null;
    const telefoneNormalizado = telefone ? telefone.replace(/\D/g, '') : null;

    // Buscar usuário por email ou telefone (através do atleta vinculado)
    let usuarioResult;
    if (emailNormalizado) {
      usuarioResult = await query(
        `SELECT u.id, u.email, u.name, u.role, u."atletaId",
         a.fone as "atleta_fone", a.nome as "atleta_nome"
         FROM "User" u
         LEFT JOIN "Atleta" a ON u."atletaId" = a.id
         WHERE u.email = $1 AND u.role = 'USER'`,
        [emailNormalizado]
      );
    } else if (telefoneNormalizado) {
      // Buscar por telefone do atleta vinculado
      usuarioResult = await query(
        `SELECT u.id, u.email, u.name, u.role, u."atletaId",
         a.fone as "atleta_fone", a.nome as "atleta_nome"
         FROM "User" u
         INNER JOIN "Atleta" a ON u."atletaId" = a.id
         WHERE a.fone = $1 AND u.role = 'USER'`,
        [telefoneNormalizado]
      );
    } else {
      const errorResponse = NextResponse.json(
        { mensagem: 'Informe o email ou telefone cadastrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuarioResult.rows.length === 0) {
      // Não revelar se o usuário existe ou não por segurança
      const response = NextResponse.json({
        mensagem: 'Se o email/telefone estiver cadastrado, você receberá um código de verificação',
        enviado: true, // Sempre retornar true por segurança
      });
      return withCors(response, request);
    }

    const usuario = usuarioResult.rows[0];
    const emailUsuario = usuario.email;
    const telefoneUsuario = usuario.atleta_fone;

    // Gerar código de 6 dígitos
    const codigo = gerarCodigoVerificacao();
    const expiraEm = Date.now() + 15 * 60 * 1000; // 15 minutos

    // Armazenar código por email
    armazenarCodigoVerificacaoPorEmail(emailUsuario, codigo, expiraEm);

    // Enviar código via WhatsApp se tiver telefone
    let enviadoViaWhatsApp = false;
    if (telefoneUsuario) {
      try {
        // Tentar obter pointId do atleta (se estiver vinculado a uma arena)
        const pointResult = await query(
          `SELECT p.id as "pointId" FROM "Point" p
           INNER JOIN "Atleta" a ON a."pointId" = p.id
           WHERE a.id = $1
           LIMIT 1`,
          [usuario.atletaId]
        );

        const pointId = pointResult.rows[0]?.pointId || null;

        const telefoneFormatado = formatarNumeroGzappy(telefoneUsuario);
        const mensagem = `🔐 *Código de Recuperação de Senha*

Olá ${usuario.name || usuario.atleta_nome || 'Usuário'},

Seu código para redefinir a senha é: *${codigo}*

Este código expira em 15 minutos.

Se você não solicitou esta recuperação, ignore esta mensagem.`;

        enviadoViaWhatsApp = await enviarMensagemGzappy({
          destinatario: telefoneFormatado,
          mensagem,
          tipo: 'texto',
        }, pointId);
      } catch (error: any) {
        console.error('Erro ao enviar código via WhatsApp:', error);
        // Continuar mesmo se falhar WhatsApp, ainda temos email como fallback
      }
    }

    // TODO: Implementar envio de código por email
    // Por enquanto, apenas WhatsApp é enviado

    const response = NextResponse.json({
      mensagem: 'Se o email/telefone estiver cadastrado, você receberá um código de verificação',
      enviado: true,
      metodo: enviadoViaWhatsApp ? 'whatsapp' : 'email',
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao solicitar reset de senha:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar solicitação. Tente novamente.' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
