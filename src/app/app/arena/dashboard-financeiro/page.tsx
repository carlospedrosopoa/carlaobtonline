'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { dashboardFinanceiroService } from '@/services/gestaoArenaService';
import { BarChart3, Calendar, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

type PeriodoFiltro = 'mesAtual' | 'mesAnterior' | 'intervalo';

export default function DashboardFinanceiroPage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('mesAtual');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardFinanceiroService.obter>> | null>(null);

  const datasFiltro = useMemo(() => {
    const hoje = new Date();
    let inicio: Date;
    let fim: Date = new Date(hoje);

    switch (periodoFiltro) {
      case 'mesAtual':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case 'mesAnterior':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case 'intervalo':
        inicio = dataInicio ? new Date(dataInicio) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = dataFim ? new Date(dataFim) : hoje;
        break;
      default:
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }

    return {
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0],
    };
  }, [periodoFiltro, dataInicio, dataFim]);

  useEffect(() => {
    if (!usuario?.pointIdGestor) return;
    void carregar();
  }, [usuario?.pointIdGestor, datasFiltro]);

  async function carregar() {
    if (!usuario?.pointIdGestor) return;
    try {
      setLoading(true);
      setErro(null);
      const result = await dashboardFinanceiroService.obter(usuario.pointIdGestor, datasFiltro.inicio, datasFiltro.fim);
      setData(result);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || e?.message || 'Erro ao carregar dashboard financeiro');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  const despesasTotal = useMemo(() => {
    return (data?.despesasPorFornecedor || []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [data]);

  const chartTopFornecedores = useMemo(() => {
    const rows = (data?.despesasPorFornecedor || []).slice(0, 10);
    return rows.map((r) => ({
      fornecedor: r.fornecedorNome.length > 16 ? `${r.fornecedorNome.slice(0, 16)}…` : r.fornecedorNome,
      total: Number(r.total) || 0,
    }));
  }, [data]);

  const receitasPorCategoriaProduto = useMemo(() => {
    return (data?.receitasPorCategoriaProduto || [])
      .map((r) => ({ categoria: r.categoria, total: Number(r.total) || 0 }))
      .filter((r) => r.total > 0);
  }, [data]);

  const chartReceitasPorCategoriaProduto = useMemo(() => {
    const rows = receitasPorCategoriaProduto.slice(0, 12);
    return rows.map((r) => ({
      categoria: r.categoria.length > 16 ? `${r.categoria.slice(0, 16)}…` : r.categoria,
      total: r.total,
    }));
  }, [receitasPorCategoriaProduto]);

  const proj = data?.projecaoProximoMes;
  const receitas = data?.receitas;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard financeiro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
          <p className="text-gray-600 mt-1">Despesas por fornecedor, receitas por categoria e projeção</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPeriodoFiltro('mesAtual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodoFiltro === 'mesAtual' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => setPeriodoFiltro('mesAnterior')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodoFiltro === 'mesAnterior'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Mês Anterior
              </button>
              <button
                onClick={() => setPeriodoFiltro('intervalo')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodoFiltro === 'intervalo'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Intervalo
              </button>
            </div>
          </div>

          {periodoFiltro === 'intervalo' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Receitas (período)</p>
              <p className="text-2xl font-bold text-emerald-600">{formatarMoeda(receitas?.total || 0)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {data?.periodo?.dataInicio} → {data?.periodo?.dataFim}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Despesas c/ fornecedor (período)</p>
              <p className="text-2xl font-bold text-red-600">{formatarMoeda(despesasTotal)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
          <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {data?.despesasPorFornecedor?.length || 0} fornecedores
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Projeção (próximo mês)</p>
              <p className={`text-2xl font-bold ${(proj?.saldoProjetado || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatarMoeda(proj?.saldoProjetado || 0)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {proj?.dataInicio} → {proj?.dataFim}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Top fornecedores (despesa)</h2>
            <div className="text-sm text-gray-500">Caixa + Conta bancária</div>
          </div>
          {chartTopFornecedores.length === 0 ? (
            <div className="py-10 text-center text-gray-500">Sem despesas com fornecedor no período.</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTopFornecedores} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <XAxis dataKey="fornecedor" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => formatarMoeda(Number(value) || 0)}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Bar dataKey="total" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Receitas (categorias)</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Locação</div>
              <div className="font-semibold text-gray-900">{formatarMoeda(receitas?.locacao || 0)}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Evento</div>
              <div className="font-semibold text-gray-900">{formatarMoeda(receitas?.evento || 0)}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Produtos</div>
              <div className="font-semibold text-gray-900">{formatarMoeda(receitas?.produtos || 0)}</div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Total</div>
              <div className="text-lg font-bold text-emerald-700">{formatarMoeda(receitas?.total || 0)}</div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Receitas por categoria de produto</h3>
            {receitasPorCategoriaProduto.length === 0 ? (
              <div className="text-sm text-gray-500">Sem receitas por produto no período.</div>
            ) : (
              <div className="max-h-[220px] overflow-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-full">Categoria</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {receitasPorCategoriaProduto.slice(0, 20).map((r) => (
                      <tr key={r.categoria} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{r.categoria}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatarMoeda(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Projeção próximo mês</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Receitas provisionadas</span>
                <span className="font-semibold text-emerald-700">{formatarMoeda(proj?.receitasProvisionadas || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Despesas provisionadas</span>
                <span className="font-semibold text-red-700">{formatarMoeda(proj?.despesasProvisionadas || 0)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-900 font-semibold">Saldo projetado</span>
                <span className={`font-bold ${(proj?.saldoProjetado || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatarMoeda(proj?.saldoProjetado || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Receitas por categoria de produto (gráfico)</h2>
          <div className="text-sm text-gray-500">Baseado em itens de comandas</div>
        </div>
        {chartReceitasPorCategoriaProduto.length === 0 ? (
          <div className="py-10 text-center text-gray-500">Sem receitas de produtos no período.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartReceitasPorCategoriaProduto} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="categoria" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => formatarMoeda(Number(value) || 0)} labelStyle={{ fontWeight: 700 }} />
                <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Despesas por fornecedor (detalhado)</h2>
        {data?.despesasPorFornecedor?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-full">Fornecedor</th>
                  <th className="px-3 py-3 text-right font-medium">Caixa</th>
                  <th className="px-3 py-3 text-right font-medium">Banco</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.despesasPorFornecedor.map((r) => (
                  <tr key={r.fornecedorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.fornecedorNome}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{formatarMoeda(r.caixa)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{formatarMoeda(r.banco)}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">{formatarMoeda(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-gray-500">Nenhuma despesa com fornecedor encontrada no período.</div>
        )}
      </div>
    </div>
  );
}
