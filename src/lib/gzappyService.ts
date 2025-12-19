// lib/gzappyService.ts - Serviço para envio de mensagens via Gzappy
import { query } from './db';

export interface MensagemGzappy {
  destinatario: string; // Número no formato internacional (ex: 5511999999999)
  mensagem: string;
  tipo?: 'texto' | 'template';
}

/**
 * Obtém as credenciais do Gzappy de um point específico
 */
export async function obterCredenciaisGzappy(pointId: string): Promise<{
  apiKey: string | null;
  instanceId: string | null;
} | null> {
  try {
    // Tentar buscar com campos Gzappy (se existirem)
    let result;
    try {
      result = await query(
        `SELECT 
          "gzappyApiKey",
          "gzappyInstanceId",
          "gzappyAtivo"
        FROM "Point"
        WHERE id = $1 AND "gzappyAtivo" = true`,
        [pointId]
      );
    } catch (error: any) {
      // Se falhar (colunas Gzappy não existem), retornar null
      if (error.message?.includes('gzappy') || error.message?.includes('column') || error.code === '42703') {
        console.warn('⚠️ Campos Gzappy não encontrados no banco de dados. Execute a migration adicionar-gzappy-point.sql', {
          pointId,
          error: error.message,
        });
        return null;
      }
      throw error;
    }

    if (result.rows.length === 0) {
      console.warn('⚠️ Point não encontrado ou Gzappy não está ativo', { pointId });
      return null;
    }

    const point = result.rows[0];
    
    // Apenas o JWT Token (apiKey) é obrigatório para autenticação
    if (!point.gzappyApiKey) {
      console.warn('⚠️ Point não possui JWT Token Gzappy configurado', {
        pointId,
        temApiKey: !!point.gzappyApiKey,
        temInstanceId: !!point.gzappyInstanceId,
        gzappyAtivo: point.gzappyAtivo,
      });
      return null;
    }

    // Validar que o JWT Token não está vazio após trim
    const apiKeyLimpa = point.gzappyApiKey.trim();
    if (!apiKeyLimpa || apiKeyLimpa.length === 0) {
      console.warn('⚠️ JWT Token Gzappy do point está vazio após trim', { pointId });
      return null;
    }

    return {
      apiKey: apiKeyLimpa,
      instanceId: point.gzappyInstanceId?.trim() || null, // Instance ID é opcional (apenas para identificação)
    };
  } catch (error: any) {
    console.error('❌ Erro ao obter credenciais Gzappy do point:', {
      pointId,
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Envia uma mensagem via Gzappy
 * 
 * Documentação: https://v2-api.gzappy.com/message/send-text
 * 
 * @param mensagem - Dados da mensagem a ser enviada
 * @param pointId - ID do point (arena) para buscar credenciais específicas
 * @param tentativas - Número de tentativas em caso de falha (padrão: 3)
 * @returns Promise<boolean> - true se enviado com sucesso, false caso contrário
 */
export async function enviarMensagemGzappy(
  mensagem: MensagemGzappy,
  pointId?: string,
  tentativas: number = 3
): Promise<boolean> {
  // Obter credenciais do Gzappy
  let apiKey: string | null = null;
  let instanceId: string | null = null;

  // Se pointId fornecido, buscar credenciais do point
  if (pointId) {
    const credenciais = await obterCredenciaisGzappy(pointId);
    if (credenciais) {
      apiKey = credenciais.apiKey;
      instanceId = credenciais.instanceId;
    }
  }

  // Se não encontrou credenciais do point, tentar variáveis de ambiente (fallback)
  if (!apiKey) {
    apiKey = process.env.GZAPPY_API_KEY || null;
    instanceId = process.env.GZAPPY_INSTANCE_ID || instanceId || null;
  }

  // Verificar se o JWT Token está configurado (único campo obrigatório)
  if (!apiKey) {
    const erroMsg = pointId 
      ? 'Gzappy não está configurado para esta arena. Configure o JWT Token nas configurações da arena.'
      : 'Gzappy API não configurada. Configure GZAPPY_API_KEY ou configure nas credenciais da arena.';
    
    console.warn('⚠️', erroMsg, {
      pointId: pointId || 'não fornecido',
      temApiKey: !!apiKey,
      temInstanceId: !!instanceId,
    });
    
    // Em produção, lançar erro para que seja capturado pela API route
    if (process.env.NODE_ENV === 'production') {
      throw new Error(erroMsg);
    }
    
    // Em desenvolvimento, retorna false para indicar falha
    return false;
  }

  // Validar formato do JWT Token (API Key é na verdade um JWT Token)
  const apiKeyLimpa = apiKey.trim();
  if (!apiKeyLimpa || apiKeyLimpa.length === 0) {
    const erroMsg = 'JWT Token Gzappy inválido: está vazio. Verifique as configurações da arena.';
    console.error('❌', erroMsg, { pointId: pointId || 'não fornecido' });
    throw new Error(erroMsg);
  }

  // Instance ID é usado apenas para identificação/configuração
  // Não é necessário na requisição HTTP (o JWT Token já contém essa informação)
  const instanceIdLimpo = instanceId?.trim() || null;

  // URL da API do Gzappy (conforme documentação: https://docs.gzappy.com)
  const apiUrl = 'https://v2-api.gzappy.com/message/send-text';

  // Preparar o payload da mensagem conforme documentação
  const payload = {
    phone: mensagem.destinatario,
    message: mensagem.mensagem,
  };

  // Tentar enviar com retry
  // Rate limiting: 10 requisições por segundo por IP/instância (conforme documentação)
  let ultimoErro: any = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      // Preparar headers
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKeyLimpa}`, // JWT Token conforme documentação
        'Content-Type': 'application/json',
      };

      // Se Instance ID estiver disponível, adicionar como header (pode ser necessário)
      if (instanceIdLimpo) {
        headers['X-Instance-Id'] = instanceIdLimpo;
      }

      console.log('📤 Enviando requisição para Gzappy:', {
        url: apiUrl,
        payload,
        headers: {
          ...headers,
          'Authorization': `Bearer ${apiKeyLimpa.substring(0, 20)}...`, // Log apenas início do token por segurança
          'X-Instance-Id': instanceIdLimpo || 'não fornecido',
        },
        pointId: pointId || 'não fornecido',
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      let responseData: any;
      try {
        const responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = {};
        }
      } catch (parseError: any) {
        console.error('❌ Erro ao fazer parse da resposta do Gzappy:', {
          status: response.status,
          statusText: response.statusText,
          responseText: 'Não foi possível ler a resposta',
          parseError: parseError.message,
        });
        throw new Error(`Erro ao processar resposta da API Gzappy: ${parseError.message}`);
      }

      if (!response.ok) {
        // Verificar se é um erro recuperável
        const errorCode = responseData.status_code || response.status;
        
        // Erros não recuperáveis (não tentar novamente)
        if (
          errorCode === 400 || // Bad Request
          errorCode === 401 || // Unauthorized
          errorCode === 403    // Forbidden
        ) {
          const mensagemErro = errorCode === 401 
            ? `JWT Token Gzappy inválido ou expirado. ${responseData.action || 'Verifique se o token está correto nas configurações da arena.'}`
            : errorCode === 403
            ? 'Acesso negado. Verifique se o JWT Token está correto.'
            : `Erro na API Gzappy: ${responseData.message || 'Erro desconhecido'}`;
          
          console.error('❌ Erro não recuperável ao enviar mensagem Gzappy:', {
            status: response.status,
            error: responseData,
            destinatario: mensagem.destinatario,
            tentativa,
            mensagemErro,
            pointId: pointId || 'não fornecido',
          });
          
          throw new Error(mensagemErro);
        }

        // Erros recuperáveis (rate limit, timeout, etc)
        if (tentativa < tentativas) {
          const delay = Math.min(1000 * Math.pow(2, tentativa - 1), 10000); // Backoff exponencial (max 10s)
          console.warn(`⚠️ Erro ao enviar mensagem Gzappy (tentativa ${tentativa}/${tentativas}), tentando novamente em ${delay}ms:`, {
            status: response.status,
            error: responseData,
            destinatario: mensagem.destinatario,
          });
          ultimoErro = responseData;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Última tentativa falhou
        console.error('❌ Erro ao enviar mensagem Gzappy após todas as tentativas:', {
          status: response.status,
          error: responseData,
          destinatario: mensagem.destinatario,
          tentativas,
        });
        return false;
      }

      // Sucesso
      console.log('✅ Mensagem Gzappy enviada com sucesso:', {
        messageId: responseData.data?.messageId,
        status: responseData.data?.status,
        destinatario: mensagem.destinatario,
        tentativa,
      });

      return true;
    } catch (error: any) {
      ultimoErro = error;
      
      // Se não for a última tentativa, tentar novamente
      if (tentativa < tentativas) {
        const delay = Math.min(1000 * Math.pow(2, tentativa - 1), 10000);
        console.warn(`⚠️ Erro de rede ao enviar mensagem Gzappy (tentativa ${tentativa}/${tentativas}), tentando novamente em ${delay}ms:`, {
          error: error.message,
          destinatario: mensagem.destinatario,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Última tentativa falhou
      console.error('❌ Erro ao enviar mensagem Gzappy após todas as tentativas:', {
        error: error.message,
        stack: error.stack,
        destinatario: mensagem.destinatario,
        tentativas,
      });
      return false;
    }
  }

  return false;
}

/**
 * Formata número de telefone para formato internacional (apenas números)
 */
export function formatarNumeroGzappy(telefone: string): string {
  // Remove todos os caracteres não numéricos
  const apenasNumeros = telefone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (apenasNumeros.startsWith('0')) {
    return apenasNumeros.substring(1);
  }
  
  // Se não começar com código do país (55 para Brasil), adiciona
  if (apenasNumeros.length === 11 && apenasNumeros.startsWith('11')) {
    // Assumindo DDD 11 (São Paulo) - adiciona código do país
    return `55${apenasNumeros}`;
  }
  
  // Se já tem código do país, retorna como está
  if (apenasNumeros.length >= 12) {
    return apenasNumeros;
  }
  
  // Para outros casos, assume que precisa adicionar código do país
  return `55${apenasNumeros}`;
}

/**
 * Obtém o número do WhatsApp do gestor de uma arena (point)
 * Usa o mesmo campo do WhatsApp oficial, pois é apenas o número de telefone
 */
export async function obterWhatsAppGestor(pointId: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT u.whatsapp 
       FROM "User" u 
       WHERE u.role = 'ORGANIZER' 
       AND u."pointIdGestor" = $1 
       AND u.whatsapp IS NOT NULL 
       AND u.whatsapp != '' 
       LIMIT 1`,
      [pointId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].whatsapp;
    }

    return null;
  } catch (error: any) {
    console.error('Erro ao obter WhatsApp do gestor:', error);
    return null;
  }
}

/**
 * Envia notificação de novo agendamento para o gestor via Gzappy
 */
export async function notificarNovoAgendamento(
  pointId: string,
  agendamento: {
    quadra: string;
    dataHora: string;
    cliente: string;
    telefone?: string | null;
    duracao: number;
  }
): Promise<boolean> {
  const whatsappGestor = await obterWhatsAppGestor(pointId);
  
  if (!whatsappGestor) {
    console.log('Gestor não possui WhatsApp cadastrado');
    return false;
  }

  // Corrigir timezone: a data vem do banco em UTC, mas precisa ser exibida no horário local (UTC-3)
  const dataHora = new Date(agendamento.dataHora);
  // Ajustar para timezone de Brasília (UTC-3)
  const dataHoraLocal = new Date(dataHora.getTime() - (3 * 60 * 60 * 1000));
  
  const dataFormatada = dataHoraLocal.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
  const horaFormatada = dataHoraLocal.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const horas = Math.floor(agendamento.duracao / 60);
  const minutos = agendamento.duracao % 60;
  const duracaoTexto = horas > 0 
    ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
    : `${minutos}min`;

  const mensagem = `🏸 *Novo Agendamento Confirmado*

Quadra: ${agendamento.quadra}
Data: ${dataFormatada}
Horário: ${horaFormatada}
Duração: ${duracaoTexto}
Cliente: ${agendamento.cliente}${agendamento.telefone ? `\nTelefone: ${agendamento.telefone}` : ''}

Agendamento confirmado com sucesso! ✅`;

  return await enviarMensagemGzappy({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

/**
 * Envia notificação de cancelamento de agendamento para o gestor via Gzappy
 */
export async function notificarCancelamentoAgendamento(
  pointId: string,
  agendamento: {
    quadra: string;
    dataHora: string;
    cliente: string;
  }
): Promise<boolean> {
  const whatsappGestor = await obterWhatsAppGestor(pointId);
  
  if (!whatsappGestor) {
    return false;
  }

  // Corrigir timezone: a data vem do banco em UTC, mas precisa ser exibida no horário local (UTC-3)
  const dataHora = new Date(agendamento.dataHora);
  // Ajustar para timezone de Brasília (UTC-3)
  const dataHoraLocal = new Date(dataHora.getTime() - (3 * 60 * 60 * 1000));
  
  const dataFormatada = dataHoraLocal.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
  const horaFormatada = dataHoraLocal.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const mensagem = `❌ *Agendamento Cancelado*

Quadra: ${agendamento.quadra}
Data: ${dataFormatada}
Horário: ${horaFormatada}
Cliente: ${agendamento.cliente}

O agendamento foi cancelado.`;

  return await enviarMensagemGzappy({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

