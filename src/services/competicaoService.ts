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

  gerarJogos: async (competicaoId: string): Promise<{ mensagem: string; jogos: any[] }> => {
    const res = await api.post(`/competicao/${competicaoId}/gerar-jogos`);
    return res.data;
  },

  listarJogos: async (competicaoId: string): Promise<any[]> => {
    const res = await api.get(`/competicao/${competicaoId}/jogos`);
    return res.data;
  },

  excluirJogos: async (competicaoId: string): Promise<{ mensagem: string; jogosExcluidos: number }> => {
    const res = await api.delete(`/competicao/${competicaoId}/jogos`);
    return res.data;
  },

  atualizarResultadoJogo: async (
    competicaoId: string,
    jogoId: string,
    resultado: {
      gamesAtleta1?: number | null;
      gamesAtleta2?: number | null;
      dataHora?: string | null;
      quadraId?: string | null;
      observacoes?: string | null;
      status?: string;
    }
  ): Promise<any> => {
    const res = await api.put(`/competicao/${competicaoId}/jogos/${jogoId}`, resultado);
    return res.data;
  },

  finalizarCompeticao: async (
    competicaoId: string,
    classificacao: Array<{
      atletaId: string;
      nome: string;
      vitorias: number;
      derrotas: number;
      gamesFeitos: number;
      gamesSofridos: number;
      saldoGames: number;
    }>
  ): Promise<any> => {
    const res = await api.post(`/competicao/${competicaoId}/finalizar`, { classificacao });
    return res.data;
  },

  reabrirCompeticao: async (competicaoId: string): Promise<any> => {
    const res = await api.post(`/competicao/${competicaoId}/reabrir`);
    return res.data;
  },
};

