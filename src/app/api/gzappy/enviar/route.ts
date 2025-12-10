// app/api/gzappy/enviar/route.ts - API para enviar mensagens via Gzappy
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioFromRequest } from '@/lib/auth';
import { enviarMensagemGzappy, formatarNumeroGzappy } from '@/lib/gzappyService';

/**
 * POST /api/gzappy/enviar
 * Envia uma mensagem via Gzappy para um número específico
 * 
 * Body:
 * {
 *   destinatario: string, // Número de telefone (será formatado automaticamente)
 *   mensagem: string,     // Texto da mensagem
 *   tipo?: 'texto' | 'template'
 *   pointId?: string      // ID da arena (opcional, usa do usuário se não fornecido)
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
        { mensagem: 'Apenas administradores e organizadores podem enviar mensagens' },
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

    // Formatar número do destinatário
    const numeroFormatado = formatarNumeroGzappy(destinatario);

    // Determinar pointId (prioridade: fornecido > pointIdGestor do usuário)
    const pointIdFinal = pointId || (usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : undefined);

    if (!pointIdFinal) {
      return NextResponse.json(
        { mensagem: 'Arena não identificada. É necessário fornecer pointId ou ser um organizador de uma arena.' },
        { status: 400 }
      );
    }

    // Enviar mensagem via Gzappy
    try {
      console.log('📱 Tentando enviar mensagem via Gzappy:', {
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
        tamanhoMensagem: mensagem.trim().length,
      });

      const sucesso = await enviarMensagemGzappy({
        destinatario: numeroFormatado,
        mensagem: mensagem.trim(),
        tipo: tipo || 'texto',
      }, pointIdFinal);

      if (!sucesso) {
        console.error('❌ Falha ao enviar mensagem via Gzappy (retornou false)', {
          destinatario: numeroFormatado,
          pointId: pointIdFinal,
        });
        return NextResponse.json(
          { mensagem: 'Erro ao enviar mensagem via Gzappy. Verifique as configurações da arena e os logs do servidor.' },
          { status: 500 }
        );
      }

      console.log('✅ Mensagem Gzappy enviada com sucesso:', {
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
      });

      return NextResponse.json({
        sucesso: true,
        mensagem: 'Mensagem enviada com sucesso',
        destinatario: numeroFormatado,
      });
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem via Gzappy:', {
        error: error.message,
        stack: error.stack,
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
      });

      // Capturar erros específicos do Gzappy
      if (error.message?.includes('Gzappy') || error.message?.includes('JWT Token') || error.message?.includes('API Key') || error.message?.includes('Instance ID')) {
        return NextResponse.json(
          { 
            mensagem: error.message,
            detalhes: 'Verifique se as credenciais do Gzappy estão corretas e ativas nas configurações da arena.'
          },
          { status: 400 }
        );
      }
      throw error; // Re-lançar outros erros
    }
  } catch (error: any) {
    console.error('Erro ao enviar mensagem via Gzappy:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao processar requisição', error: error.message },
      { status: 500 }
    );
  }
}

