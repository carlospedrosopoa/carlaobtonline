// src/services/competicaoService.ts
import { api } from "@/lib/api";
import type {
  Competicao,
  CriarCompeticaoPayload,
  AtualizarCompeticaoPayload,
  AdicionarAtletaCompeticaoPayload,
  AtletaCompeticao,
} from "@/types/competicao";

export const competicaoService = {
  listar: async (pointId?: string, status?: string, tipo?: string): Promise<Competicao[]> => {
    const params: string[] = [];
    if (pointId) params.push(`pointId=${pointId}`);
    if (status) params.push(`status=${status}`);
    if (tipo) params.push(`tipo=${tipo}`);

    const queryString = params.length > 0 ? `?${params.join("&")}` : "";
    const res = await api.get(`/competicao${queryString}`);
    return res.data;
  },

  obter: async (id: string): Promise<Competicao> => {
    const res = await api.get(`/competicao/${id}`);
    return res.data;
  },

  criar: async (payload: CriarCompeticaoPayload): Promise<Competicao> => {
    const res = await api.post("/competicao", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarCompeticaoPayload): Promise<Competicao> => {
    const res = await api.put(`/competicao/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/competicao/${id}`);
  },

  adicionarAtleta: async (competicaoId: string, payload: AdicionarAtletaCompeticaoPayload): Promise<AtletaCompeticao> => {
    const res = await api.post(`/competicao/${competicaoId}/atletas`, payload);
    return res.data;
  },

  removerAtleta: async (competicaoId: string, atletaId: string): Promise<void> => {
    await api.delete(`/competicao/${competicaoId}/atletas/${atletaId}`);
  },
};

