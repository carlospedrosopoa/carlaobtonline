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
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.consumo.total)}</div>
        <div className="text-xs text-gray-500 mt-1">{resumo.consumo.quantidade} itens</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Pagamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{formatarMoeda(resumo.pagamentos.total)}</div>
        <div className="text-xs text-gray-500 mt-1">{resumo.pagamentos.quantidade} pagamentos</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Saldo conta corrente</div>
        <div
          className={`text-lg font-bold mt-1 ${
            resumo.contaCorrente.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {formatarMoeda(resumo.contaCorrente.saldo)}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600">Agendamentos (período)</div>
        <div className="text-lg font-bold text-gray-900 mt-1">{resumo.agendamentos.quantidade}</div>
        <div className="text-xs text-gray-500 mt-1">{formatarMoeda(resumo.agendamentos.total)}</div>
      </div>
    </div>
  );
}

