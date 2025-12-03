// app/app/arena/dashboard-caixa/page.tsx - Dashboard do Caixa
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fluxoCaixaService } from '@/services/gestaoArenaService';
import type { LancamentoFluxoCaixa } from '@/types/gestaoArena';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Filter } from 'lucide-react';

type PeriodoFiltro = 'mesAtual' | 'mesAnterior' | 'intervalo';

export default function DashboardCaixaPage() {
  const { usuario } = useAuth();
  const [lancamentos, setLancamentos] = useState<LancamentoFluxoCaixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('mesAtual');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Calcular datas baseado no filtro
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
    if (usuario?.pointIdGestor) {
      carregarDados();
    }
  }, [usuario?.pointIdGestor, datasFiltro]);

  const carregarDados = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const lancamentosData = await fluxoCaixaService.listar(
        usuario.pointIdGestor,
        undefined, // Não filtrar por abertura específica no dashboard
        datasFiltro.inicio,
        datasFiltro.fim
      );
      setLancamentos(lancamentosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por dia para gráficos
  const dadosPorDia = useMemo(() => {
    const agrupado: Record<string, { data: string; receitas: number; despesas: number }> = {};

    lancamentos.forEach((lancamento) => {
      const data = lancamento.data.split('T')[0];
      if (!agrupado[data]) {
        agrupado[data] = {
          data: new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          receitas: 0,
          despesas: 0,
        };
      }

      if (lancamento.tipo === 'ENTRADA_MANUAL' || lancamento.tipo === 'ENTRADA_CARD') {
        agrupado[data].receitas += lancamento.valor;
      } else if (lancamento.tipo === 'SAIDA') {
        agrupado[data].despesas += lancamento.valor;
      }
    });

    return Object.values(agrupado).sort((a, b) => {
      const dataA = new Date(a.data.split('/').reverse().join('-'));
      const dataB = new Date(b.data.split('/').reverse().join('-'));
      return dataA.getTime() - dataB.getTime();
    });
  }, [lancamentos]);

  // Agrupar por tipo de entrada
  const dadosPorTipoEntrada = useMemo(() => {
    const manual = lancamentos
      .filter((l) => l.tipo === 'ENTRADA_MANUAL')
      .reduce((sum, l) => sum + l.valor, 0);
    const card = lancamentos
      .filter((l) => l.tipo === 'ENTRADA_CARD')
      .reduce((sum, l) => sum + l.valor, 0);

    return [
      { name: 'Entradas Manuais', value: manual },
      { name: 'Pagamentos Cards', value: card },
    ];
  }, [lancamentos]);

  // Totais
  const totais = useMemo(() => {
    const receitas = lancamentos
      .filter((l) => l.tipo === 'ENTRADA_MANUAL' || l.tipo === 'ENTRADA_CARD')
      .reduce((sum, l) => sum + l.valor, 0);
    const despesas = lancamentos
      .filter((l) => l.tipo === 'SAIDA')
      .reduce((sum, l) => sum + l.valor, 0);

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
    };
  }, [lancamentos]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard do Caixa</h1>
          <p className="text-gray-600 mt-1">Análise de receitas e despesas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriodoFiltro('mesAtual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodoFiltro === 'mesAtual'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 text-sm text-gray-600">
          Período: {new Date(datasFiltro.inicio).toLocaleDateString('pt-BR')} até{' '}
          {new Date(datasFiltro.fim).toLocaleDateString('pt-BR')}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Receitas</p>
              <p className="text-2xl font-bold text-green-600">{formatarMoeda(totais.receitas)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Despesas</p>
              <p className="text-2xl font-bold text-red-600">{formatarMoeda(totais.despesas)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Líquido</p>
              <p className={`text-2xl font-bold ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(totais.saldo)}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Receitas vs Despesas por Dia */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Receitas vs Despesas por Dia</h3>
          {dadosPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatarMoeda(value)}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>

        {/* Gráfico de Linha - Evolução do Saldo */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução do Saldo</h3>
          {dadosPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosPorDia.map((d, idx) => ({
                ...d,
                saldo: dadosPorDia.slice(0, idx + 1).reduce((acc, item) => acc + item.receitas - item.despesas, 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatarMoeda(value)}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Saldo Acumulado"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>

        {/* Gráfico de Pizza - Tipos de Entrada */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Receitas</h3>
          {dadosPorTipoEntrada.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPorTipoEntrada}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPorTipoEntrada.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatarMoeda(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhuma receita no período selecionado
            </div>
          )}
        </div>

        {/* Gráfico de Linha - Receitas e Despesas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução de Receitas e Despesas</h3>
          {dadosPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatarMoeda(value)}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receitas"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Receitas"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Despesas"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

