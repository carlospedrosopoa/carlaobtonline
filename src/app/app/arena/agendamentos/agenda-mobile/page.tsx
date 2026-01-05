// app/app/arena/agendamentos/agenda-mobile/page.tsx - Agenda Mobile otimizada para smartphone
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService, agendamentoService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import type { Quadra, Agendamento } from '@/types/agendamento';
import { Calendar, ChevronLeft, ChevronRight, Clock, Edit, User, Users, UserPlus, Plus, Search, GraduationCap } from 'lucide-react';

export default function ArenaAgendaMobilePage() {
  const { usuario, isAdmin, isOrganizer } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNome, setFiltroNome] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [dataInicialModal, setDataInicialModal] = useState<string | undefined>(undefined);
  const [horaInicialModal, setHoraInicialModal] = useState<string | undefined>(undefined);

  // Inicializar sempre com a data atual como primeiro dia
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });

  // Gerar array de dias (7 dias a partir da data selecionada)
  const dias = useMemo(() => {
    const diasArray = [];
    for (let i = 0; i < 7; i++) {
      const data = new Date(dataSelecionada);
      data.setDate(dataSelecionada.getDate() + i);
      diasArray.push(data);
    }
    return diasArray;
  }, [dataSelecionada]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    carregarAgendamentos();
  }, [dataSelecionada]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      // Se for ORGANIZER, filtrar apenas quadras da sua arena
      const pointIdFiltro = usuario?.role === 'ORGANIZER' && usuario?.pointIdGestor 
        ? usuario.pointIdGestor 
        : undefined;
      const quadrasData = await quadraService.listar(pointIdFiltro);
      setQuadras(quadrasData.filter((q) => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarAgendamentos = async () => {
    try {
      // Criar datas preservando o dia local mas usando Date.UTC() para consistência
      // Extrair componentes da data local
      const ano = dataSelecionada.getFullYear();
      const mes = dataSelecionada.getMonth();
      const dia = dataSelecionada.getDate();
      
      // Criar data início: meia-noite do dia local em UTC
      const dataInicio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
      
      // Criar data fim: 6 dias depois, 23:59:59 do dia local em UTC
      const dataFimTemp = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));
      dataFimTemp.setUTCDate(dataFimTemp.getUTCDate() + 6);

      // Converter para ISO string UTC
      const dataInicioISO = dataInicio.toISOString();
      const dataFimISO = dataFimTemp.toISOString();

      const filtros: any = {
        dataInicio: dataInicioISO,
        dataFim: dataFimISO,
        status: 'CONFIRMADO',
      };

      const agendamentosData = await agendamentoService.listar(filtros);
      setAgendamentos(agendamentosData);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const getAgendamentosPorDia = (dia: Date) => {
    // Comparar usando strings de data (YYYY-MM-DD) para evitar problemas de timezone
    const formatarDataParaComparacao = (date: Date) => {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const diaData = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${diaData}`;
    };

    const diaComparacaoStr = formatarDataParaComparacao(dia);

    let agendamentosFiltrados = agendamentos.filter((ag) => {
      const dataAgendamento = new Date(ag.dataHora);
      const diaAgendamentoStr = formatarDataParaComparacao(dataAgendamento);
      return diaAgendamentoStr === diaComparacaoStr;
    });

    // Aplicar filtro por nome ou telefone
    if (filtroNome.trim()) {
      const termoBusca = filtroNome.toLowerCase().trim();
      const termoBuscaNumerico = termoBusca.replace(/\D/g, '');
      
      agendamentosFiltrados = agendamentosFiltrados.filter((ag) => {
        if (ag.ehAula && ag.professor?.usuario?.name && ag.professor.usuario.name.toLowerCase().includes(termoBusca)) {
          return true;
        }
        if (ag.atleta?.nome && ag.atleta.nome.toLowerCase().includes(termoBusca)) {
          return true;
        }
        if (ag.atleta?.fone && termoBuscaNumerico) {
          const foneAtleta = ag.atleta.fone.replace(/\D/g, '');
          if (foneAtleta.includes(termoBuscaNumerico)) {
            return true;
          }
        }
        if (ag.nomeAvulso && ag.nomeAvulso.toLowerCase().includes(termoBusca)) {
          return true;
        }
        if (ag.usuario?.name && ag.usuario.name.toLowerCase().includes(termoBusca)) {
          return true;
        }
        return false;
      });
    }

    // Ordenar por horário
    return agendamentosFiltrados.sort((a, b) => {
      const matchA = a.dataHora.match(/T(\d{2}):(\d{2})/);
      const matchB = b.dataHora.match(/T(\d{2}):(\d{2})/);
      if (!matchA || !matchB) return 0;
      const horaA = parseInt(matchA[1], 10) * 60 + parseInt(matchA[2], 10);
      const horaB = parseInt(matchB[1], 10) * 60 + parseInt(matchB[2], 10);
      return horaA - horaB;
    });
  };

  const formatarData = (data: Date) => {
    return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const formatarHora = (dataHoraStr: string) => {
    const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
    if (!match) return '';
    return `${match[1]}:${match[2]}`;
  };

  const getNomeCliente = (agendamento: Agendamento) => {
    if (agendamento.ehAula && agendamento.professor?.usuario?.name) {
      return agendamento.professor.usuario.name;
    }
    if (agendamento.atleta?.nome) {
      return agendamento.atleta.nome;
    }
    if (agendamento.nomeAvulso) {
      return agendamento.nomeAvulso;
    }
    if (agendamento.usuario?.name) {
      return agendamento.usuario.name;
    }
    return '—';
  };

  const getTipoBadge = (agendamento: Agendamento) => {
    const ehAula = agendamento.ehAula || (agendamento.professorId !== null && agendamento.professorId !== undefined);
    
    if (ehAula) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
          <GraduationCap className="w-3 h-3" />
          Aula
        </span>
      );
    }
    
    if (agendamento.atletaId && agendamento.atleta) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
          <Users className="w-3 h-3" />
          Atleta
        </span>
      );
    }
    if (agendamento.nomeAvulso) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
          <UserPlus className="w-3 h-3" />
          Avulso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
        <User className="w-3 h-3" />
        Próprio
      </span>
    );
  };

  const navegarDias = (direcao: 'anterior' | 'proxima') => {
    const novaData = new Date(dataSelecionada);
    if (direcao === 'proxima') {
      novaData.setDate(dataSelecionada.getDate() + 7);
    } else {
      novaData.setDate(dataSelecionada.getDate() - 7);
    }
    novaData.setHours(0, 0, 0, 0);
    setDataSelecionada(novaData);
  };

  const irParaHoje = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    setDataSelecionada(hoje);
  };

  const handleEditar = (agendamento: Agendamento) => {
    setAgendamentoEditando(agendamento);
    setModalEditarAberto(true);
  };

  const handleNovoAgendamento = (dia?: Date, hora?: string) => {
    if (dia) {
      const dataStr = dia.toISOString().split('T')[0];
      setDataInicialModal(dataStr);
      if (hora) {
        setHoraInicialModal(hora);
      }
    }
    setAgendamentoEditando(null);
    setModalEditarAberto(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Agenda Mobile</h1>
            <button
              onClick={irParaHoje}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Hoje
            </button>
          </div>

          {/* Navegação de datas */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <button
              onClick={() => navegarDias('anterior')}
              className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 flex-1 justify-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dataSelecionada.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const novaData = new Date(e.target.value);
                    novaData.setHours(0, 0, 0, 0);
                    setDataSelecionada(novaData);
                  }
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none flex-1 max-w-[180px]"
                title="Selecione uma data"
              />
            </div>
            <button
              onClick={() => navegarDias('proxima')}
              className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Filtro de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {/* Lista de dias */}
      <div className="px-4 py-4 space-y-4">
        {dias.map((dia, index) => {
          const agendamentosDoDia = getAgendamentosPorDia(dia);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const isHoje = dia.getTime() === hoje.getTime();

          return (
            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Cabeçalho do dia */}
              <div className={`px-4 py-3 border-b ${isHoje ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${isHoje ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`font-semibold ${isHoje ? 'text-blue-700' : 'text-gray-700'}`}>
                        {formatarData(dia)}
                      </span>
                      {isHoje && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Hoje</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{agendamentosDoDia.length} agendamento(s)</span>
                    {(isAdmin || isOrganizer) && (
                      <button
                        onClick={() => handleNovoAgendamento(dia)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        title="Novo agendamento"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de agendamentos do dia */}
              <div className="divide-y divide-gray-100">
                {agendamentosDoDia.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    Nenhum agendamento neste dia
                  </div>
                ) : (
                  agendamentosDoDia.map((agendamento) => (
                    <div
                      key={agendamento.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-semibold text-gray-900 text-sm">
                              {formatarHora(agendamento.dataHora)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({Math.floor(agendamento.duracao / 60)}h{agendamento.duracao % 60 > 0 ? ` ${agendamento.duracao % 60}min` : ''})
                            </span>
                            {getTipoBadge(agendamento)}
                          </div>
                          
                          <div className="mb-1.5">
                            <div className="font-medium text-gray-900 text-sm truncate">
                              {getNomeCliente(agendamento)}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {agendamento.quadra?.nome || '—'}
                            </div>
                          </div>

                          {agendamento.observacoes && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {agendamento.observacoes}
                            </div>
                          )}
                        </div>

                        {(isAdmin || isOrganizer) && (
                          <button
                            onClick={() => handleEditar(agendamento)}
                            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 flex-shrink-0"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão flutuante para novo agendamento */}
      {(isAdmin || isOrganizer) && (
        <button
          onClick={() => handleNovoAgendamento()}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-20"
          title="Novo agendamento"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modal de edição */}
      {modalEditarAberto && (
        <EditarAgendamentoModal
          isOpen={modalEditarAberto}
          onClose={() => {
            setModalEditarAberto(false);
            setAgendamentoEditando(null);
            setDataInicialModal(undefined);
            setHoraInicialModal(undefined);
          }}
          agendamento={agendamentoEditando}
          dataInicial={dataInicialModal}
          horaInicial={horaInicialModal}
          onSuccess={() => {
            carregarAgendamentos();
          }}
        />
      )}
    </div>
  );
}

