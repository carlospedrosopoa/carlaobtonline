// src/services/agendamentoService.ts
import { api } from "@/lib/api";
import type {
  Point,
  Quadra,
  Agendamento,
  TabelaPreco,
  CriarPointPayload,
  CriarQuadraPayload,
  CriarAgendamentoPayload,
  AtualizarAgendamentoPayload,
  FiltrosAgendamento,
  BloqueioAgenda,
  CriarBloqueioAgendaPayload,
  AtualizarBloqueioAgendaPayload,
} from "@/types/agendamento";

// ========== POINTS ==========
export const pointService = {
  listar: async (): Promise<Point[]> => {
    const res = await api.get("/point");
    return res.data;
  },

  obter: async (id: string): Promise<Point> => {
    const res = await api.get(`/point/${id}`);
    return res.data;
  },

  criar: async (payload: CriarPointPayload): Promise<Point> => {
    const res = await api.post("/point", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: Partial<CriarPointPayload>): Promise<Point> => {
    const res = await api.put(`/point/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/point/${id}`);
  },
};

// ========== QUADRAS ==========
export const quadraService = {
  listar: async (pointId?: string): Promise<Quadra[]> => {
    const params = pointId ? `?pointId=${pointId}` : "";
    const res = await api.get(`/quadra${params}`);
    return res.data;
  },

  obter: async (id: string): Promise<Quadra> => {
    const res = await api.get(`/quadra/${id}`);
    return res.data;
  },

  criar: async (payload: CriarQuadraPayload): Promise<Quadra> => {
    const res = await api.post("/quadra", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: Partial<CriarQuadraPayload>): Promise<Quadra> => {
    const res = await api.put(`/quadra/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/quadra/${id}`);
  },
};

// ========== AGENDAMENTOS ==========
export const agendamentoService = {
  listar: async (filtros?: FiltrosAgendamento): Promise<Agendamento[]> => {
    const params: string[] = [];
    if (filtros?.quadraId) params.push(`quadraId=${filtros.quadraId}`);
    if (filtros?.pointId) params.push(`pointId=${filtros.pointId}`);
    if (filtros?.dataInicio) params.push(`dataInicio=${filtros.dataInicio}`);
    if (filtros?.dataFim) params.push(`dataFim=${filtros.dataFim}`);
    if (filtros?.status) params.push(`status=${filtros.status}`);
    if (filtros?.apenasMeus) params.push(`apenasMeus=true`);

    const queryString = params.length > 0 ? `?${params.join("&")}` : "";
    const res = await api.get(`/agendamento${queryString}`);
    return res.data;
  },

  obter: async (id: string): Promise<Agendamento> => {
    const res = await api.get(`/agendamento/${id}`);
    return res.data;
  },

  criar: async (payload: CriarAgendamentoPayload): Promise<Agendamento> => {
    const res = await api.post("/agendamento", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarAgendamentoPayload): Promise<Agendamento> => {
    const res = await api.put(`/agendamento/${id}`, payload);
    return res.data;
  },

  cancelar: async (id: string, aplicarARecorrencia: boolean = false): Promise<Agendamento> => {
    const res = await api.post(`/agendamento/${id}/cancelar`, { aplicarARecorrencia });
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/agendamento/${id}`);
  },
};

// ========== TABELA DE PREÇOS ==========
export const tabelaPrecoService = {
  listar: async (quadraId?: string): Promise<TabelaPreco[]> => {
    const params = quadraId ? `?quadraId=${quadraId}` : "";
    const res = await api.get(`/tabela-preco${params}`);
    return res.data;
  },

  criar: async (payload: {
    quadraId: string;
    horaInicio: string; // "HH:mm"
    horaFim: string; // "HH:mm"
    valorHora: number;
    ativo?: boolean;
  }): Promise<TabelaPreco> => {
    const res = await api.post("/tabela-preco", payload);
    return res.data;
  },

  atualizar: async (
    id: string,
    payload: {
      horaInicio?: string;
      horaFim?: string;
      valorHora?: number;
      ativo?: boolean;
    }
  ): Promise<TabelaPreco> => {
    const res = await api.put(`/tabela-preco/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/tabela-preco/${id}`);
  },
};

// ========== BLOQUEIOS DE AGENDA ==========
export const bloqueioAgendaService = {
  listar: async (filtros?: {
    pointId?: string;
    dataInicio?: string;
    dataFim?: string;
    apenasAtivos?: boolean;
  }): Promise<BloqueioAgenda[]> => {
    const params: string[] = [];
    if (filtros?.pointId) params.push(`pointId=${filtros.pointId}`);
    if (filtros?.dataInicio) params.push(`dataInicio=${filtros.dataInicio}`);
    if (filtros?.dataFim) params.push(`dataFim=${filtros.dataFim}`);
    if (filtros?.apenasAtivos) params.push(`apenasAtivos=true`);

    const queryString = params.length > 0 ? `?${params.join("&")}` : "";
    const res = await api.get(`/bloqueio-agenda${queryString}`);
    return res.data;
  },

  obter: async (id: string): Promise<BloqueioAgenda> => {
    const res = await api.get(`/bloqueio-agenda/${id}`);
    return res.data;
  },

  criar: async (payload: CriarBloqueioAgendaPayload): Promise<BloqueioAgenda> => {
    const res = await api.post("/bloqueio-agenda", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarBloqueioAgendaPayload): Promise<BloqueioAgenda> => {
    const res = await api.put(`/bloqueio-agenda/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/bloqueio-agenda/${id}`);
  },
};


