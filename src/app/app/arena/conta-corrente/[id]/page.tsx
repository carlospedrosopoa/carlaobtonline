// app/app/arena/conta-corrente/[id]/page.tsx - Detalhes da Conta Corrente
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaCorrenteService, type ContaCorrenteCliente, type MovimentacaoContaCorrente, type CriarMovimentacaoPayload } from '@/services/gestaoArenaService';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Building2, DollarSign, Plus, TrendingUp, TrendingDown, Calendar, FileText, CreditCard, X, Edit, Trash2 } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

export default function ContaCorrenteDetalhesPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contaId = params.id as string;

  const [conta, setConta] = useState<ContaCorrenteCliente | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoContaCorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMovimentacaoAberto, setModalMovimentacaoAberto] = useState(false);
  const [modalEditarMovimentacaoAberto, setModalEditarMovimentacaoAberto] = useState(false);
  const [movimentacaoEditando, setMovimentacaoEditando] = useState<MovimentacaoContaCorrente | null>(null);
  const [processando, setProcessando] = useState(false);

  // Formulário de movimentação
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
  const [valorMovimentacao, setValorMovimentacao] = useState<number | null>(null);
  const [justificativaMovimentacao, setJustificativaMovimentacao] = useState('');

  useEffect(() => {
    if (contaId) {
      carregarDados();
    }
  }, [contaId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [contaData, movimentacoesData] = await Promise.all([
        contaCorrenteService.obter(contaId),
        contaCorrenteService.listarMovimentacoes(contaId),
      ]);
      setConta(contaData);
      setMovimentacoes(movimentacoesData);
    } catch (error: any) {
      console.error('Erro ao carregar dados da conta corrente:', error);
      alert('Erro ao carregar dados: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCriarMovimentacao = async () => {
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

      await contaCorrenteService.criarMovimentacao(contaId, payload);
      
      // Limpar formulário
      setValorMovimentacao(null);
      setJustificativaMovimentacao('');
      setModalMovimentacaoAberto(false);
      
      // Recarregar dados
      await carregarDados();
      
      alert('Movimentação criada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar movimentação:', error);
      alert('Erro ao criar movimentação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setProcessando(false);
    }
  };

  const handleEditarMovimentacao = (mov: MovimentacaoContaCorrente) => {
    // Não permitir editar movimentações vinculadas a pagamentos
    if (mov.pagamentoCardId) {
      alert('Não é possível editar movimentações vinculadas a pagamentos de card');
      return;
    }

    setMovimentacaoEditando(mov);
    setTipoMovimentacao(mov.tipo);
    setValorMovimentacao(mov.valor);
    setJustificativaMovimentacao(mov.justificativa);
    setModalEditarMovimentacaoAberto(true);
  };

  const handleSalvarEdicao = async () => {
    if (!movimentacaoEditando) return;

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

      await contaCorrenteService.atualizarMovimentacao(contaId, movimentacaoEditando.id, payload);
      
      // Limpar formulário
      setMovimentacaoEditando(null);
      setValorMovimentacao(null);
      setJustificativaMovimentacao('');
      setModalEditarMovimentacaoAberto(false);
      
      // Recarregar dados
      await carregarDados();
      
      alert('Movimentação atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar movimentação:', error);
      alert('Erro ao atualizar movimentação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setProcessando(false);
    }
  };

  const handleExcluirMovimentacao = async (mov: MovimentacaoContaCorrente) => {
    // Não permitir excluir movimentações vinculadas a pagamentos
    if (mov.pagamentoCardId) {
      alert('Não é possível excluir movimentações vinculadas a pagamentos de card');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir esta movimentação de ${formatarMoeda(mov.valor)}?`)) {
      return;
    }

    try {
      setProcessando(true);
      await contaCorrenteService.excluirMovimentacao(contaId, mov.id);
      
      // Recarregar dados
      await carregarDados();
      
      alert('Movimentação excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir movimentação:', error);
      alert('Erro ao excluir movimentação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setProcessando(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!conta) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Conta corrente não encontrada</p>
        <button
          onClick={() => router.push('/app/arena/conta-corrente')}
          className="mt-4 text-emerald-600 hover:text-emerald-700"
        >
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/app/arena/conta-corrente')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conta Corrente</h1>
            <p className="text-gray-600 mt-1">Detalhes e histórico de movimentações</p>
          </div>
        </div>
        <button
          onClick={() => setModalMovimentacaoAberto(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-5 h-5" />
          Nova Movimentação
        </button>
      </div>

      {/* Informações da Conta */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações da Conta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">Cliente</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{conta.usuario.name}</p>
            <p className="text-sm text-gray-500">{conta.usuario.email}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Arena</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{conta.point.nome}</p>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Saldo Atual</span>
            </div>
            <div className={`text-3xl font-bold ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatarMoeda(conta.saldo)}
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Movimentações */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Histórico de Movimentações</h2>
        </div>
        <div className="overflow-x-auto">
          {movimentacoes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma movimentação registrada</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Justificativa
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado por
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimentacoes.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatarData(mov.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mov.tipo === 'CREDITO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {mov.tipo === 'CREDITO' ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {mov.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}
                      </span>
                      {mov.card && (
                        <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          Card #{mov.card.numeroCard}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      {mov.justificativa}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-semibold ${
                          mov.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {mov.tipo === 'CREDITO' ? '+' : '-'}
                        {formatarMoeda(mov.valor)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mov.createdBy ? mov.createdBy.name : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!mov.pagamentoCardId && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditarMovimentacao(mov)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExcluirMovimentacao(mov)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Editar Movimentação */}
      {modalEditarMovimentacaoAberto && movimentacaoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Editar Movimentação</h3>
              <button
                onClick={() => {
                  setModalEditarMovimentacaoAberto(false);
                  setMovimentacaoEditando(null);
                  setValorMovimentacao(null);
                  setJustificativaMovimentacao('');
                }}
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
                onClick={() => {
                  setModalEditarMovimentacaoAberto(false);
                  setMovimentacaoEditando(null);
                  setValorMovimentacao(null);
                  setJustificativaMovimentacao('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processando}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarEdicao}
                disabled={processando || !valorMovimentacao || !justificativaMovimentacao.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Movimentação */}
      {modalMovimentacaoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Nova Movimentação</h3>
              <button
                onClick={() => setModalMovimentacaoAberto(false)}
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
                onClick={() => setModalMovimentacaoAberto(false)}
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

