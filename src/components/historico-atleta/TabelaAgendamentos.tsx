'use client';

import type { HistoricoAtletaAgendamento } from '@/services/gestaoArenaService';

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDuracao(minutos: number) {
  if (!Number.isFinite(minutos) || minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export default function TabelaAgendamentos({
  itens,
  onDetalhe,
}: {
  itens: HistoricoAtletaAgendamento[];
  onDetalhe: (item: HistoricoAtletaAgendamento) => void;
}) {
  if (itens.length === 0) {
    return <div className="text-sm text-gray-600">Nenhum agendamento no período.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quadra</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duração</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {itens.map((a) => {
            const valor = a.valorNegociado ?? a.valorCalculado;
            return (
              <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDetalhe(a)}>
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDataHora(a.dataHora)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{a.quadra?.nome || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDuracao(a.duracao)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{a.status}</td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                  {valor !== null ? formatarMoeda(valor) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

