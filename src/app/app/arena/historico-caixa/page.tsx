// app/app/arena/historico-caixa/page.tsx - Histórico de Caixa
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { aberturaCaixaService, fluxoCaixaService } from '@/services/gestaoArenaService';
import type { AberturaCaixa, LancamentoFluxoCaixa } from '@/types/gestaoArena';
import { Calendar, Search, ChevronDown, ChevronUp, DollarSign, TrendingUp, TrendingDown, Eye } from 'lucide-react';

export default function HistoricoCaixaPage() {
  const { usuario } = useAuth();
  const [aberturas, setAberturas] = useState<AberturaCaixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberturaExpandida, setAberturaExpandida] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Record<string, LancamentoFluxoCaixa[]>>({});
  const [carregandoMovimentacoes, setCarregandoMovimentacoes] = useState<Record<string, boolean>>({});
  
  // Filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return primeiroDiaMes.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarAberturas();
    }
  }, [usuario?.pointIdGestor, dataInicio, dataFim]);

  const carregarAberturas = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const aberturasData = await aberturaCaixaService.listar(
        usuario.pointIdGestor,
        'FECHADA',
        dataInicio,
        dataFim
      );
      setAberturas(aberturasData);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoes = async (aberturaId: string) => {
    if (movimentacoes[aberturaId]) {
      // Já carregado, apenas expandir/colapsar
      return;
    }

    if (!usuario?.pointIdGestor) return;

    try {
      setCarregandoMovimentacoes((prev) => ({ ...prev, [aberturaId]: true }));
      const lancamentos = await fluxoCaixaService.listar(
        usuario.pointIdGestor,
        aberturaId
      );
      setMovimentacoes((prev) => ({ ...prev, [aberturaId]: lancamentos }));
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
    } finally {
      setCarregandoMovimentacoes((prev) => ({ ...prev, [aberturaId]: false }));
    }
  };

  const toggleAbertura = (aberturaId: string) => {
    if (aberturaExpandida === aberturaId) {
      setAberturaExpandida(null);
    } else {
      setAberturaExpandida(aberturaId);
      carregarMovimentacoes(aberturaId);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    try {
      if (data.includes('T')) {
        return new Date(data).toLocaleDateString('pt-BR');
      }
      if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
      }
      const parsed = new Date(data);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('pt-BR');
      }
      return data;
    } catch (error) {
      return data;
    }
  };

  const formatarDataHora = (data: string) => {
    try {
      const date = new Date(data);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return data;
    }
  };

  const aberturasFiltradas = aberturas.filter((abertura) => {
    if (!busca) return true;
    const buscaLower = busca.toLowerCase();
    return (
      abertura.id.toLowerCase().includes(buscaLower) ||
      formatarData(abertura.dataAbertura).toLowerCase().includes(buscaLower) ||
      (abertura.observacoes && abertura.observacoes.toLowerCase().includes(buscaLower))
    );
  });

  const totaisGeral = aberturasFiltradas.reduce(
    (acc, abertura) => ({
      entradas: acc.entradas + (abertura.totalEntradas || 0),
      saidas: acc.saidas + (abertura.totalSaidas || 0),
      saldoInicial: acc.saldoInicial + abertura.saldoInicial,
      saldoFinal: acc.saldoFinal + (abertura.saldoFinal || abertura.saldoAtual || 0),
    }),
    { entradas: 0, saidas: 0, saldoInicial: 0, saldoFinal: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Caixa</h1>
          <p className="text-gray-600 mt-1">Consulta de caixas fechados e suas movimentações</p>
        </div>
      </div>

      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Inicial Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatarMoeda(totaisGeral.saldoInicial)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Entradas</p>
              <p className="text-2xl font-bold text-green-600">{formatarMoeda(totaisGeral.entradas)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Saídas</p>
              <p className="text-2xl font-bold text-red-600">{formatarMoeda(totaisGeral.saidas)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Final Total</p>
              <p className={`text-2xl font-bold ${totaisGeral.saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(totaisGeral.saldoFinal)}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totaisGeral.saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por data ou observações..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Lista de Aberturas */}
      <div className="space-y-4">
        {aberturasFiltradas.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Nenhum caixa fechado encontrado</p>
            <p className="text-gray-500 text-sm mt-2">Ajuste os filtros de data para ver mais resultados</p>
          </div>
        ) : (
          aberturasFiltradas.map((abertura) => (
            <div key={abertura.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Cabeçalho da Abertura */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleAbertura(abertura.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Caixa #{abertura.id.substring(0, 8)}
                      </h3>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Fechado
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Abertura</p>
                        <p className="font-medium text-gray-900">{formatarData(abertura.dataAbertura)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Fechamento</p>
                        <p className="font-medium text-gray-900">
                          {abertura.dataFechamento ? formatarDataHora(abertura.dataFechamento) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Saldo Inicial</p>
                        <p className="font-medium text-gray-900">{formatarMoeda(abertura.saldoInicial)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Saldo Final</p>
                        <p className={`font-medium ${(abertura.saldoFinal || abertura.saldoAtual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatarMoeda(abertura.saldoFinal || abertura.saldoAtual || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Movimentação</p>
                        <p className={`font-medium ${(abertura.totalEntradas || 0) - (abertura.totalSaidas || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatarMoeda((abertura.totalEntradas || 0) - (abertura.totalSaidas || 0))}
                        </p>
                      </div>
                    </div>
                    {abertura.observacoes && (
                      <p className="text-sm text-gray-600 mt-2">{abertura.observacoes}</p>
                    )}
                  </div>
                  <div className="ml-4">
                    {aberturaExpandida === abertura.id ? (
                      <ChevronUp className="w-6 h-6 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhes Expandidos */}
              {aberturaExpandida === abertura.id && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-6">
                    {/* Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Entradas</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatarMoeda(abertura.totalEntradas || 0)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Saídas</p>
                        <p className="text-xl font-bold text-red-600">
                          {formatarMoeda(abertura.totalSaidas || 0)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600">Saldo Calculado</p>
                        <p className={`text-xl font-bold ${(abertura.saldoAtual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatarMoeda(abertura.saldoAtual || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Movimentações */}
                    {carregandoMovimentacoes[abertura.id] ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                        <p className="text-gray-600">Carregando movimentações...</p>
                      </div>
                    ) : movimentacoes[abertura.id] && movimentacoes[abertura.id].length > 0 ? (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Movimentações</h4>
                        <div className="bg-white rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Data
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Tipo
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Descrição
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Forma Pagamento
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Valor
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {movimentacoes[abertura.id].map((mov) => (
                                  <tr key={mov.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                      {formatarData(mov.data)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {mov.tipo === 'ENTRADA_MANUAL' && (
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                          Entrada Manual
                                        </span>
                                      )}
                                      {mov.tipo === 'ENTRADA_CARD' && (
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                          Pagamento Card
                                        </span>
                                      )}
                                      {mov.tipo === 'SAIDA' && (
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                          Saída
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      <div>{mov.descricao}</div>
                                      {mov.observacoes && (
                                        <div className="text-xs text-gray-500 mt-1">{mov.observacoes}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                      {mov.formaPagamento?.nome || '-'}
                                    </td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                      mov.tipo === 'SAIDA' ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                      {mov.tipo === 'SAIDA' ? '-' : '+'}{formatarMoeda(mov.valor)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Nenhuma movimentação encontrada para este caixa
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

