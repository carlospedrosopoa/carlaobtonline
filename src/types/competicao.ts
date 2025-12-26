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

export type RodadaCompeticao = "QUARTAS_FINAL" | "SEMIFINAL" | "FINAL" | "RODADA_1" | "RODADA_2" | "RODADA_3" | "RODADA_4" | "RODADA_5" | "RODADA_6" | "RODADA_7";
export type StatusJogoCompeticao = "AGENDADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

export interface JogoCompeticao {
  id: string;
  competicaoId: string;
  rodada: RodadaCompeticao;
  numeroJogo: number;
  atleta1Id?: string | null;
  atleta2Id?: string | null;
  atleta1ParceriaId?: string | null;
  atleta2ParceriaId?: string | null;
  vencedorId?: string | null;
  pontosAtleta1?: number | null;
  pontosAtleta2?: number | null;
  gamesAtleta1?: number | null;
  gamesAtleta2?: number | null;
  tiebreakAtleta1?: number | null;
  tiebreakAtleta2?: number | null;
  dataHora?: string | null;
  quadraId?: string | null;
  quadra?: {
    id: string;
    nome: string;
  } | null;
  status: StatusJogoCompeticao;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Dados dos participantes (preenchidos pela API)
  participante1?: {
    atletaId?: string;
    parceriaId?: string;
    nome: string;
    dupla?: {
      atleta1: { id: string; nome: string };
      atleta2: { id: string; nome: string };
    };
  } | null;
  participante2?: {
    atletaId?: string;
    parceriaId?: string;
    nome: string;
    dupla?: {
      atleta1: { id: string; nome: string };
      atleta2: { id: string; nome: string };
    };
  } | null;
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
  jogos?: JogoCompeticao[];
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

