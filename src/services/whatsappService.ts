// services/whatsappService.ts - Serviço frontend para WhatsApp
import { api } from '@/lib/api';

export interface EnviarMensagemPayload {
  destinatario: string;
  mensagem: string;
  tipo?: 'texto' | 'template';
  pointId?: string; // ID da arena para usar credenciais específicas
}

export interface EnviarMensagemResponse {
  sucesso: boolean;
  mensagem: string;
  destinatario: string;
}

export const whatsappService = {
  /**
   * Envia uma mensagem WhatsApp
   */
  enviar: async (payload: EnviarMensagemPayload): Promise<EnviarMensagemResponse> => {
    const response = await api.post<EnviarMensagemResponse>('/whatsapp/enviar', payload);
    return response.data;
  },
};

