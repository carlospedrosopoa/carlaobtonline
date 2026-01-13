'use client';

import { Calendar } from 'lucide-react';
import { formatarMoeda } from './DashboardOperacionalWidgets';

export function FiltrosPeriodo({
  dataDe,
  dataAte,
  onChangeDataDe,
  onChangeDataAte,
  onLimpar,
  onAplicar,
  loading,
  podeAplicar,
  erro,
}: {
  dataDe: string;
  dataAte: string;
  onChangeDataDe: (v: string) => void;
  onChangeDataAte: (v: string) => void;
  onLimpar: () => void;
  onAplicar: () => void;
  loading: boolean;
  podeAplicar: boolean;
  erro: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">De</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={dataDe}
                onChange={(e) => onChangeDataDe(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Até</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={dataAte}
                onChange={(e) => onChangeDataAte(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLimpar}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onAplicar}
            disabled={!podeAplicar || loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Carregando...' : 'Aplicar'}
          </button>
        </div>
      </div>
      {erro ? (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>
      ) : null}
    </div>
  );
}

export function KpisSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-8 bg-gray-100 rounded w-1/2 mt-3" />
          <div className="h-3 bg-gray-100 rounded w-3/4 mt-3" />
        </div>
      ))}
    </div>
  );
}

export function ProdutosTable({
  produtos,
}: {
  produtos: Array<{ produtoId: string; nome: string; categoria: string; quantidade: number; valorTotal: number }>;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Produtos mais consumidos (top 10)</h2>
      </div>

      {produtos.length === 0 ? (
        <div className="text-sm text-gray-600">Sem consumo no período.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-4">Produto</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Qtd</th>
                <th className="py-2 pr-0">Valor</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.produtoId} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium text-gray-900">{p.nome}</td>
                  <td className="py-2 pr-4 text-gray-600">{p.categoria || '—'}</td>
                  <td className="py-2 pr-4 text-gray-900">{p.quantidade}</td>
                  <td className="py-2 pr-0 text-gray-900">{formatarMoeda(p.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

