// services/userService.ts - Serviço de usuários para o frontend (igual ao cursor)
import { api } from '@/lib/api';

export interface UsuarioAdmin {
  id: string | number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER' | 'ORGANIZER' | string;
  pointIdGestor?: string | null;
  whatsapp?: string | null;
  createdAt?: string;
}

export interface AtualizarGestorPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'USER' | 'ORGANIZER';
  pointIdGestor?: string | null;
  whatsapp?: string | null;
}

export const userService = {
  listar: async (): Promise<UsuarioAdmin[]> => {
    const res = await api.get('/user/list');
    return res.data as UsuarioAdmin[];
  },

  atualizarGestor: async (
    id: string | number,
    payload: AtualizarGestorPayload
  ): Promise<UsuarioAdmin> => {
    const res = await api.put(`/user/${id}/gestor`, payload);
    return res.data as UsuarioAdmin;
  },

  atualizar: async (
    id: string | number,
    payload: AtualizarGestorPayload
  ): Promise<UsuarioAdmin> => {
    const res = await api.put(`/user/${id}`, payload);
    return res.data as UsuarioAdmin;
  },
};

