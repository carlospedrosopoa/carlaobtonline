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
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.totalConsumo)}</div>
        <div className="text-xs text-gray-500 mt-1">Total em consumo</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Pagamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.totalPago)}</div>
        <div className="text-xs text-gray-500 mt-1">Total pago</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Saldo Devedor</div>
        <div
          className={`text-lg font-bold mt-1 ${
            resumo.saldoDevedor > 0 ? 'text-red-700' : 'text-emerald-700'
          }`}
        >
          {formatarMoeda(resumo.saldoDevedor)}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Agendamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{resumo.totalAgendamentos}</div>
        <div className="text-xs text-gray-500 mt-1">Agendamentos realizados</div>
      </div>
    </div>
  );
}

