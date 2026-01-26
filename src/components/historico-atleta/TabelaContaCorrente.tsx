'use client';

import type { HistoricoAtletaContaCorrente } from '@/services/gestaoArenaService';

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

export default function TabelaContaCorrente({
  data,
  onDetalhe,
}: {
  data: HistoricoAtletaContaCorrente | null;
  onDetalhe: (item: any) => void;
}) {
  if (!data || !data.lancamentos || data.lancamentos.length === 0) {
    return (
      <div className="space-y-3">
        {data && (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Saldo atual</div>
            <div className={`text-lg font-bold ${data.saldoAtual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatarMoeda(data.saldoAtual)}
            </div>
          </div>
        )}
        <div className="text-sm text-gray-600 p-4 text-center">Nenhuma movimentação no período.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-600">Saldo atual</div>
        <div className={`text-lg font-bold ${data.saldoAtual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {formatarMoeda(data.saldoAtual)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.lancamentos.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDetalhe(m)}>
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDataHora(m.data)}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.tipo}</td>
                <td className={`px-4 py-3 text-sm font-semibold text-right ${m.tipo === 'CREDITO' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatarMoeda(m.valor)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{m.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

