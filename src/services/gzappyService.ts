// services/gzappyService.ts - Serviço frontend para Gzappy
import { api } from '@/lib/api';

export interface EnviarMensagemGzappyPayload {
  destinatario: string;
  mensagem: string;
  tipo?: 'texto' | 'template';
  pointId?: string; // ID da arena para usar credenciais específicas
}

export interface EnviarMensagemGzappyResponse {
  sucesso: boolean;
  mensagem: string;
  destinatario?: string;
}

export const gzappyService = {
  /**
   * Envia uma mensagem via Gzappy
   */
  enviar: async (payload: EnviarMensagemGzappyPayload): Promise<EnviarMensagemGzappyResponse> => {
    const response = await api.post('/gzappy/enviar', payload);
    return response.data as EnviarMensagemGzappyResponse;
  },
};

