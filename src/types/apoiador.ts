export interface Apoiador {
  id: string;
  nome: string;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
  logoUrl?: string | null;
  exibirColorido?: boolean;
  regiaoIds?: string[];
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CriarApoiadorPayload {
  nome: string;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
  logoUrl?: string | null;
  exibirColorido?: boolean;
  ativo?: boolean;
  regiaoIds?: string[];
}

export interface AtualizarApoiadorPayload {
  nome?: string;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
  logoUrl?: string | null;
  exibirColorido?: boolean;
  ativo?: boolean;
  regiaoIds?: string[];
}
