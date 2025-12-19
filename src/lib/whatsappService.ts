// lib/whatsappService.ts - Serviço para envio de mensagens WhatsApp
import { query } from './db';

export interface MensagemWhatsApp {
  destinatario: string; // Número no formato internacional (ex: 5511999999999)
  mensagem: string;
  tipo?: 'texto' | 'template';
}

export interface TemplateWhatsApp {
  nome: string; // Nome do template aprovado pela Meta
  linguagem: string; // Código do idioma (ex: 'pt_BR')
  componentes?: Array<{
    type: 'body' | 'header' | 'button';
    parameters?: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string; filename: string };
      video?: { link: string };
    }>;
  }>;
}

/**
 * Obtém as credenciais do WhatsApp de um point específico
 */
export async function obterCredenciaisWhatsApp(pointId: string): Promise<{
  accessToken: string | null;
  phoneNumberId: string | null;
  apiVersion: string;
} | null> {
  try {
    const result = await query(
      `SELECT 
        "whatsappAccessToken",
        "whatsappPhoneNumberId",
        "whatsappApiVersion",
        "whatsappAtivo"
      FROM "Point"
      WHERE id = $1 AND "whatsappAtivo" = true`,
      [pointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const point = result.rows[0];
    
    if (!point.whatsappAccessToken || !point.whatsappPhoneNumberId) {
      console.warn('⚠️ Point não possui credenciais WhatsApp configuradas ou token/phoneNumberId estão vazios', {
        pointId,
        temToken: !!point.whatsappAccessToken,
        temPhoneNumberId: !!point.whatsappPhoneNumberId,
      });
      return null;
    }

    // Validar que o token não está vazio após trim
    const tokenLimpo = point.whatsappAccessToken.trim();
    if (!tokenLimpo || tokenLimpo.length === 0) {
      console.warn('⚠️ Token WhatsApp do point está vazio após trim', { pointId });
      return null;
    }

    return {
      accessToken: tokenLimpo,
      phoneNumberId: point.whatsappPhoneNumberId.trim(),
      apiVersion: point.whatsappApiVersion || 'v21.0',
    };
  } catch (error: any) {
    console.error('Erro ao obter credenciais WhatsApp do point:', error);
    return null;
  }
}

/**
 * Envia uma mensagem WhatsApp para um número usando a WhatsApp Business API da Meta
 * 
 * Documentação: https://developers.facebook.com/docs/whatsapp
 * 
 * @param mensagem - Dados da mensagem a ser enviada
 * @param pointId - ID do point (arena) para buscar credenciais específicas
 * @param tentativas - Número de tentativas em caso de falha (padrão: 3)
 * @returns Promise<boolean> - true se enviado com sucesso, false caso contrário
 */
export async function enviarMensagemWhatsApp(
  mensagem: MensagemWhatsApp,
  pointId?: string,
  tentativas: number = 3
): Promise<boolean> {
  // Obter credenciais da API da Meta
  let accessToken: string | null = null;
  let phoneNumberId: string | null = null;
  let apiVersion: string = 'v21.0';

  // Se pointId fornecido, buscar credenciais do point
  if (pointId) {
    const credenciais = await obterCredenciaisWhatsApp(pointId);
    if (credenciais) {
      accessToken = credenciais.accessToken;
      phoneNumberId = credenciais.phoneNumberId;
      apiVersion = credenciais.apiVersion;
    }
  }

  // Se não encontrou credenciais do point, tentar variáveis de ambiente (fallback)
  if (!accessToken || !phoneNumberId) {
    accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN || null;
    phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || null;
    apiVersion = process.env.META_WHATSAPP_API_VERSION || 'v21.0';
  }

  // Verificar se as credenciais estão configuradas
  if (!accessToken || !phoneNumberId) {
    console.warn('⚠️ WhatsApp API não configurada. Configure META_WHATSAPP_ACCESS_TOKEN e META_WHATSAPP_PHONE_NUMBER_ID');
    console.log('📱 WhatsApp - Simulando envio de mensagem:', {
      para: mensagem.destinatario,
      mensagem: mensagem.mensagem.substring(0, 50) + '...',
      tipo: mensagem.tipo || 'texto',
    });
    // Em desenvolvimento, retorna true para não quebrar o fluxo
    return process.env.NODE_ENV === 'development';
  }

  // Validar formato do token (deve ser uma string não vazia e sem espaços extras)
  const tokenLimpo = accessToken.trim();
  if (!tokenLimpo || tokenLimpo.length === 0) {
    const erroMsg = 'Token de acesso WhatsApp inválido: token está vazio ou contém apenas espaços. Verifique as configurações da arena.';
    console.error('❌', erroMsg, { pointId: pointId || 'não fornecido' });
    throw new Error(erroMsg);
  }

  // Verificar se o token parece válido (deve começar com caracteres alfanuméricos)
  if (!/^[A-Za-z0-9]/.test(tokenLimpo)) {
    const erroMsg = 'Token de acesso WhatsApp inválido: formato incorreto. Verifique as configurações da arena.';
    console.error('❌', erroMsg, { pointId: pointId || 'não fornecido', tokenPreview: tokenLimpo.substring(0, 10) + '...' });
    throw new Error(erroMsg);
  }

  // Validar formato do Phone Number ID (deve ser um ID numérico da Meta, não um número de telefone)
  const phoneNumberIdLimpo = phoneNumberId.trim();
  if (!phoneNumberIdLimpo || phoneNumberIdLimpo.length === 0) {
    const erroMsg = 'Phone Number ID inválido: está vazio. Verifique as configurações da arena.';
    console.error('❌', erroMsg, { pointId: pointId || 'não fornecido' });
    throw new Error(erroMsg);
  }

  // Phone Number ID da Meta geralmente tem 15-17 dígitos
  // Se tiver 13 dígitos ou menos e começar com código de país (55), provavelmente é um número de telefone
  // Vamos apenas avisar, mas não bloquear completamente (pode haver casos especiais)
  if (phoneNumberIdLimpo.startsWith('55') && phoneNumberIdLimpo.length <= 13) {
    console.warn('⚠️ ATENÇÃO: Phone Number ID parece ser um número de telefone:', {
      phoneNumberIdRecebido: phoneNumberIdLimpo,
      pointId: pointId || 'não fornecido',
      aviso: 'O Phone Number ID deve ser o ID numérico encontrado em WhatsApp → API Setup, não o número de telefone em si. Se este erro persistir, verifique as configurações da arena.'
    });
    // Não bloqueamos aqui, deixamos a API da Meta retornar o erro se estiver incorreto
  }

  // URL da API da Meta
  const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberIdLimpo}/messages`;

  // Preparar o payload da mensagem
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: mensagem.destinatario,
    type: 'text',
    text: {
      preview_url: false, // Desabilita preview de links (pode ser true se necessário)
      body: mensagem.mensagem,
    },
  };

  // Tentar enviar com retry
  let ultimoErro: any = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenLimpo}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Verificar se é um erro recuperável
        const errorCode = responseData.error?.code;
        const errorType = responseData.error?.type;
        
        // Erros não recuperáveis (não tentar novamente)
        if (
          errorCode === 100 || // Invalid parameter
          errorCode === 190 || // Invalid OAuth access token
          errorCode === 80007 || // Message undeliverable
          errorType === 'OAuthException'
        ) {
          const mensagemErro = errorCode === 190 
            ? 'Token de acesso WhatsApp inválido ou expirado. Verifique as configurações da arena.'
            : `Erro na API WhatsApp: ${responseData.error?.message || 'Erro desconhecido'}`;
          
          console.error('❌ Erro não recuperável ao enviar mensagem WhatsApp:', {
            status: response.status,
            error: responseData.error,
            destinatario: mensagem.destinatario,
            tentativa,
            mensagemErro,
            pointId: pointId || 'não fornecido',
          });
          
          // Lançar erro com mensagem mais clara para ser capturado pela API route
          throw new Error(mensagemErro);
        }

        // Erros recuperáveis (rate limit, timeout, etc)
        if (tentativa < tentativas) {
          const delay = Math.min(1000 * Math.pow(2, tentativa - 1), 10000); // Backoff exponencial (max 10s)
          console.warn(`⚠️ Erro ao enviar mensagem WhatsApp (tentativa ${tentativa}/${tentativas}), tentando novamente em ${delay}ms:`, {
            status: response.status,
            error: responseData.error,
            destinatario: mensagem.destinatario,
          });
          ultimoErro = responseData.error;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Última tentativa falhou
        console.error('❌ Erro ao enviar mensagem WhatsApp após todas as tentativas:', {
          status: response.status,
          error: responseData.error,
          destinatario: mensagem.destinatario,
          tentativas,
        });
        return false;
      }

      // Sucesso
      console.log('✅ Mensagem WhatsApp enviada com sucesso:', {
        messageId: responseData.messages?.[0]?.id,
        destinatario: mensagem.destinatario,
        tentativa,
      });

      return true;
    } catch (error: any) {
      ultimoErro = error;
      
      // Se não for a última tentativa, tentar novamente
      if (tentativa < tentativas) {
        const delay = Math.min(1000 * Math.pow(2, tentativa - 1), 10000);
        console.warn(`⚠️ Erro de rede ao enviar mensagem WhatsApp (tentativa ${tentativa}/${tentativas}), tentando novamente em ${delay}ms:`, {
          error: error.message,
          destinatario: mensagem.destinatario,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Última tentativa falhou
      console.error('❌ Erro ao enviar mensagem WhatsApp após todas as tentativas:', {
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
 * Envia uma mensagem usando template aprovado pela Meta
 * 
 * @param destinatario - Número do destinatário
 * @param template - Dados do template
 * @returns Promise<boolean> - true se enviado com sucesso
 */
export async function enviarTemplateWhatsApp(
  destinatario: string,
  template: TemplateWhatsApp
): Promise<boolean> {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_WHATSAPP_API_VERSION || 'v21.0';

  if (!accessToken || !phoneNumberId) {
    console.warn('⚠️ WhatsApp API não configurada');
    return false;
  }

  const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatarNumeroWhatsApp(destinatario),
    type: 'template',
    template: {
      name: template.nome,
      language: { code: template.linguagem },
      components: template.componentes || [],
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Erro ao enviar template WhatsApp:', {
        status: response.status,
        error: responseData.error,
        destinatario,
        template: template.nome,
      });
      return false;
    }

    console.log('✅ Template WhatsApp enviado com sucesso:', {
      messageId: responseData.messages?.[0]?.id,
      destinatario,
      template: template.nome,
    });

    return true;
  } catch (error: any) {
    console.error('❌ Erro ao enviar template WhatsApp:', {
      error: error.message,
      destinatario,
      template: template.nome,
    });
    return false;
  }
}

/**
 * Obtém o número do WhatsApp do gestor de uma arena (point)
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
 * Formata número de telefone para formato internacional (apenas números)
 */
export function formatarNumeroWhatsApp(telefone: string): string {
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
  // Ajuste conforme necessário
  return `55${apenasNumeros}`;
}

/**
 * Envia notificação de novo agendamento para o gestor
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

  // A data vem do banco em UTC (salva como toISOString())
  // Precisamos converter para horário de Brasília (UTC-3)
  // Interpretar como UTC e subtrair 3 horas
  const dataHoraStr = agendamento.dataHora.endsWith('Z') || agendamento.dataHora.includes('+') || agendamento.dataHora.includes('-') && agendamento.dataHora.length > 19
    ? agendamento.dataHora
    : agendamento.dataHora + 'Z';
  const dataHora = new Date(dataHoraStr);
  
  // Converter de UTC para UTC-3 (Brasília): subtrair 3 horas
  const dataHoraBrasilia = new Date(dataHora.getTime() - (3 * 60 * 60 * 1000));
  
  // Extrair valores no horário de Brasília
  const ano = dataHoraBrasilia.getUTCFullYear();
  const mes = String(dataHoraBrasilia.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dataHoraBrasilia.getUTCDate()).padStart(2, '0');
  const hora = String(dataHoraBrasilia.getUTCHours()).padStart(2, '0');
  const minuto = String(dataHoraBrasilia.getUTCMinutes()).padStart(2, '0');
  
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const horaFormatada = `${hora}:${minuto}`;

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

  return await enviarMensagemWhatsApp({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId); // Passar pointId para usar credenciais específicas
}

/**
 * Envia notificação de cancelamento de agendamento para o gestor
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

  // A data vem do banco em UTC (salva como toISOString())
  // Precisamos converter para horário de Brasília (UTC-3)
  // Interpretar como UTC e subtrair 3 horas
  const dataHoraStr = agendamento.dataHora.endsWith('Z') || agendamento.dataHora.includes('+') || agendamento.dataHora.includes('-') && agendamento.dataHora.length > 19
    ? agendamento.dataHora
    : agendamento.dataHora + 'Z';
  const dataHora = new Date(dataHoraStr);
  
  // Converter de UTC para UTC-3 (Brasília): subtrair 3 horas
  const dataHoraBrasilia = new Date(dataHora.getTime() - (3 * 60 * 60 * 1000));
  
  // Extrair valores no horário de Brasília
  const ano = dataHoraBrasilia.getUTCFullYear();
  const mes = String(dataHoraBrasilia.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dataHoraBrasilia.getUTCDate()).padStart(2, '0');
  const hora = String(dataHoraBrasilia.getUTCHours()).padStart(2, '0');
  const minuto = String(dataHoraBrasilia.getUTCMinutes()).padStart(2, '0');
  
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const horaFormatada = `${hora}:${minuto}`;

  const mensagem = `❌ *Agendamento Cancelado*

Quadra: ${agendamento.quadra}
Data: ${dataFormatada}
Horário: ${horaFormatada}
Cliente: ${agendamento.cliente}

O agendamento foi cancelado.`;

  return await enviarMensagemWhatsApp({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId); // Passar pointId para usar credenciais específicas
}

