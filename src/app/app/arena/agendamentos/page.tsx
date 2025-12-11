// app/app/arena/agendamentos/page.tsx - Agenda da arena
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import ConfirmarExclusaoRecorrenteModal from '@/components/ConfirmarExclusaoRecorrenteModal';
import type { Quadra, Agendamento, StatusAgendamento, BloqueioAgenda } from '@/types/agendamento';
import { Calendar, Clock, MapPin, X, CheckCircle, XCircle, CalendarCheck, User, Users, UserPlus, Edit, Plus, Search, Lock } from 'lucide-react';

export default function ArenaAgendamentosPage() {
  const { usuario, isAdmin, isOrganizer } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [quadraSelecionada, setQuadraSelecionada] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | ''>('');
  const [filtroNome, setFiltroNome] = useState('');
  const [mostrarAntigos, setMostrarAntigos] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [dadosPreservadosReabertura, setDadosPreservadosReabertura] = useState<{
    data?: string;
    hora?: string;
    duracao?: number;
    observacoes?: string;
    valorNegociado?: string;
    modo?: 'normal' | 'atleta' | 'avulso';
    atletaId?: string;
    nomeAvulso?: string;
    telefoneAvulso?: string;
    manterNaTela?: boolean;
  } | null>(null);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [agendamentoExcluindo, setAgendamentoExcluindo] = useState<Agendamento | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    carregarAgendamentos();
  }, [quadraSelecionada, filtroStatus, mostrarAntigos]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const quadrasData = await quadraService.listar();
      setQuadras(quadrasData.filter((q) => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular início da semana atual (segunda-feira)
  const inicioSemanaAtual = useMemo(() => {
    const hoje = new Date();
    const dia = hoje.getDay();
    const diff = hoje.getDate() - dia + (dia === 0 ? -6 : 1); // Ajuste para segunda-feira
    const segunda = new Date(hoje);
    segunda.setDate(diff);
    segunda.setHours(0, 0, 0, 0);
    return segunda;
  }, []);

  const carregarAgendamentos = async () => {
    try {
      const formatarDataLocal = (date: Date) => {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        const hora = String(date.getHours()).padStart(2, '0');
        const minuto = String(date.getMinutes()).padStart(2, '0');
        const segundo = String(date.getSeconds()).padStart(2, '0');
        return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
      };

      const filtros: any = {};
      if (quadraSelecionada) filtros.quadraId = quadraSelecionada;
      if (filtroStatus) filtros.status = filtroStatus;
      
      // Por padrão, mostrar apenas agendamentos da semana atual em diante
      if (!mostrarAntigos) {
        filtros.dataInicio = formatarDataLocal(inicioSemanaAtual);
      }

      // Carregar agendamentos e bloqueios em paralelo
      const [agendamentosData, bloqueiosData] = await Promise.all([
        agendamentoService.listar(filtros),
        bloqueioAgendaService.listar({
          apenasAtivos: true,
          ...(mostrarAntigos ? {} : { dataInicio: formatarDataLocal(inicioSemanaAtual) }),
        }),
      ]);

      setAgendamentos(agendamentosData);
      setBloqueios(bloqueiosData);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const handleEditar = (agendamento: Agendamento) => {
    setAgendamentoEditando(agendamento);
    setModalEditarAberto(true);
  };

  const handleCancelar = (agendamento: Agendamento) => {
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

  const handleDeletar = (agendamento: Agendamento) => {
    setAgendamentoExcluindo(agendamento);
    setModalExcluirAberto(true);
  };

  const confirmarExclusao = async (aplicarARecorrencia: boolean) => {
    if (!agendamentoExcluindo) return;

    try {
      await agendamentoService.deletar(agendamentoExcluindo.id, aplicarARecorrencia);
      setModalExcluirAberto(false);
      setAgendamentoExcluindo(null);
      alert('Agendamento(s) excluído(s) com sucesso');
      carregarAgendamentos();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao excluir agendamento');
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

  // Filtrar agendamentos por nome ou telefone
  const agendamentosFiltrados = useMemo(() => {
    if (!filtroNome.trim()) {
      return agendamentos;
    }

    const termoBusca = filtroNome.toLowerCase().trim();
    const termoBuscaNumerico = termoBusca.replace(/\D/g, '');
    
    return agendamentos.filter((ag) => {
      // Buscar no nome do atleta
      if (ag.atleta?.nome && ag.atleta.nome.toLowerCase().includes(termoBusca)) {
        return true;
      }
      // Buscar no telefone do atleta (remover caracteres não numéricos para comparação)
      if (ag.atleta?.fone && termoBuscaNumerico) {
        const foneAtleta = ag.atleta.fone.replace(/\D/g, '');
        if (foneAtleta.includes(termoBuscaNumerico)) {
          return true;
        }
      }
      // Buscar no nome avulso
      if (ag.nomeAvulso && ag.nomeAvulso.toLowerCase().includes(termoBusca)) {
        return true;
      }
      // Buscar no telefone avulso (remover caracteres não numéricos para comparação)
      if (ag.telefoneAvulso && termoBuscaNumerico) {
        const foneAvulso = ag.telefoneAvulso.replace(/\D/g, '');
        if (foneAvulso.includes(termoBuscaNumerico)) {
          return true;
        }
      }
      // Buscar no nome do usuário
      if (ag.usuario?.name && ag.usuario.name.toLowerCase().includes(termoBusca)) {
        return true;
      }
      // Buscar no email do usuário
      if (ag.usuario?.email && ag.usuario.email.toLowerCase().includes(termoBusca)) {
        return true;
      }
      return false;
    });
  }, [agendamentos, filtroNome]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Agenda</h1>
          <p className="text-gray-600">Gerencie todos os agendamentos da sua arena</p>
        </div>
        <button
          onClick={() => {
            setAgendamentoEditando(null);
            setModalEditarAberto(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Novo Agendamento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
        <div className="space-y-4">
          {/* Filtro de busca por nome ou telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar por nome ou telefone</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Digite o nome ou telefone..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {filtroNome && (
                <button
                  onClick={() => setFiltroNome('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Limpar filtro"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quadra</label>
              <select
                value={quadraSelecionada}
                onChange={(e) => setQuadraSelecionada(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Todas as quadras</option>
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
          </div>

          {/* Opção para mostrar agendamentos antigos */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <input
              type="checkbox"
              id="mostrarAntigos"
              checked={mostrarAntigos}
              onChange={(e) => setMostrarAntigos(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="mostrarAntigos" className="text-sm text-gray-700 cursor-pointer">
              Mostrar agendamentos antigos (anteriores à semana atual)
            </label>
          </div>
        </div>
      </div>

      {/* Lista de Agendamentos */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Agendamentos {filtroNome && `(${agendamentosFiltrados.length} encontrado${agendamentosFiltrados.length !== 1 ? 's' : ''})`}
        </h2>
        {agendamentosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum agendamento encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {agendamentosFiltrados.map((agendamento) => {
              // Extrair data/hora diretamente da string UTC sem conversão de timezone
              // Isso garante que 6h gravado = 6h exibido
              const dataHoraStr = agendamento.dataHora;
              const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
              const horaInicio = match ? parseInt(match[1], 10) : 0;
              const minutoInicio = match ? parseInt(match[2], 10) : 0;
              
              // Calcular hora de fim
              const minutosTotais = horaInicio * 60 + minutoInicio + agendamento.duracao;
              const horaFim = Math.floor(minutosTotais / 60) % 24;
              const minutoFim = minutosTotais % 60;
              
              // Extrair data para exibição
              const dataPart = dataHoraStr.split('T')[0];
              const [ano, mes, dia] = dataPart.split('-').map(Number);
              const dataHora = new Date(ano, mes - 1, dia); // Apenas para formatação de data

              return (
                <div
                  key={agendamento.id}
                  onClick={() => {
                    // Só permite editar se o status for CONFIRMADO
                    if (agendamento.status === 'CONFIRMADO') {
                      handleEditar(agendamento);
                    }
                  }}
                  className={`border border-gray-200 rounded-lg p-4 transition-shadow ${
                    agendamento.status === 'CONFIRMADO' 
                      ? 'hover:shadow-md cursor-pointer hover:border-blue-300' 
                      : 'cursor-default'
                  }`}
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
                            das {horaInicio.toString().padStart(2, '0')}:{minutoInicio.toString().padStart(2, '0')}{' '}
                            às {horaFim.toString().padStart(2, '0')}:{minutoFim.toString().padStart(2, '0')}
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

                      {/* Participantes */}
                      {agendamento.atletasParticipantes && agendamento.atletasParticipantes.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Participantes ({agendamento.atletasParticipantes.length})
                          </p>
                          <div className="space-y-1.5">
                            {agendamento.atletasParticipantes.map((participante) => (
                              <div
                                key={participante.id}
                                className="flex items-center gap-2 p-2 bg-white rounded border border-purple-100"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {participante.atleta.nome}
                                  </p>
                                  {participante.atleta.fone && (
                                    <p className="text-xs text-gray-600 truncate">
                                      {participante.atleta.fone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                        {agendamento.status === 'CONFIRMADO' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditar(agendamento);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelar(agendamento);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                            >
                              <X className="w-4 h-4" />
                              Cancelar
                            </button>
                            {(isAdmin || isOrganizer) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletar(agendamento);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                title="Excluir permanentemente"
                              >
                                <X className="w-4 h-4" />
                                Excluir
                              </button>
                            )}
                          </>
                        )}
                        {(isAdmin || isOrganizer) && agendamento.status !== 'CONFIRMADO' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletar(agendamento);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                            title="Excluir permanentemente"
                          >
                            <X className="w-4 h-4" />
                            Excluir
                          </button>
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

      {/* Lista de Bloqueios */}
      {bloqueios.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-600" />
            Bloqueios de Agenda ({bloqueios.length})
          </h2>
          <div className="space-y-3">
            {bloqueios.map((bloqueio) => {
              const dataInicio = new Date(bloqueio.dataInicio);
              const dataFim = new Date(bloqueio.dataFim);
              
              // Formatar período
              const periodoTexto = dataInicio.toDateString() === dataFim.toDateString()
                ? dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : `${dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${dataFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

              // Formatar horário
              let horarioTexto = '';
              if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
                const horaInicio = Math.floor(bloqueio.horaInicio / 60);
                const minutoInicio = bloqueio.horaInicio % 60;
                const horaFim = Math.floor(bloqueio.horaFim / 60);
                const minutoFim = bloqueio.horaFim % 60;
                horarioTexto = `das ${horaInicio.toString().padStart(2, '0')}:${minutoInicio.toString().padStart(2, '0')} às ${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`;
              } else {
                horarioTexto = 'dia inteiro';
              }

              // Obter quadras afetadas
              const quadrasAfetadas = bloqueio.quadraIds === null
                ? quadras.filter(q => q.pointId === bloqueio.pointId)
                : quadras.filter(q => bloqueio.quadraIds?.includes(q.id));

              return (
                <div
                  key={bloqueio.id}
                  className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-red-600" />
                        <h3 className="font-semibold text-gray-900">{bloqueio.titulo}</h3>
                      </div>
                      {bloqueio.descricao && (
                        <p className="text-sm text-gray-700 mb-2">{bloqueio.descricao}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{periodoTexto} {horarioTexto}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {bloqueio.quadraIds === null
                              ? 'Todas as quadras'
                              : `${quadrasAfetadas.length} quadra${quadrasAfetadas.length !== 1 ? 's' : ''}: ${quadrasAfetadas.map(q => q.nome).join(', ')}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      <EditarAgendamentoModal
        isOpen={modalEditarAberto}
        agendamento={agendamentoEditando}
        onClose={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
          // Limpar dados preservados ao fechar manualmente
          setTimeout(() => {
            setDadosPreservadosReabertura(null);
          }, 200);
        }}
        onSuccess={() => {
          carregarAgendamentos();
          // Se houver dados preservados, não fechar ainda (será fechado e reaberto pelo componente)
          // O componente vai chamar onReopenWithData que fecha e reabre
          if (!dadosPreservadosReabertura) {
            setModalEditarAberto(false);
            setAgendamentoEditando(null);
          }
        }}
        onReopenWithData={(dados) => {
          // Armazenar dados preservados
          setDadosPreservadosReabertura(dados);
          // Fechar modal primeiro
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
          // Reabrir após um pequeno delay com dados preservados
          setTimeout(() => {
            setAgendamentoEditando(null); // Garantir que é modo criação
            setModalEditarAberto(true);
            // Limpar dados preservados após reabrir (para não ficar sempre reabrindo com os mesmos dados)
            setTimeout(() => {
              setDadosPreservadosReabertura(null);
            }, 300);
          }, 150);
        }}
        dadosPreservados={dadosPreservadosReabertura}
        dataInicial={dadosPreservadosReabertura?.data}
        horaInicial={dadosPreservadosReabertura?.hora}
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

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmarExclusaoRecorrenteModal
        isOpen={modalExcluirAberto}
        agendamento={agendamentoExcluindo}
        onClose={() => {
          setModalExcluirAberto(false);
          setAgendamentoExcluindo(null);
        }}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
