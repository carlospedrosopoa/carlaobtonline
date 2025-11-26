// app/app/atleta/agendamentos/page.tsx - Agendamentos do atleta (100% igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { pointService, quadraService, agendamentoService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import type { Point, Quadra, Agendamento, StatusAgendamento } from '@/types/agendamento';
import { Calendar, Clock, MapPin, Plus, X, CheckCircle, XCircle, CalendarCheck, User, Users, UserPlus, Edit } from 'lucide-react';

export default function AgendamentosPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [points, setPoints] = useState<Point[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointSelecionado, setPointSelecionado] = useState<string>('');
  const [quadraSelecionada, setQuadraSelecionada] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | ''>('');
  const [apenasMeus, setApenasMeus] = useState(true);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (pointSelecionado) {
      carregarQuadras(pointSelecionado);
    } else {
      setQuadras([]);
    }
  }, [pointSelecionado]);

  useEffect(() => {
    carregarAgendamentos();
  }, [quadraSelecionada, filtroStatus, apenasMeus]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [pointsData, agendamentosData] = await Promise.all([
        pointService.listar(),
        agendamentoService.listar({ apenasMeus: true }),
      ]);
      setPoints(pointsData.filter((p) => p.ativo));
      setAgendamentos(agendamentosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarQuadras = async (pointId: string) => {
    try {
      const quadrasData = await quadraService.listar(pointId);
      setQuadras(quadrasData.filter((q) => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar quadras:', error);
    }
  };

  const carregarAgendamentos = async () => {
    try {
      const filtros: any = { apenasMeus };
      if (quadraSelecionada) filtros.quadraId = quadraSelecionada;
      if (filtroStatus) filtros.status = filtroStatus;

      const data = await agendamentoService.listar(filtros);
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const handleEditar = (agendamento: Agendamento) => {
    const podeEditar = agendamento.usuarioId === usuario?.id;
    
    if (!podeEditar) {
      alert('Você não tem permissão para editar este agendamento');
      return;
    }

    setAgendamentoEditando(agendamento);
    setModalEditarAberto(true);
  };

  const handleCancelar = (agendamento: Agendamento) => {
    const podeCancelar = agendamento.usuarioId === usuario?.id;
    
    if (!podeCancelar) {
      alert('Você não tem permissão para cancelar este agendamento');
      return;
    }

    setAgendamentoCancelando(agendamento);
    setModalCancelarAberto(true);
  };

  const confirmarCancelamento = async (aplicarARecorrencia: boolean) => {
    if (!agendamentoCancelando) return;

    try {
      await agendamentoService.cancelar(agendamentoCancelando.id, aplicarARecorrencia);
      setModalCancelarAberto(false);
      setAgendamentoCancelando(null);
      carregarAgendamentos();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao cancelar agendamento');
    }
  };

  const getStatusBadge = (status: StatusAgendamento) => {
    const styles = {
      CONFIRMADO: 'bg-green-100 text-green-700',
      CANCELADO: 'bg-red-100 text-red-700',
      CONCLUIDO: 'bg-gray-100 text-gray-700',
    };

    const icons = {
      CONFIRMADO: <CheckCircle className="w-4 h-4" />,
      CANCELADO: <XCircle className="w-4 h-4" />,
      CONCLUIDO: <CalendarCheck className="w-4 h-4" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const getTipoBadge = (agendamento: Agendamento) => {
    if (agendamento.atletaId && agendamento.atleta) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          <Users className="w-3 h-3" />
          Atleta
        </span>
      );
    }
    if (agendamento.nomeAvulso) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
          <UserPlus className="w-3 h-3" />
          Avulso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <User className="w-3 h-3" />
        Próprio
      </span>
    );
  };

  const getInfoAgendamento = (agendamento: Agendamento) => {
    if (agendamento.atletaId && agendamento.atleta) {
      return {
        nome: agendamento.atleta.nome,
        contato: agendamento.atleta.fone || '—',
        tipo: 'Atleta',
      };
    }
    if (agendamento.nomeAvulso) {
      return {
        nome: agendamento.nomeAvulso,
        contato: agendamento.telefoneAvulso || '—',
        tipo: 'Avulso',
      };
    }
    return {
      nome: agendamento.usuario?.name || '—',
      contato: agendamento.usuario?.email || '—',
      tipo: 'Próprio',
    };
  };

  const formatCurrency = (v: number | null) =>
    v == null
      ? '—'
      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Agendamentos</h1>
            <p className="text-gray-600">Gerencie seus agendamentos de quadras</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/app/atleta/agendamentos/agenda')}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              <Calendar className="w-5 h-5" />
              Agenda Semanal
            </button>
            <button
              onClick={() => router.push('/app/atleta/agendamentos/novo')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              Novo Agendamento
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Estabelecimento
              </label>
              <select
                value={pointSelecionado}
                onChange={(e) => {
                  setPointSelecionado(e.target.value);
                  setQuadraSelecionada('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Todos</option>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quadra</label>
              <select
                value={quadraSelecionada}
                onChange={(e) => setQuadraSelecionada(e.target.value)}
                disabled={!pointSelecionado}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Todas</option>
                {quadras.map((quadra) => (
                  <option key={quadra.id} value={quadra.id}>
                    {quadra.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as StatusAgendamento | '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Todos</option>
                <option value="CONFIRMADO">Confirmado</option>
                <option value="CANCELADO">Cancelado</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasMeus}
                  onChange={(e) => setApenasMeus(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Apenas meus</span>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Agendamentos */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meus Agendamentos</h2>
          {agendamentos.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Nenhum agendamento encontrado</p>
              <button
                onClick={() => router.push('/app/atleta/agendamentos/novo')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Criar Primeiro Agendamento
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {agendamentos.map((agendamento) => {
                const dataHora = new Date(agendamento.dataHora);
                const dataFim = new Date(dataHora.getTime() + agendamento.duracao * 60000);

                return (
                  <div
                    key={agendamento.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 text-lg">
                                {agendamento.quadra.nome}
                              </h3>
                              {getTipoBadge(agendamento)}
                            </div>
                            <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                              <MapPin className="w-4 h-4" />
                              {agendamento.quadra.point.logoUrl && (
                                <img
                                  src={agendamento.quadra.point.logoUrl}
                                  alt={`Logo ${agendamento.quadra.point.nome}`}
                                  className="w-4 h-4 object-contain rounded"
                                />
                              )}
                              {agendamento.quadra.point.nome}
                            </p>
                            {agendamento.quadra.tipo && (
                              <p className="text-xs text-gray-500 mb-2">
                                Tipo: {agendamento.quadra.tipo}
                              </p>
                            )}
                            {/* Informações do agendado */}
                            {(() => {
                              const info = getInfoAgendamento(agendamento);
                              return (
                                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                  <p className="text-sm font-medium text-gray-700">
                                    {info.tipo === 'Atleta' && <Users className="inline w-4 h-4 mr-1" />}
                                    {info.tipo === 'Avulso' && <UserPlus className="inline w-4 h-4 mr-1" />}
                                    {info.tipo === 'Próprio' && <User className="inline w-4 h-4 mr-1" />}
                                    {info.nome}
                                  </p>
                                  {info.contato && info.contato !== '—' && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Contato: {info.contato}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>
                              {dataHora.toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}{' '}
                              das {dataHora.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              às {dataFim.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Duração: {agendamento.duracao} minutos</span>
                          </div>
                          <div className="flex flex-col items-end text-xs sm:text-sm">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                              <span className="text-[10px] font-bold">R$</span>
                              {formatCurrency(
                                agendamento.valorNegociado ?? agendamento.valorCalculado
                              )}
                            </span>
                            {agendamento.valorCalculado != null &&
                              agendamento.valorNegociado != null &&
                              agendamento.valorCalculado !== agendamento.valorNegociado && (
                                <span className="mt-1 text-[11px] text-gray-500">
                                  <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 mr-1 text-[10px] uppercase">
                                    tabela
                                  </span>
                                  {formatCurrency(agendamento.valorCalculado)}
                                </span>
                              )}
                          </div>
                        </div>

                        {agendamento.observacoes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Observações: </span>
                              {agendamento.observacoes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(agendamento.status)}
                        <div className="flex gap-2">
                          {agendamento.status === 'CONFIRMADO' && 
                           agendamento.usuarioId === usuario?.id && (
                            <>
                              <button
                                onClick={() => handleEditar(agendamento)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleCancelar(agendamento)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                              >
                                <X className="w-4 h-4" />
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      <EditarAgendamentoModal
        isOpen={modalEditarAberto}
        agendamento={agendamentoEditando}
        onClose={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
        }}
        onSuccess={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
          carregarAgendamentos();
        }}
      />

      {/* Modal de Confirmação de Cancelamento */}
      <ConfirmarCancelamentoRecorrenteModal
        isOpen={modalCancelarAberto}
        agendamento={agendamentoCancelando}
        onClose={() => {
          setModalCancelarAberto(false);
          setAgendamentoCancelando(null);
        }}
        onConfirmar={confirmarCancelamento}
      />
    </div>
  );
}
