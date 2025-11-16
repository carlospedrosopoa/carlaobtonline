// types/domain.ts
export interface Atleta {
  id: string;
  nome: string;
  dataNascimento?: string;
  genero?: string;
  fone?: string;
  categoria?: string;
  idade?: number;
  fotoUrl?: string;
  usuarioId?: string;
}

export interface Partida {
  id: string;
  data: string;
  local: string;
  atleta1?: Atleta;
  atleta2?: Atleta;
  atleta3?: Atleta;
  atleta4?: Atleta;
  gamesTime1: number | null;
  gamesTime2: number | null;
  tiebreakTime1?: number | null;
  tiebreakTime2?: number | null;
}

