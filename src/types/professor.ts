// types/professor.ts - Tipos TypeScript para o módulo de professores

export type TipoAula = 'INDIVIDUAL' | 'GRUPO' | 'TURMA';
export type NivelAula = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
export type StatusAula = 'AGENDADA' | 'CONFIRMADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'ADIADA';
export type StatusInscricao = 'CONFIRMADO' | 'AGUARDANDO' | 'CANCELADO' | 'FALTOU';

export interface RecorrenciaConfig {
  tipo: 'DIARIO' | 'SEMANAL' | 'MENSAL';
  intervalo?: number; // Para SEMANAL: 1 = toda semana, 2 = a cada 2 semanas, etc.
  diasSemana?: number[]; // Para SEMANAL: [1,3,5] = segunda, quarta, sexta (0=domingo, 1=segunda, etc)
  diaMes?: number; // Para MENSAL: dia do mês (1-31)
  dataFim?: string; // Data de término da recorrência (ISO string)
  quantidadeOcorrencias?: number; // Número máximo de ocorrências
}

export interface Professor {
  id: string;
  userId: string;
  especialidade?: string | null;
  bio?: string | null;
  valorHora?: number | null;
  telefoneProfissional?: string | null;
  emailProfissional?: string | null;
  fotoUrl?: string | null;
  logoUrl?: string | null;
  ativo: boolean;
  aceitaNovosAlunos: boolean;
  pointIdPrincipal?: string | null;
  arenasFrequentes?: Array<{
    id: string;
    nome: string;
    logoUrl?: string | null;
  }>;
  arenaPrincipal?: {
    id: string;
    nome: string;
    logoUrl?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  usuario?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface CriarProfessorPayload {
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

export interface Aula {
  id: string;
  professorId: string;
  agendamentoId: string;
  titulo: string;
  descricao?: string | null;
  tipoAula: TipoAula;
  nivel?: NivelAula | null;
  maxAlunos: number;
  valorPorAluno?: number | null;
  valorTotal?: number | null;
  status: StatusAula;
  dataInicio: string;
  dataFim?: string | null;
  recorrenciaId?: string | null;
  recorrenciaConfig?: RecorrenciaConfig | null;
  observacoes?: string | null;
  materialNecessario?: string | null;
  createdAt: string;
  updatedAt: string;
  professor?: {
    id: string;
    userId: string;
    especialidade?: string | null;
    usuario?: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
  agendamento?: {
    id: string;
    quadraId: string;
    dataHora: string;
    duracao: number;
    status: string;
    quadra?: {
      id: string;
      nome: string;
      tipo?: string | null;
      point?: {
        id: string;
        nome: string;
      } | null;
    } | null;
  } | null;
  _count?: {
    alunos: number;
  };
}

export interface CriarAulaPayload {
  professorId: string;
  agendamentoId: string;
  titulo: string;
  descricao?: string | null;
  tipoAula: TipoAula;
  nivel?: NivelAula | null;
  maxAlunos?: number;
  valorPorAluno?: number | null;
  valorTotal?: number | null;
  status?: StatusAula;
  dataInicio: string;
  dataFim?: string | null;
  recorrenciaId?: string | null;
  recorrenciaConfig?: RecorrenciaConfig | null;
  observacoes?: string | null;
  materialNecessario?: string | null;
}

export interface AtualizarAulaPayload {
  titulo?: string;
  descricao?: string | null;
  tipoAula?: TipoAula;
  nivel?: NivelAula | null;
  maxAlunos?: number;
  valorPorAluno?: number | null;
  valorTotal?: number | null;
  status?: StatusAula;
  dataInicio?: string;
  dataFim?: string | null;
  observacoes?: string | null;
  materialNecessario?: string | null;
}

export interface AlunoAula {
  id: string;
  aulaId: string;
  atletaId: string;
  statusInscricao: StatusInscricao;
  presenca?: boolean | null;
  valorPago?: number | null;
  valorDevido?: number | null;
  pagamentoId?: string | null;
  observacao?: string | null;
  notaAluno?: string | null;
  inscritoEm: string;
  canceladoEm?: string | null;
  createdAt: string;
  updatedAt: string;
  atleta?: {
    id: string;
    nome: string;
    fone?: string | null;
    fotoUrl?: string | null;
  } | null;
  aula?: {
    id: string;
    titulo: string;
  } | null;
}

export interface InscricaoAlunoPayload {
  aulaId: string;
  atletaId: string;
  statusInscricao?: StatusInscricao;
  valorPago?: number | null;
  valorDevido?: number | null;
}

export interface AlunoProfessor {
  id: string;
  professorId: string;
  atletaId: string;
  nivel?: NivelAula | null;
  observacoes?: string | null;
  ativo: boolean;
  iniciadoEm: string;
  encerradoEm?: string | null;
  createdAt: string;
  updatedAt: string;
  professor?: Professor | null;
  atleta?: {
    id: string;
    nome: string;
    fone?: string | null;
    fotoUrl?: string | null;
  } | null;
}

export interface CriarAlunoProfessorPayload {
  professorId: string;
  atletaId: string;
  nivel?: NivelAula | null;
  observacoes?: string | null;
  ativo?: boolean;
}

export interface AvaliacaoAluno {
  id: string;
  aulaId: string;
  professorId: string;
  atletaId: string;
  nota?: number | null;
  comentario?: string | null;
  pontosPositivos?: string | null;
  pontosMelhorar?: string | null;
  tecnica?: number | null;
  fisico?: number | null;
  comportamento?: number | null;
  avaliadoEm: string;
  createdAt: string;
  updatedAt: string;
  atleta?: {
    id: string;
    nome: string;
  } | null;
  aula?: {
    id: string;
    titulo: string;
  } | null;
}

export interface CriarAvaliacaoAlunoPayload {
  aulaId: string;
  professorId: string;
  atletaId: string;
  nota?: number | null;
  comentario?: string | null;
  pontosPositivos?: string | null;
  pontosMelhorar?: string | null;
  tecnica?: number | null;
  fisico?: number | null;
  comportamento?: number | null;
}

export interface FiltrosAula {
  status?: StatusAula;
  dataInicio?: string;
  dataFim?: string;
  professorId?: string;
}

export interface FiltrosProfessor {
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
}

