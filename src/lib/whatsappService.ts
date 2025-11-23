// lib/whatsappService.ts - Serviço para envio de mensagens WhatsApp
import { query } from './db';

export interface MensagemWhatsApp {
  destinatario: string; // Número no formato internacional (ex: 5511999999999)
  mensagem: string;
  tipo?: 'texto' | 'template';
}

/**
 * Envia uma mensagem WhatsApp para um número usando a WhatsApp Business API da Meta
 * 
 * Documentação: https://developers.facebook.com/docs/whatsapp
 */
export async function enviarMensagemWhatsApp(mensagem: MensagemWhatsApp): Promise<boolean> {
  try {
    // Obter credenciais da API da Meta
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WHATSAPP_API_VERSION || 'v21.0';

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

    // URL da API da Meta
    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    // Preparar o payload da mensagem
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: mensagem.destinatario,
      type: 'text',
      text: {
        preview_url: false, // Desabilita preview de links (pode ser true se necessário)
        body: mensagem.mensagem,
      },
    };

    // Enviar requisição para a API da Meta
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
      // Log detalhado do erro
      console.error('❌ Erro ao enviar mensagem WhatsApp:', {
        status: response.status,
        statusText: response.statusText,
        error: responseData.error || responseData,
        destinatario: mensagem.destinatario,
      });
      return false;
    }

    // Sucesso
    console.log('✅ Mensagem WhatsApp enviada com sucesso:', {
      messageId: responseData.messages?.[0]?.id,
      destinatario: mensagem.destinatario,
    });

    return true;
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', {
      error: error.message,
      stack: error.stack,
      destinatario: mensagem.destinatario,
    });
    // Não lançar erro para não quebrar o fluxo principal
    // Apenas logar o erro
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

  const dataHora = new Date(agendamento.dataHora);
  const dataFormatada = dataHora.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaFormatada = dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
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

  return await enviarMensagemWhatsApp({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  });
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

  const dataHora = new Date(agendamento.dataHora);
  const dataFormatada = dataHora.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaFormatada = dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

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
  });
}

