import { api } from '@/lib/api';
import type { AtualizarRegiaoPayload, CriarRegiaoPayload, Regiao } from '@/types/regiao';

export const regiaoService = {
  listar: async (): Promise<Regiao[]> => {
    const { data } = await api.get('/regiao');
    return data as Regiao[];
  },

  obter: async (id: string): Promise<Regiao> => {
    const { data } = await api.get(`/regiao/${id}`);
    return data as Regiao;
  },

  criar: async (payload: CriarRegiaoPayload): Promise<Regiao> => {
    const { data } = await api.post('/regiao', payload);
    return data as Regiao;
  },

  atualizar: async (id: string, payload: AtualizarRegiaoPayload): Promise<Regiao> => {
    const { data } = await api.put(`/regiao/${id}`, payload);
    return data as Regiao;
  },

  remover: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/regiao/${id}`);
    return data as { ok: boolean };
  },
};
