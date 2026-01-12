// app/app/arena/conta-corrente/page.tsx - Contas Correntes de Clientes
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaCorrenteService, type ContaCorrenteCliente, type CriarMovimentacaoPayload } from '@/services/gestaoArenaService';
import { useRouter } from 'next/navigation';
import { Search, User, Building2, DollarSign, ArrowRight, Plus, TrendingUp, TrendingDown, Edit, X } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

export default function ContaCorrentePage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [contas, setContas] = useState<ContaCorrenteCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalMovimentacaoAberto, setModalMovimentacaoAberto] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<ContaCorrenteCliente | null>(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
  const [valorMovimentacao, setValorMovimentacao] = useState<number | null>(null);
  const [justificativaMovimentacao, setJustificativaMovimentacao] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarContas();
    }
  }, [usuario?.pointIdGestor]);

  const carregarContas = async () => {
    if (!usuario?.pointIdGestor) return;
    try {
      setLoading(true);
      const dados = await contaCorrenteService.listar(usuario.pointIdGestor);
      setContas(dados);
    } catch (error: any) {
      console.error('Erro ao carregar contas correntes:', error);
      alert('Erro ao carregar contas correntes: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const contasFiltradas = contas.filter((conta) => {
    const buscaLower = busca.toLowerCase();
    return (
      conta.usuario.name.toLowerCase().includes(buscaLower) ||
      conta.usuario.email.toLowerCase().includes(buscaLower) ||
      conta.point.nome.toLowerCase().includes(buscaLower)
    );
  });

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const handleVerDetalhes = (contaId: string) => {
    router.push(`/app/arena/conta-corrente/${contaId}`);
  };

  const handleAbrirModalMovimentacao = (conta: ContaCorrenteCliente) => {
    setContaSelecionada(conta);
    setTipoMovimentacao('CREDITO');
    setValorMovimentacao(null);
    setJustificativaMovimentacao('');
    setModalMovimentacaoAberto(true);
  };

  const handleFecharModalMovimentacao = () => {
    setModalMovimentacaoAberto(false);
    setContaSelecionada(null);
    setValorMovimentacao(null);
    setJustificativaMovimentacao('');
  };

  const handleCriarMovimentacao = async () => {
    if (!contaSelecionada) return;

    if (!valorMovimentacao || valorMovimentacao <= 0) {
      alert('Informe um valor válido');
      return;
    }

    if (!justificativaMovimentacao.trim()) {
      alert('A justificativa é obrigatória');
      return;
    }

    try {
      setProcessando(true);
      const payload: CriarMovimentacaoPayload = {
        tipo: tipoMovimentacao,
        valor: valorMovimentacao,
        justificativa: justificativaMovimentacao.trim(),
      };

      await contaCorrenteService.criarMovimentacao(contaSelecionada.id, payload);
      
      // Recarregar contas
      await carregarContas();
      
      // Fechar modal
      handleFecharModalMovimentacao();
      
      alert('Movimentação criada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar movimentação:', error);
      alert('Erro ao criar movimentação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setProcessando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando contas correntes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contas Correntes</h1>
          <p className="text-gray-600 mt-1">Gerencie as contas correntes dos clientes</p>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou email do cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de contas */}
      {contasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {busca ? 'Nenhuma conta encontrada' : 'Nenhuma conta corrente cadastrada'}
          </h3>
          <p className="text-gray-600">
            {busca
              ? 'Tente buscar com outros termos'
              : 'As contas correntes serão criadas automaticamente quando um cliente fizer um pagamento via conta corrente'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arena
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Atualização
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contasFiltradas.map((conta) => (
                  <tr key={conta.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{conta.usuario.name}</div>
                          <div className="text-sm text-gray-500">{conta.usuario.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{conta.point.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`flex items-center justify-end ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {conta.saldo >= 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        <span className={`text-sm font-semibold ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatarMoeda(conta.saldo)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(conta.updatedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAbrirModalMovimentacao(conta)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1 px-3 py-1.5 border border-blue-300 rounded-lg hover:bg-blue-50"
                          title="Lançar crédito/débito"
                        >
                          <Edit className="w-4 h-4" />
                          Lançar
                        </button>
                        <button
                          onClick={() => handleVerDetalhes(conta.id)}
                          className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1"
                        >
                          Ver Detalhes
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumo */}
      {contasFiltradas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total de Contas</div>
              <div className="text-2xl font-bold text-gray-900">{contasFiltradas.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 mb-1">Saldo Total Positivo</div>
              <div className="text-2xl font-bold text-green-600">
                {formatarMoeda(contasFiltradas.filter((c) => c.saldo >= 0).reduce((sum, c) => sum + c.saldo, 0))}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-red-600 mb-1">Saldo Total Negativo</div>
              <div className="text-2xl font-bold text-red-600">
                {formatarMoeda(contasFiltradas.filter((c) => c.saldo < 0).reduce((sum, c) => sum + c.saldo, 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Movimentação Rápida */}
      {modalMovimentacaoAberto && contaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Nova Movimentação</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {contaSelecionada.usuario.name} - {contaSelecionada.point.nome}
                </p>
              </div>
              <button
                onClick={handleFecharModalMovimentacao}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="CREDITO"
                      checked={tipoMovimentacao === 'CREDITO'}
                      onChange={(e) => setTipoMovimentacao(e.target.value as 'CREDITO')}
                      className="mr-2"
                    />
                    <span className="text-green-600 font-medium">Crédito</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="DEBITO"
                      checked={tipoMovimentacao === 'DEBITO'}
                      onChange={(e) => setTipoMovimentacao(e.target.value as 'DEBITO')}
                      className="mr-2"
                    />
                    <span className="text-red-600 font-medium">Débito</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor</label>
                <InputMonetario
                  value={valorMovimentacao || 0}
                  onChange={(valor) => setValorMovimentacao(valor)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificativa <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={justificativaMovimentacao}
                  onChange={(e) => setJustificativaMovimentacao(e.target.value)}
                  placeholder="Descreva o motivo da movimentação..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleFecharModalMovimentacao}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processando}
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarMovimentacao}
                disabled={processando || !valorMovimentacao || !justificativaMovimentacao.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? 'Processando...' : 'Criar Movimentação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

