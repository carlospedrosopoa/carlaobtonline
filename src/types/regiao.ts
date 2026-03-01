import type { RegiaoGeojson } from '@/lib/regiaoGeo';

export interface Regiao {
  id: string;
  nome: string;
  ativo: boolean;
  limiteGeojson: RegiaoGeojson;
  centroLat: number | null;
  centroLng: number | null;
  createdAt?: string;
  updatedAt?: string;
  pointIds?: string[];
  arenasCount?: number;
}

export type CriarRegiaoPayload = {
  nome: string;
  limiteGeojson: RegiaoGeojson;
  pointIds: string[];
  ativo?: boolean;
};

export type AtualizarRegiaoPayload = Partial<CriarRegiaoPayload>;
