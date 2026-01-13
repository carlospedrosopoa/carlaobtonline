'use client';

import { TrendingUp } from 'lucide-react';

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const TURNOS_ORDEM = ['Manhã', 'Tarde', 'Noite', 'Madrugada'];

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarHorasDeMinutos(minutos: number): string {
  const horas = minutos / 60;
  return `${horas.toFixed(1)}h`;
}

export function KpiCard({
  titulo,
  valor,
  subtitulo,
  icon,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-gray-600">{titulo}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 truncate">{valor}</div>
          {subtitulo ? <div className="mt-1 text-xs text-gray-500">{subtitulo}</div> : null}
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
          {icon ?? <TrendingUp className="w-5 h-5" />}
        </div>
      </div>
    </div>
  );
}

export function CardGrafico({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="h-72 min-h-[18rem] w-full min-w-0">{children}</div>
    </div>
  );
}

