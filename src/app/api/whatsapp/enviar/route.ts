// app/api/whatsapp/enviar/route.ts - API para enviar mensagens WhatsApp
// TODO: Temporariamente desabilitado - migrando para Gzappy
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioFromRequest } from '@/lib/auth';
// import { enviarMensagemWhatsApp, formatarNumeroWhatsApp } from '@/lib/whatsappService';

/**
 * POST /api/whatsapp/enviar
 * Envia uma mensagem WhatsApp para um número específico
 * 
 * Body:
 * {
 *   destinatario: string, // Número de telefone (será formatado automaticamente)
 *   mensagem: string,     // Texto da mensagem
 *   tipo?: 'texto' | 'template'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar permissões (apenas ADMIN e ORGANIZER podem enviar)
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem enviar mensagens WhatsApp' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { destinatario, mensagem, tipo, pointId } = body;

    // Validações
    if (!destinatario || !mensagem) {
      return NextResponse.json(
        { mensagem: 'Destinatário e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    if (typeof mensagem !== 'string' || mensagem.trim().length === 0) {
      return NextResponse.json(
        { mensagem: 'A mensagem não pode estar vazia' },
        { status: 400 }
      );
    }

    if (mensagem.length > 4096) {
      return NextResponse.json(
        { mensagem: 'A mensagem não pode ter mais de 4096 caracteres' },
        { status: 400 }
      );
    }

    // TODO: Temporariamente desabilitado - migrando para Gzappy
    // Formatar número do destinatário
    // const numeroFormatado = formatarNumeroWhatsApp(destinatario);

    // Determinar pointId (prioridade: fornecido > pointIdGestor do usuário)
    // const pointIdFinal = pointId || (usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : undefined);

    // Enviar mensagem
    // try {
    //   const sucesso = await enviarMensagemWhatsApp({
    //     destinatario: numeroFormatado,
    //     mensagem: mensagem.trim(),
    //     tipo: tipo || 'texto',
    //   }, pointIdFinal || undefined);

    //   if (!sucesso) {
    //     return NextResponse.json(
    //       { mensagem: 'Erro ao enviar mensagem WhatsApp. Verifique as configurações da arena e os logs do servidor.' },
    //       { status: 500 }
    //     );
    //   }
    // } catch (error: any) {
    //   // Capturar erros específicos do WhatsApp (como token inválido)
    //   if (error.message?.includes('Token de acesso WhatsApp')) {
    //     return NextResponse.json(
    //       { 
    //         mensagem: error.message,
    //         detalhes: 'Verifique se o Access Token está correto e não expirou nas configurações da arena.'
    //       },
    //       { status: 400 }
    //     );
    //   }
    //   throw error; // Re-lançar outros erros
    // }

    // TODO: Implementar envio via Gzappy
    return NextResponse.json(
      { 
        sucesso: false,
        mensagem: 'Serviço WhatsApp temporariamente desabilitado. Migrando para Gzappy.',
        // destinatario: numeroFormatado,
      },
      { status: 503 } // Service Unavailable
    );

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Mensagem enviada com sucesso',
      destinatario: numeroFormatado,
    });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao processar requisição', error: error.message },
      { status: 500 }
    );
  }
}

