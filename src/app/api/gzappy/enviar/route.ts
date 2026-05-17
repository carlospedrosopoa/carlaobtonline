// app/api/gzappy/enviar/route.ts - API para enviar mensagens via Gzappy
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioFromRequest } from '@/lib/auth';
import {
  atualizarStatusInteracaoAgendamento,
  enviarMensagemGzappy,
  formatarNumeroGzappy,
  montarInstrucoesInteracao,
  registrarInteracaoAgendamento,
  type RegistroInteracaoAgendamento,
} from '@/lib/gzappyService';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function anexarInstrucoesInteracaoSeNecessario(
  mensagem: string,
  interacaoAgendamento?: {
    metadata?: Record<string, any>;
  }
): string {
  if (!interacaoAgendamento) {
    return mensagem;
  }

  if (
    mensagem.includes('1 - Confirmo o horário 👍') ||
    mensagem.includes('Por favor responda esta mensagem com 1 ou 2, sendo:')
  ) {
    return mensagem;
  }

  const arena =
    typeof interacaoAgendamento.metadata?.arena === 'string' &&
    interacaoAgendamento.metadata.arena.trim()
      ? interacaoAgendamento.metadata.arena.trim()
      : 'Arena';

  const possuiIdentificacaoSistema =
    mensagem.includes('Mensagem enviada pelo sistema Play Na Quadra') ||
    mensagem.includes('Esta mensagem foi enviada automaticamente pelo sistema Play Na Quadra');

  const mensagemBase = possuiIdentificacaoSistema
    ? mensagem
    : `${mensagem}\nMensagem enviada pelo sistema Play Na Quadra`;

  return `${mensagemBase}${montarInstrucoesInteracao(arena)}`;
}

/**
 * OPTIONS /api/gzappy/enviar - Preflight CORS
 */
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

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
      const response = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(response, request);
    }

    // Verificar permissões (apenas ADMIN e ORGANIZER podem enviar)
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const response = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem enviar mensagens' },
        { status: 403 }
      );
      return withCors(response, request);
    }

    const body = await request.json();
    const { destinatario, mensagem, tipo, pointId, interacaoAgendamento } = body as {
      destinatario?: string;
      mensagem?: string;
      tipo?: 'texto' | 'template';
      pointId?: string;
      interacaoAgendamento?: Omit<RegistroInteracaoAgendamento, 'pointId' | 'phone' | 'mensagemEnviada'> & {
        metadata?: Record<string, any>;
      };
    };

    // Validações
    if (!destinatario || !mensagem) {
      const response = NextResponse.json(
        { mensagem: 'Destinatário e mensagem são obrigatórios' },
        { status: 400 }
      );
      return withCors(response, request);
    }

    if (typeof mensagem !== 'string' || mensagem.trim().length === 0) {
      const response = NextResponse.json(
        { mensagem: 'A mensagem não pode estar vazia' },
        { status: 400 }
      );
      return withCors(response, request);
    }

    if (mensagem.length > 4096) {
      const response = NextResponse.json(
        { mensagem: 'A mensagem não pode ter mais de 4096 caracteres' },
        { status: 400 }
      );
      return withCors(response, request);
    }

    // Formatar número do destinatário
    const numeroFormatado = formatarNumeroGzappy(destinatario);

    // Determinar pointId (prioridade: fornecido > pointIdGestor do usuário)
    const pointIdFinal = pointId || (usuario.role === 'ORGANIZER' ? usuario.pointIdGestor : undefined);

    if (!pointIdFinal) {
      const response = NextResponse.json(
        { mensagem: 'Arena não identificada. É necessário fornecer pointId ou ser um organizador de uma arena.' },
        { status: 400 }
      );
      return withCors(response, request);
    }

    let interacaoId: string | null = null;

    // Enviar mensagem via Gzappy
    try {
      console.log('📱 Tentando enviar mensagem via Gzappy:', {
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
        tamanhoMensagem: mensagem.trim().length,
      });

      const mensagemFinal = anexarInstrucoesInteracaoSeNecessario(
        mensagem.trim(),
        interacaoAgendamento
      );

      interacaoId =
        interacaoAgendamento?.agendamentoId && interacaoAgendamento?.tipo
          ? await registrarInteracaoAgendamento({
              agendamentoId: interacaoAgendamento.agendamentoId,
              pointId: pointIdFinal,
              phone: numeroFormatado,
              tipo: interacaoAgendamento.tipo,
              mensagemEnviada: mensagemFinal,
              metadata: interacaoAgendamento.metadata || {},
              status: 'AGUARDANDO_ENVIO',
            })
          : null;

      const sucesso = await enviarMensagemGzappy({
        destinatario: numeroFormatado,
        mensagem: mensagemFinal,
        tipo: tipo || 'texto',
      }, pointIdFinal);

      if (!sucesso) {
        if (interacaoId) {
          await atualizarStatusInteracaoAgendamento(interacaoId, 'FALHA_ENVIO');
        }
        console.error('❌ Falha ao enviar mensagem via Gzappy (retornou false)', {
          destinatario: numeroFormatado,
          pointId: pointIdFinal,
        });
        const response = NextResponse.json(
          { mensagem: 'Erro ao enviar mensagem via Gzappy. Verifique as configurações da arena e os logs do servidor.' },
          { status: 500 }
        );
        return withCors(response, request);
      }

      console.log('✅ Mensagem Gzappy enviada com sucesso:', {
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
      });

      if (interacaoId) {
        await atualizarStatusInteracaoAgendamento(interacaoId, 'AGUARDANDO_RESPOSTA');
      }

      const response = NextResponse.json({
        sucesso: true,
        mensagem: 'Mensagem enviada com sucesso',
        destinatario: numeroFormatado,
      });
      return withCors(response, request);
    } catch (error: any) {
      if (interacaoId) {
        await atualizarStatusInteracaoAgendamento(interacaoId, 'FALHA_ENVIO');
      }
      console.error('❌ Erro ao enviar mensagem via Gzappy:', {
        error: error.message,
        stack: error.stack,
        destinatario: numeroFormatado,
        pointId: pointIdFinal,
      });

      // Capturar erros específicos do Gzappy
      if (error.message?.includes('Gzappy') || error.message?.includes('JWT Token') || error.message?.includes('API Key') || error.message?.includes('Instance ID')) {
        const response = NextResponse.json(
          { 
            mensagem: error.message,
            detalhes: 'Verifique se as credenciais do Gzappy estão corretas e ativas nas configurações da arena.'
          },
          { status: 400 }
        );
        return withCors(response, request);
      }
      throw error; // Re-lançar outros erros
    }
  } catch (error: any) {
    console.error('Erro ao enviar mensagem via Gzappy:', error);
    const response = NextResponse.json(
      { mensagem: 'Erro ao processar requisição', error: error.message },
      { status: 500 }
    );
    return withCors(response, request);
  }
}

