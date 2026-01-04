// components/ModalGerenciarAgendamentosCard.tsx - Modal específico para gerenciar agendamentos do card
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import { api } from '@/lib/api';
import type { CardCliente } from '@/types/gestaoArena';
import type { Agendamento } from '@/types/agendamento';
import { X, Plus, Trash2, Calendar, Search, Clock } from 'lucide-react';

interface ModalGerenciarAgendamentosCardProps {
  isOpen: boolean;
  card: CardCliente | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalGerenciarAgendamentosCard({ isOpen, card, onClose, onSuccess }: ModalGerenciarAgendamentosCardProps) {
  const { usuario } = useAuth();
  const [cardCompleto, setCardCompleto] = useState<CardCliente | null>(null);
  const [agendamentosVinculados, setAgendamentosVinculados] = useState<Array<{
    id: string;
    agendamentoId: string;
    valor: number;
    createdAt: string;
    agendamento?: {
      id: string;
      quadra: { id: string; nome: string };
      dataHora: string;
      duracao: number;
      valorCalculado: number | null;
      valorNegociado: number | null;
      status: string;
    };
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Estados para adicionar agendamento
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [agendamentosDisponiveis, setAgendamentosDisponiveis] = useState<Agendamento[]>([]);
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(false);
  const [buscaAgendamento, setBuscaAgendamento] = useState('');

  useEffect(() => {
    if (isOpen && card) {
      carregarDados();
    }
  }, [isOpen, card]);

  const carregarDados = async () => {
    if (!card) return;

    try {
      setLoading(true);
      setErro('');

      const cardData = await cardClienteService.obter(card.id, false, false, true);
      setCardCompleto(cardData);

      if (cardData.agendamentos) {
        setAgendamentosVinculados(cardData.agendamentos);
      } else {
        setAgendamentosVinculados([]);
      }
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAgendamento = async () => {
    if (!usuario?.pointIdGestor) {
      setErro('Arena não identificada');
      return;
    }

    setModalAgendamentoAberto(true);
    setCarregandoAgendamentos(true);
    setErro('');

    try {
      const res = await api.get('/gestao-arena/agendamentos-disponiveis', {
        params: {
          pointId: usuario.pointIdGestor,
          status: 'CONFIRMADO',
        },
      });
      setAgendamentosDisponiveis(res.data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos disponíveis:', error);
      setErro('Erro ao carregar agendamentos disponíveis');
    } finally {
      setCarregandoAgendamentos(false);
    }
  };

  const fecharModalAgendamento = () => {
    setModalAgendamentoAberto(false);
    setBuscaAgendamento('');
    setErro('');
  };

  const vincularAgendamento = async (agendamentoId: string) => {
    if (!cardCompleto) return;

    try {
      setSalvando(true);
      setErro('');

      await cardClienteService.vincularAgendamento(cardCompleto.id, agendamentoId);
      await carregarDados();
      fecharModalAgendamento();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao vincular agendamento');
    } finally {
      setSalvando(false);
    }
  };

  const desvincularAgendamento = async (agendamentoCardId: string) => {
    if (!cardCompleto || !confirm('Tem certeza que deseja desvincular este agendamento?')) return;

    try {
      setSalvando(true);
      await cardClienteService.desvincularAgendamento(cardCompleto.id, agendamentoCardId);
      await carregarDados();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao desvincular agendamento');
    } finally {
      setSalvando(false);
    }
  };

  const agendamentosDisponiveisFiltrados = useMemo(() => {
    if (!buscaAgendamento) return agendamentosDisponiveis;

    const buscaLower = buscaAgendamento.toLowerCase();
    return agendamentosDisponiveis.filter((ag) => {
      const quadraNome = ag.quadra?.nome?.toLowerCase() || '';
      const clienteNome = ag.atleta?.nome?.toLowerCase() || ag.nomeAvulso?.toLowerCase() || ag.usuario?.name?.toLowerCase() || '';
      const dataHora = ag.dataHora?.toLowerCase() || '';
      return quadraNome.includes(buscaLower) || clienteNome.includes(buscaLower) || dataHora.includes(buscaLower);
    });
  }, [agendamentosDisponiveis, buscaAgendamento]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarDataHora = (dataHora: string) => {
    const data = new Date(dataHora);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarDuracao = (minutos: number) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  if (!isOpen) return null;

  const valorTotalAgendamentos = agendamentosVinculados.reduce((sum, ag) => sum + ag.valor, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gerenciar Agendamentos - Comanda #{cardCompleto?.numeroCard || card?.numeroCard}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {cardCompleto?.usuario?.name || cardCompleto?.nomeAvulso || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <>
              {erro && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}

              {/* Resumo */}
              {agendamentosVinculados.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total de Agendamentos:</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {formatarMoeda(valorTotalAgendamentos)}
                    </span>
                  </div>
                </div>
              )}

              {/* Botão Adicionar Agendamento */}
              {cardCompleto?.status === 'ABERTO' && (
                <div className="mb-4">
                  <button
                    onClick={abrirModalAgendamento}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Agendamento
                  </button>
                </div>
              )}

              {/* Lista de Agendamentos */}
              {agendamentosVinculados.length > 0 ? (
                <div className="space-y-3">
                  {agendamentosVinculados.map((agendamentoCard) => {
                    const agendamento = agendamentoCard.agendamento;
                    if (!agendamento) return null;

                    const valor = agendamento.valorNegociado || agendamento.valorCalculado || 0;
                    return (
                      <div
                        key={agendamentoCard.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-5 h-5 text-emerald-600" />
                              <span className="font-semibold text-gray-900">{agendamento.quadra.nome}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                agendamento.status === 'CONFIRMADO' ? 'bg-blue-100 text-blue-800' :
                                agendamento.status === 'CONCLUIDO' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {agendamento.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {formatarDataHora(agendamento.dataHora)} • {formatarDuracao(agendamento.duracao)}
                            </div>
                            <div className="text-lg font-bold text-emerald-700">
                              {formatarMoeda(valor)}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              Vinculado em: {new Date(agendamentoCard.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          {cardCompleto?.status === 'ABERTO' && (
                            <button
                              onClick={() => desvincularAgendamento(agendamentoCard.id)}
                              disabled={salvando}
                              className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Desvincular agendamento"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum agendamento vinculado ainda</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Adicionar Agendamento */}
      {modalAgendamentoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Adicionar Agendamento</h3>
                <button onClick={fecharModalAgendamento} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por quadra, cliente ou data..."
                  value={buscaAgendamento}
                  onChange={(e) => setBuscaAgendamento(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6">
              {carregandoAgendamentos ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando agendamentos...</p>
                </div>
              ) : agendamentosDisponiveisFiltrados.length > 0 ? (
                <div className="space-y-3">
                  {agendamentosDisponiveisFiltrados.map((agendamento) => {
                    const valor = agendamento.valorNegociado || agendamento.valorCalculado || 0;
                    return (
                      <div
                        key={agendamento.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => vincularAgendamento(agendamento.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-900">{agendamento.quadra?.nome}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                agendamento.status === 'CONFIRMADO' ? 'bg-blue-100 text-blue-800' :
                                agendamento.status === 'CONCLUIDO' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {agendamento.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {formatarDataHora(agendamento.dataHora)} • {formatarDuracao(agendamento.duracao)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Cliente: {agendamento.atleta?.nome || agendamento.nomeAvulso || agendamento.usuario?.name || 'Não informado'}
                            </div>
                            <div className="text-lg font-bold text-emerald-700 mt-2">
                              {formatarMoeda(valor)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Nenhum agendamento disponível encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

