import { api } from "@/lib/api";

export type ClientApp = "APP_ATLETA" | "ARENA_FRONT";
export type PagamentoOnlineMetodo = "PIX" | "CREDIT_CARD";

export interface CriarPagamentoOnlinePayload {
  cardId: string;
  cpf: string;
  paymentMethod: PagamentoOnlineMetodo;
  valor?: number;
  cardEncrypted?: string;
  descricao?: string;
  orderId?: string;
}

export interface CriarPagamentoOnlineResponse {
  transactionId: string;
  orderId: string;
  pagbankOrderId: string | null;
  status: string;
  qrCode: {
    text?: string;
    links?: Array<{ rel: string; href: string }>;
  } | null;
  links: Array<{ rel: string; href: string }> | null;
}

export interface ConsultarStatusPagamentoOnlineResponse {
  status: string;
}

export const pagamentoOnlineService = {
  criar: async (
    payload: CriarPagamentoOnlinePayload,
    clientApp: ClientApp = "APP_ATLETA"
  ): Promise<CriarPagamentoOnlineResponse> => {
    const res = await api.post("/user/pagamento/online/checkout", payload, {
      headers: { "X-Client_APP": clientApp },
    });
    return res.data;
  },

  status: async (
    transactionId: string,
    clientApp: ClientApp = "APP_ATLETA"
  ): Promise<ConsultarStatusPagamentoOnlineResponse> => {
    const res = await api.get(`/user/pagamento/online/status/${transactionId}`, {
      headers: { "X-Client_APP": clientApp },
    });
    return res.data;
  },
};

