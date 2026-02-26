import { query } from '@/lib/db';

export type HorarioAtendimentoIntervalo = { inicioMin: number; fimMin: number };
export type HorariosAtendimentoPorDia = Record<number, HorarioAtendimentoIntervalo[]>;

export function diaSemanaFromYYYYMMDD(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

export function inicioDentroDoHorario(
  horarios: HorariosAtendimentoPorDia | null,
  diaSemana: number,
  inicioMin: number
): boolean {
  if (!horarios) return true;
  const intervalos = horarios[diaSemana] || [];
  if (intervalos.length === 0) return false;
  return intervalos.some((i) => inicioMin >= i.inicioMin && inicioMin <= i.fimMin);
}

export function slotDentroDoHorario(
  horarios: HorariosAtendimentoPorDia | null,
  diaSemana: number,
  inicioMin: number,
  duracaoMin: number
): boolean {
  if (!horarios) return true;
  const intervalos = horarios[diaSemana] || [];
  if (intervalos.length === 0) return false;
  const fimMin = inicioMin + duracaoMin;
  return intervalos.some((i) => inicioMin >= i.inicioMin && fimMin <= i.fimMin);
}

export async function carregarHorariosAtendimentoPoint(pointId: string): Promise<HorariosAtendimentoPorDia | null> {
  const result = await query(
    `SELECT "diaSemana", "inicioMin", "fimMin"
     FROM "HorarioAtendimentoPoint"
     WHERE "pointId" = $1 AND ativo = true
     ORDER BY "diaSemana" ASC, "inicioMin" ASC`,
    [pointId]
  );

  if (result.rows.length === 0) return null;

  const map: HorariosAtendimentoPorDia = {};
  for (const row of result.rows) {
    const dia = Number(row.diaSemana);
    if (!map[dia]) map[dia] = [];
    map[dia].push({ inicioMin: Number(row.inicioMin), fimMin: Number(row.fimMin) });
  }

  return map;
}
