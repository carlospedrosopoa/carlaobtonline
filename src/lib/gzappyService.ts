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
    const result = await query(
      `SELECT 
        "gzappyApiKey",
        "gzappyInstanceId",
        "gzappyAtivo"
      FROM "Point"
      WHERE id = $1 AND "gzappyAtivo" = true`,
      [pointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const point = result.rows[0];
    
    // Apenas o JWT Token (apiKey) é obrigatório para autenticação
    if (!point.gzappyApiKey) {
      console.warn('⚠️ Point não possui JWT Token Gzappy configurado', {
        pointId,
        temApiKey: !!point.gzappyApiKey,
        temInstanceId: !!point.gzappyInstanceId,
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
    console.error('Erro ao obter credenciais Gzappy do point:', error);
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
    console.warn('⚠️ Gzappy API não configurada. Configure GZAPPY_API_KEY ou configure nas credenciais da arena');
    console.log('📱 Gzappy - Simulando envio de mensagem:', {
      para: mensagem.destinatario,
      mensagem: mensagem.mensagem.substring(0, 50) + '...',
      tipo: mensagem.tipo || 'texto',
    });
    // Em desenvolvimento, retorna true para não quebrar o fluxo
    return process.env.NODE_ENV === 'development';
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
  let ultimoErro: any = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyLimpa}`, // JWT Token conforme documentação
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

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
            ? 'JWT Token Gzappy inválido ou expirado. Verifique as configurações da arena.'
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
 * Formata valor em reais para exibição
 */
function formatarValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
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
    valor?: number | null;
    nomeArena?: string;
  }
): Promise<boolean> {
  const whatsappGestor = await obterWhatsAppGestor(pointId);
  
  if (!whatsappGestor) {
    console.log('Gestor não possui WhatsApp cadastrado');
    return false;
  }

  // Extrair data e hora diretamente da string ISO
  let dataFormatada: string;
  let horaFormatada: string;
  
  const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!matchDataHora) {
    const dataHora = new Date(agendamento.dataHora);
    dataFormatada = dataHora.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    horaFormatada = dataHora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    const [, ano, mes, dia, hora, minuto] = matchDataHora;
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  }

  const horas = Math.floor(agendamento.duracao / 60);
  const minutos = agendamento.duracao % 60;
  const duracaoTexto = horas > 0 
    ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
    : `${minutos}min`;

  // Obter nome da arena se não foi fornecido
  let nomeArena = agendamento.nomeArena;
  if (!nomeArena) {
    try {
      const result = await query('SELECT nome FROM "Point" WHERE id = $1', [pointId]);
      if (result.rows.length > 0) {
        nomeArena = result.rows[0].nome;
      }
    } catch (error) {
      console.error('Erro ao buscar nome da arena:', error);
    }
  }

  const valorFormatado = formatarValor(agendamento.valor);

  const mensagem = `${nomeArena ? `*${nomeArena}*\n\n` : ''}✅ *Agendamento Confirmado*

👤 *Atleta:* ${agendamento.cliente}
🔍 *Quadra:* ${agendamento.quadra}
📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
⏱️ *Duração:* ${duracaoTexto}
💰 *Valor:* ${valorFormatado}

Esperamos você! 🎾`;

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
    atletaNotificado?: boolean; // Indica se o atleta foi notificado do cancelamento
  }
): Promise<boolean> {
  const whatsappGestor = await obterWhatsAppGestor(pointId);
  
  if (!whatsappGestor) {
    return false;
  }

  // Extrair data e hora diretamente da string ISO, igual a agenda faz
  let dataFormatada: string;
  let horaFormatada: string;
  
  const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!matchDataHora) {
    // Fallback se o formato não for o esperado
    const dataHora = new Date(agendamento.dataHora);
    const ano = dataHora.getFullYear();
    const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
    const dia = String(dataHora.getDate()).padStart(2, '0');
    const hora = String(dataHora.getHours()).padStart(2, '0');
    const minuto = String(dataHora.getMinutes()).padStart(2, '0');
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  } else {
    // Extrair diretamente da string ISO (mesmo método usado na agenda)
    const [, ano, mes, dia, hora, minuto] = matchDataHora;
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  }

  // Montar mensagem base
  let mensagem = `❌ *Agendamento Cancelado*

Quadra: ${agendamento.quadra}
Data: ${dataFormatada}
Horário: ${horaFormatada}
Atleta: ${agendamento.cliente}

O agendamento foi cancelado.`;

  // Adicionar informação sobre notificação do atleta se aplicável
  if (agendamento.atletaNotificado === true) {
    mensagem += `\n\n✅ *O atleta foi notificado do cancelamento via WhatsApp.*`;
  } else if (agendamento.atletaNotificado === false) {
    mensagem += `\n\n⚠️ *O atleta não foi notificado (telefone não cadastrado).*`;
  }

  return await enviarMensagemGzappy({
    destinatario: whatsappGestor,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

/**
 * Envia notificação de cancelamento de agendamento para o atleta via Gzappy
 * Usado quando a arena (ORGANIZER/ADMIN) cancela um agendamento
 */
export async function notificarAtletaCancelamentoAgendamento(
  telefoneAtleta: string,
  pointId: string,
  agendamento: {
    quadra: string;
    arena: string;
    dataHora: string;
  }
): Promise<boolean> {
  if (!telefoneAtleta || telefoneAtleta.trim() === '') {
    console.log('Atleta não possui telefone cadastrado para notificação');
    return false;
  }

  // Formatar número para formato internacional
  const telefoneFormatado = formatarNumeroGzappy(telefoneAtleta);

  // Extrair data e hora diretamente da string ISO, igual a agenda faz
  let dataFormatada: string;
  let horaFormatada: string;
  
  const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!matchDataHora) {
    // Fallback se o formato não for o esperado
    const dataHora = new Date(agendamento.dataHora);
    const ano = dataHora.getFullYear();
    const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
    const dia = String(dataHora.getDate()).padStart(2, '0');
    const hora = String(dataHora.getHours()).padStart(2, '0');
    const minuto = String(dataHora.getMinutes()).padStart(2, '0');
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  } else {
    // Extrair diretamente da string ISO (mesmo método usado na agenda)
    const [, ano, mes, dia, hora, minuto] = matchDataHora;
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  }

  const mensagem = `❌ *Agendamento Cancelado pela Arena*

Olá! Infelizmente seu agendamento foi cancelado pela arena.

🏸 *Quadra:* ${agendamento.quadra}
🏢 *Arena:* ${agendamento.arena}
📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}

Entre em contato com a arena para mais informações ou reagendar.`;

  return await enviarMensagemGzappy({
    destinatario: telefoneFormatado,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

/**
 * Envia notificação de confirmação de novo agendamento para o atleta via Gzappy
 * Usado quando um novo agendamento é criado e o perfil não é temporário
 */
export async function notificarAtletaNovoAgendamento(
  telefoneAtleta: string,
  pointId: string,
  agendamento: {
    quadra: string;
    arena: string;
    dataHora: string;
    duracao: number;
    valor?: number | null;
    nomeAtleta?: string;
  }
): Promise<boolean> {
  if (!telefoneAtleta || telefoneAtleta.trim() === '') {
    console.log('Atleta não possui telefone cadastrado para notificação de confirmação');
    return false;
  }

  // Formatar número para formato internacional
  const telefoneFormatado = formatarNumeroGzappy(telefoneAtleta);

  // Extrair data e hora diretamente da string ISO, igual a agenda faz
  let dataFormatada: string;
  let horaFormatada: string;
  
  const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!matchDataHora) {
    // Fallback se o formato não for o esperado
    const dataHora = new Date(agendamento.dataHora);
    const ano = dataHora.getFullYear();
    const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
    const dia = String(dataHora.getDate()).padStart(2, '0');
    const hora = String(dataHora.getHours()).padStart(2, '0');
    const minuto = String(dataHora.getMinutes()).padStart(2, '0');
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  } else {
    // Extrair diretamente da string ISO (mesmo método usado na agenda)
    const [, ano, mes, dia, hora, minuto] = matchDataHora;
    dataFormatada = `${dia}/${mes}/${ano}`;
    horaFormatada = `${hora}:${minuto}`;
  }

  const horas = Math.floor(agendamento.duracao / 60);
  const minutos = agendamento.duracao % 60;
  const duracaoTexto = horas > 0 
    ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
    : `${minutos}min`;

  const valorFormatado = formatarValor(agendamento.valor);
  const nomeAtleta = agendamento.nomeAtleta || 'Atleta';

  const mensagem = `*${agendamento.arena}*

✅ *Agendamento Confirmado*

👤 *Atleta:* ${nomeAtleta}
🔍 *Quadra:* ${agendamento.quadra}
📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
⏱️ *Duração:* ${duracaoTexto}
💰 *Valor:* ${valorFormatado}

Esperamos você! 🎾`;

  return await enviarMensagemGzappy({
    destinatario: telefoneFormatado,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

/**
 * Envia notificação de alteração de data/hora do agendamento para o atleta via Gzappy
 */
export async function notificarAtletaAlteracaoAgendamento(
  telefoneAtleta: string,
  pointId: string,
  agendamento: {
    quadra: string;
    arena: string;
    dataHoraAnterior: string;
    dataHoraNova: string;
    nomeAtleta?: string;
  }
): Promise<boolean> {
  if (!telefoneAtleta || telefoneAtleta.trim() === '') {
    console.log('Atleta não possui telefone cadastrado para notificação de alteração');
    return false;
  }

  const telefoneFormatado = formatarNumeroGzappy(telefoneAtleta);

  const formatarDataHora = (dataHoraIso: string) => {
    const matchDataHora = dataHoraIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!matchDataHora) {
      const dataHora = new Date(dataHoraIso);
      const ano = dataHora.getFullYear();
      const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
      const dia = String(dataHora.getDate()).padStart(2, '0');
      const hora = String(dataHora.getHours()).padStart(2, '0');
      const minuto = String(dataHora.getMinutes()).padStart(2, '0');
      return {
        data: `${dia}/${mes}/${ano}`,
        hora: `${hora}:${minuto}`,
      };
    }

    const [, ano, mes, dia, hora, minuto] = matchDataHora;
    return {
      data: `${dia}/${mes}/${ano}`,
      hora: `${hora}:${minuto}`,
    };
  };

  const anterior = formatarDataHora(agendamento.dataHoraAnterior);
  const nova = formatarDataHora(agendamento.dataHoraNova);
  const nomeAtleta = agendamento.nomeAtleta || 'Atleta';

  const mensagem = `*${agendamento.arena}*

🔄 *Agendamento Alterado*

Olá ${nomeAtleta}, seu agendamento foi atualizado.

🔍 *Quadra:* ${agendamento.quadra}

*Antes*
📅 Data: ${anterior.data}
🕐 Horário: ${anterior.hora}

*Agora*
📅 Data: ${nova.data}
🕐 Horário: ${nova.hora}

Se precisar, fale com a arena.`;

  return await enviarMensagemGzappy({
    destinatario: telefoneFormatado,
    mensagem,
    tipo: 'texto',
  }, pointId);
}

