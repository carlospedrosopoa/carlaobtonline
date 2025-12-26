// src/types/competicao.ts

export type TipoCompeticao = "SUPER_8";
export type FormatoCompeticao = "DUPLAS" | "INDIVIDUAL";
export type StatusCompeticao = "CRIADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface AtletaCompeticao {
  id: string;
  competicaoId: string;
  atletaId: string;
  atleta?: {
    id: string;
    nome: string;
    fotoUrl?: string | null;
    fone?: string;
    usuario?: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  // Para duplas: parceriaId identifica duplas formadas
  parceriaId?: string | null;
  parceiroAtletaId?: string | null;
  parceiro?: {
    id: string;
    nome: string;
    fotoUrl?: string | null;
  } | null;
  posicaoFinal?: number | null;
  pontos?: number | null;
  createdAt: string;
}

export interface Competicao {
  id: string;
  pointId: string;
  point?: {
    id: string;
    nome: string;
  };
  quadraId?: string | null;
  quadra?: {
    id: string;
    nome: string;
  };
  nome: string;
  tipo: TipoCompeticao;
  formato: FormatoCompeticao;
  status: StatusCompeticao;
  dataInicio?: string | null; // ISO string
  dataFim?: string | null; // ISO string
  descricao?: string | null;
  valorInscricao?: number | null;
  premio?: string | null;
  regras?: string | null;
  // Configurações específicas do Super 8
  configSuper8?: {
    pontosPorVitoria?: number;
    pontosPorDerrota?: number;
    formatoPontuacao?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  atletasParticipantes?: AtletaCompeticao[];
}

export interface CriarCompeticaoPayload {
  pointId: string;
  quadraId?: string | null;
  nome: string;
  tipo: TipoCompeticao;
  formato: FormatoCompeticao;
  dataInicio?: string | null;
  dataFim?: string | null;
  descricao?: string | null;
  valorInscricao?: number | null;
  premio?: string | null;
  regras?: string | null;
  configSuper8?: {
    pontosPorVitoria?: number;
    pontosPorDerrota?: number;
    formatoPontuacao?: string;
  } | null;
}

export interface AtualizarCompeticaoPayload {
  quadraId?: string | null;
  nome?: string;
  status?: StatusCompeticao;
  dataInicio?: string | null;
  dataFim?: string | null;
  descricao?: string | null;
  valorInscricao?: number | null;
  premio?: string | null;
  regras?: string | null;
  configSuper8?: {
    pontosPorVitoria?: number;
    pontosPorDerrota?: number;
    formatoPontuacao?: string;
  } | null;
}

export interface AdicionarAtletaCompeticaoPayload {
  atletaId: string;
  // Para duplas: opcionalmente adicionar com parceiro
  parceiroAtletaId?: string | null;
}

