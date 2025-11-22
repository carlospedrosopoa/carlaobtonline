// lib/whatsappService.ts - Serviço para envio de mensagens WhatsApp
import { query } from './db';

export interface MensagemWhatsApp {
  destinatario: string; // Número no formato internacional (ex: 5511999999999)
  mensagem: string;
  tipo?: 'texto' | 'template';
}

/**
 * Envia uma mensagem WhatsApp para um número
 * 
 * Esta função é um wrapper que pode ser adaptado para diferentes APIs de WhatsApp:
 * - WhatsApp Business API (Meta)
 * - Evolution API
 * - Twilio WhatsApp API
 * - etc.
 * 
 * Por enquanto, apenas registra no console. Implemente a integração real conforme necessário.
 */
export async function enviarMensagemWhatsApp(mensagem: MensagemWhatsApp): Promise<boolean> {
  try {
    // TODO: Implementar integração real com API de WhatsApp
    // Exemplos de APIs que podem ser usadas:
    // 1. WhatsApp Business API (Meta) - https://developers.facebook.com/docs/whatsapp
    // 2. Evolution API - https://evolution-api.com/
    // 3. Twilio WhatsApp API - https://www.twilio.com/whatsapp
    
    // Por enquanto, apenas log (para desenvolvimento)
    console.log('📱 WhatsApp - Enviando mensagem:', {
      para: mensagem.destinatario,
      mensagem: mensagem.mensagem,
      tipo: mensagem.tipo || 'texto',
    });

    // Exemplo de implementação com Evolution API:
    /*
    const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY;
    
    const response = await fetch(`${evolutionApiUrl}/message/sendText/instanceName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey || '',
      },
      body: JSON.stringify({
        number: mensagem.destinatario,
        text: mensagem.mensagem,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar WhatsApp: ${response.statusText}`);
    }

    return true;
    */

    // Exemplo de implementação com Twilio:
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER; // formato: whatsapp:+14155238886

    const client = require('twilio')(accountSid, authToken);

    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: `whatsapp:+${mensagem.destinatario}`,
      body: mensagem.mensagem,
    });

    return true;
    */

    // Por enquanto, retorna true (simula sucesso)
    return true;
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
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

