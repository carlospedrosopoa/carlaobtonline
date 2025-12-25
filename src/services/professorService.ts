// services/professorService.ts - Serviço de professores para o frontend
import { api } from '@/lib/api';
import type { Professor } from '@/types/professor';

export interface ProfessorAdmin extends Professor {
  usuario?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface CriarProfessorPayload {
  userId: string;
  especialidade?: string | null;
  bio?: string | null;
  valorHora?: number | null;
  telefoneProfissional?: string | null;
  emailProfissional?: string | null;
  fotoUrl?: string | null;
  logoUrl?: string | null;
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}

export interface AtualizarProfessorPayload {
  especialidade?: string | null;
  bio?: string | null;
  valorHora?: number | null;
  telefoneProfissional?: string | null;
  emailProfissional?: string | null;
  fotoUrl?: string | null;
  logoUrl?: string | null;
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}

export const professorService = {
  listar: async (filtros?: {
    ativo?: boolean;
    aceitaNovosAlunos?: boolean;
  }): Promise<ProfessorAdmin[]> => {
    const params = new URLSearchParams();
    if (filtros?.ativo !== undefined) params.append('ativo', String(filtros.ativo));
    if (filtros?.aceitaNovosAlunos !== undefined) params.append('aceitaNovosAlunos', String(filtros.aceitaNovosAlunos));
    const query = params.toString();
    const res = await api.get(`/professor${query ? `?${query}` : ''}`);
    return res.data as ProfessorAdmin[];
  },

  buscarPorId: async (id: string): Promise<ProfessorAdmin> => {
    const res = await api.get(`/professor/${id}`);
    return res.data as ProfessorAdmin;
  },

  criar: async (payload: CriarProfessorPayload): Promise<ProfessorAdmin> => {
    const res = await api.post('/professor', payload);
    return res.data as ProfessorAdmin;
  },

  atualizar: async (id: string, payload: AtualizarProfessorPayload): Promise<ProfessorAdmin> => {
    const res = await api.put(`/professor/${id}`, payload);
    return res.data as ProfessorAdmin;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/professor/${id}`);
  },
};

