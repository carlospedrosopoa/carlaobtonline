// lib/gzappyService.ts - Serviço para envio de mensagens via Gzappy
// TODO: Implementar integração com Gzappy

export interface MensagemGzappy {
  destinatario: string; // Número no formato internacional (ex: 5511999999999)
  mensagem: string;
  tipo?: 'texto' | 'template';
}

/**
 * Obtém as credenciais do Gzappy de um point específico
 * TODO: Implementar busca de credenciais do Gzappy no banco de dados
 */
export async function obterCredenciaisGzappy(pointId: string): Promise<{
  apiKey: string | null;
  instanceId: string | null;
} | null> {
  // TODO: Implementar busca no banco de dados
  // Similar ao obterCredenciaisWhatsApp, mas para Gzappy
  return null;
}

/**
 * Envia uma mensagem via Gzappy
 * 
 * @param mensagem - Dados da mensagem a ser enviada
 * @param pointId - ID do point (arena) para buscar credenciais específicas
 * @returns Promise<boolean> - true se enviado com sucesso, false caso contrário
 */
export async function enviarMensagemGzappy(
  mensagem: MensagemGzappy,
  pointId?: string
): Promise<boolean> {
  // TODO: Implementar envio via API do Gzappy
  console.log('📱 Gzappy - Envio de mensagem (não implementado ainda):', {
    para: mensagem.destinatario,
    mensagem: mensagem.mensagem.substring(0, 50) + '...',
    tipo: mensagem.tipo || 'texto',
    pointId: pointId || 'não fornecido',
  });
  
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
 * TODO: Verificar se Gzappy usa o mesmo campo ou se precisa de um campo específico
 */
export async function obterWhatsAppGestor(pointId: string): Promise<string | null> {
  // TODO: Implementar busca no banco de dados
  // Pode ser o mesmo campo usado pelo WhatsApp oficial
  return null;
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
  // TODO: Implementar notificação via Gzappy
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
  // TODO: Implementar notificação via Gzappy
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

  return await enviarMensagemGzappy({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

