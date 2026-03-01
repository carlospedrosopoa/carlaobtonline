import { api } from '@/lib/api';
import type { Apoiador, AtualizarApoiadorPayload, CriarApoiadorPayload } from '@/types/apoiador';

export const apoiadorService = {
  listar: async (): Promise<Apoiador[]> => {
    const { data } = await api.get('/admin/apoiadores');
    return data as Apoiador[];
  },

  obter: async (id: string): Promise<Apoiador> => {
    const { data } = await api.get(`/admin/apoiadores/${id}`);
    return data as Apoiador;
  },

  criar: async (payload: CriarApoiadorPayload): Promise<Apoiador> => {
    const { data } = await api.post('/admin/apoiadores', payload);
    return data as Apoiador;
  },

  atualizar: async (id: string, payload: AtualizarApoiadorPayload): Promise<Apoiador> => {
    const { data } = await api.put(`/admin/apoiadores/${id}`, payload);
    return data as Apoiador;
  },

  remover: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/admin/apoiadores/${id}`);
    return data as { ok: boolean };
  },
};
