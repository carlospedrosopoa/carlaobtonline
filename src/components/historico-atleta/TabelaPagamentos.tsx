'use client';

import type { HistoricoAtletaPagamento } from '@/services/gestaoArenaService';

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

export default function TabelaPagamentos({
  itens,
  onDetalhe,
}: {
  itens: HistoricoAtletaPagamento[];
  onDetalhe: (item: HistoricoAtletaPagamento) => void;
}) {
  if (itens.length === 0) {
    return <div className="text-sm text-gray-600">Nenhum pagamento no período.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comanda</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {itens.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDetalhe(p)}>
              <td className="px-4 py-3 text-sm text-gray-700">{formatarDataHora(p.data)}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{typeof p.formaPagamento === 'string' ? p.formaPagamento : (p.formaPagamento as any)?.nome || '—'}</td>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatarMoeda(p.valor)}</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">#{p.numeroCard}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

