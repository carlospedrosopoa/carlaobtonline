// services/userAtletaService.ts - Serviços para frontend externo (atletas/USER)
// Este serviço usa as novas rotas organizadas em /api/user/*
import { api } from '@/lib/api';

export interface Arena {
  id: string;
  nome: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  descricao?: string;
  logoUrl?: string;
  latitude?: number;
  longitude?: number;
  ativo: boolean;
  assinante: boolean;
}

export interface Atleta {
  id: string;
  nome: string;
  dataNascimento: string;
  genero?: string;
  categoria?: string;
  idade?: number;
  fotoUrl?: string;
  fone?: string;
  usuarioId: string;
  esportePreferido?: string | null; // Esporte preferido (padrão nas seleções)
  esportesPratica?: string[]; // Array de esportes que o atleta pratica
  pointIdPrincipal?: string | null;
  arenasFrequentes?: Array<{
    id: string;
    nome: string;
    logoUrl?: string;
  }>;
  arenaPrincipal?: {
    id: string;
    nome: string;
    logoUrl?: string;
  };
  assinante?: boolean;
}

export interface CriarAtletaPayload {
  nome: string;
  dataNascimento: string;
  categoria?: string;
  genero?: string;
  fone?: string;
  fotoUrl?: string | null;
  esportePreferido?: string | null;
  esportesPratica?: string[];
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}

export interface AtualizarAtletaPayload {
  nome?: string;
  dataNascimento?: string;
  categoria?: string;
  genero?: string;
  fone?: string;
  fotoUrl?: string | null;
  esportePreferido?: string | null;
  esportesPratica?: string[];
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}

// Serviço de autenticação para frontend externo
export const userAuthService = {
  login: async (email: string, password: string) => {
    const res = await api.post('/user/auth/login', { email, password });
    return res.data;
  },

  register: async (name: string, email: string, password: string) => {
    const res = await api.post('/user/auth/register', { name, email, password });
    return res.data;
  },

  me: async () => {
    const res = await api.get('/user/auth/me');
    return res.data;
  },
};

// Serviço de arenas para frontend externo
export const userArenaService = {
  listar: async (): Promise<Arena[]> => {
    const res = await api.get('/user/arenas/listar');
    return res.data;
  },
};

// Serviço de perfil de atleta para frontend externo
export const userAtletaService = {
  obter: async (): Promise<Atleta | null> => {
    try {
      const res = await api.get('/user/perfil/atleta');
      // 204 No Content significa que não tem perfil
      if (res.status === 204 || !res.data) {
        return null;
      }
      return res.data;
    } catch (error: any) {
      // 204 ou 404 = não tem atleta
      if (error?.status === 204 || error?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  criar: async (payload: CriarAtletaPayload): Promise<Atleta> => {
    const res = await api.post('/user/perfil/criar', payload);
    return res.data;
  },

  atualizar: async (payload: AtualizarAtletaPayload): Promise<Atleta> => {
    const res = await api.put('/user/perfil/atualizar', payload);
    return res.data;
  },
};

