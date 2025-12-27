// components/ModalAgendarQuadrasCompeticao.tsx - Modal para agendar quadras para uma competição
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import { X, Plus, Calendar, Clock, MapPin, Trash2 } from 'lucide-react';

interface Agendamento {
  id: string;
  quadraId: string;
  dataHora: string;
  duracao: number;
  valorHora?: number | null;
  valorCalculado?: number | null;
  status: string;
  observacoes?: string | null;
  quadra: {
    id: string;
    nome: string;
    pointId: string;
  };
}

interface ModalAgendarQuadrasCompeticaoProps {
  isOpen: boolean;
  onClose: () => void;
  competicaoId: string;
  competicaoNome: string;
  onAgendamentoCriado?: () => void;
}

export default function ModalAgendarQuadrasCompeticao({
  isOpen,
  onClose,
  competicaoId,
  competicaoNome,
  onAgendamentoCriado,
}: ModalAgendarQuadrasCompeticaoProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  
  // Formulário - Agora permite múltiplas quadras
  const [quadrasSelecionadas, setQuadrasSelecionadas] = useState<string[]>([]);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState(120); // 2 horas padrão
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen, competicaoId]);

  const carregarDados = async () => {
    try {
      // Carregar quadras e agendamentos em paralelo
      const pointId = usuario?.pointIdGestor;
      
      const [quadrasData, agendamentosData] = await Promise.all([
        pointId ? quadraService.listar(pointId) : Promise.resolve([]),
        api.get(`/competicao/${competicaoId}/agendamentos`).catch(err => {
          console.error('Erro ao carregar agendamentos:', err);
          return { data: { agendamentos: [] } };
        }),
      ]);

      if (pointId) {
        setQuadras(quadrasData.filter((q: any) => q.ativo));
      }

      // Sempre carregar agendamentos, mesmo se houver erro
      setAgendamentos(agendamentosData.data?.agendamentos || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      // Não mostrar alerta se for apenas erro ao carregar agendamentos (pode ser que não existam ainda)
      if (!error?.response?.data?.mensagem?.includes('agendamento')) {
        alert(error?.response?.data?.mensagem || 'Erro ao carregar dados');
      }
    }
  };

  const handleCriarAgendamento = async () => {
    if (quadrasSelecionadas.length === 0 || !data || !hora || !duracao) {
      alert('Selecione pelo menos uma quadra e preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const dataHora = `${data}T${hora}:00`;
      
      // Criar agendamento para cada quadra selecionada
      const promessas = quadrasSelecionadas.map(quadraId =>
        api.post(`/competicao/${competicaoId}/agendamentos`, {
          quadraId,
          dataHora,
          duracao,
          observacoes: observacoes.trim() || null,
        })
      );

      await Promise.all(promessas);

      alert(`${quadrasSelecionadas.length} agendamento(s) criado(s) com sucesso!`);
      
      // Limpar formulário
      setQuadrasSelecionadas([]);
      setData('');
      setHora('');
      setDuracao(120);
      setObservacoes('');

      // Recarregar agendamentos
      await carregarDados();
      
      // Não fechar modal - apenas recarregar dados
      // onAgendamentoCriado será chamado apenas quando o modal for fechado manualmente
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao criar agendamento(s)');
    } finally {
      setLoading(false);
    }
  };

  const toggleQuadraSelecionada = (quadraId: string) => {
    setQuadrasSelecionadas(prev => {
      if (prev.includes(quadraId)) {
        return prev.filter(id => id !== quadraId);
      } else {
        return [...prev, quadraId];
      }
    });
  };

  const handleExcluirAgendamento = async (agendamentoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/agendamento/${agendamentoId}`);
      
      // Remover da lista localmente para feedback imediato
      setAgendamentos(prev => prev.filter(a => a.id !== agendamentoId));
      
      // Recarregar dados para garantir sincronização
      await carregarDados();
      
      // Não fechar modal - apenas recarregar dados
      // onAgendamentoCriado será chamado apenas quando o modal for fechado manualmente
    } catch (error: any) {
      console.error('Erro ao excluir agendamento:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao excluir agendamento');
      // Recarregar dados em caso de erro para garantir estado consistente
      await carregarDados();
    } finally {
      setLoading(false);
    }
  };

  const formatarDataHora = (dataHora: string) => {
    const date = new Date(dataHora);
    return date.toLocaleString('pt-BR', {
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
    if (mins === 0) {
      return `${horas}h`;
    }
    return `${horas}h ${mins}min`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Agendar Quadras</h2>
            <p className="text-sm text-gray-600 mt-1">{competicaoNome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Lista de Agendamentos Existentes - Mostrar primeiro */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Agendamentos Existentes ({agendamentos.length})
            </h3>

            {loading && agendamentos.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando agendamentos...</p>
              </div>
            ) : agendamentos.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">Nenhum agendamento cadastrado</p>
                <p className="text-sm text-gray-500 mt-1">Use o formulário abaixo para criar agendamentos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentos.map((agendamento) => (
                  <div
                    key={agendamento.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-gray-900">
                            {agendamento.quadra.nome}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatarDataHora(agendamento.dataHora)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatarDuracao(agendamento.duracao)}</span>
                          </div>
                          {agendamento.valorCalculado && (
                            <div className="text-emerald-600 font-semibold">
                              R$ {typeof agendamento.valorCalculado === 'number' 
                                ? agendamento.valorCalculado.toFixed(2) 
                                : parseFloat(String(agendamento.valorCalculado) || '0').toFixed(2)}
                            </div>
                          )}
                        </div>
                        {agendamento.observacoes && (
                          <p className="mt-2 text-sm text-gray-700">
                            {agendamento.observacoes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleExcluirAgendamento(agendamento.id)}
                        disabled={loading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir agendamento"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulário */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Novo Agendamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quadras * (selecione uma ou mais)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {quadras.map((q) => {
                    const selecionada = quadrasSelecionadas.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggleQuadraSelecionada(q.id)}
                        className={`p-3 rounded-lg border-2 transition-colors text-left ${
                          selecionada
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{q.nome}</span>
                          {selecionada && (
                            <span className="text-emerald-600">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {quadrasSelecionadas.length > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    {quadrasSelecionadas.length} quadra(s) selecionada(s)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora *
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duração (minutos) *
                </label>
                <input
                  type="number"
                  value={duracao}
                  onChange={(e) => setDuracao(parseInt(e.target.value) || 120)}
                  min="30"
                  step="30"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: 30 minutos
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Observações sobre o agendamento..."
                />
              </div>
            </div>

            <button
              onClick={handleCriarAgendamento}
              disabled={loading || quadrasSelecionadas.length === 0 || !data || !hora}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Adicionar Agendamento{quadrasSelecionadas.length > 0 ? ` (${quadrasSelecionadas.length} quadra${quadrasSelecionadas.length > 1 ? 's' : ''})` : ''}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

