'use client';

import type { HistoricoAtletaResumo } from '@/services/gestaoArenaService';

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export default function ResumoKpis({
  resumo,
  loading,
}: {
  resumo: HistoricoAtletaResumo | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="h-16 bg-gray-100 rounded" />
        <div className="h-16 bg-gray-100 rounded" />
        <div className="h-16 bg-gray-100 rounded" />
        <div className="h-16 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!resumo) {
    return <div className="text-sm text-gray-600">Sem dados de resumo</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Consumo (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.consumo?.total || 0)}</div>
        <div className="text-xs text-gray-500 mt-1">{resumo.consumo?.quantidade || 0} itens</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Pagamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.pagamentos?.total || 0)}</div>
        <div className="text-xs text-gray-500 mt-1">{resumo.pagamentos?.quantidade || 0} pagamentos</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Conta Corrente</div>
        <div
          className={`text-lg font-bold mt-1 ${
            resumo.saldoDevedor > 0 ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {formatarMoeda(resumo.saldoDevedor)}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Agendamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.agendamentos?.total || 0)}</div>
        <div className="text-xs text-gray-500 mt-1">{resumo.agendamentos?.quantidade || 0} agendamentos</div>
      </div>
    </div>
  );
}

