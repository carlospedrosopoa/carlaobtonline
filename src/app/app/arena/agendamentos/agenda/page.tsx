// app/app/arena/agendamentos/agenda/page.tsx - Agenda semanal da arena
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import type { Quadra, Agendamento, StatusAgendamento, BloqueioAgenda } from '@/types/agendamento';
import { Calendar, ChevronLeft, ChevronRight, Clock, Filter, X, Edit, User, Users, UserPlus, Plus, MoreVertical, Search, Lock } from 'lucide-react';

export default function ArenaAgendaSemanalPage() {
  const { usuario } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [apenasReservados, setApenasReservados] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [tooltipAgendamento, setTooltipAgendamento] = useState<string | null>(null);
  const [tooltipPosicao, setTooltipPosicao] = useState<{ x: number; y: number } | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Calcular segunda-feira da semana atual para inicialização
  const calcularSegundaFeira = (data: Date) => {
    const dataCopy = new Date(data);
    dataCopy.setHours(0, 0, 0, 0);
    const dia = dataCopy.getDay();
    if (dia === 1) {
      return dataCopy;
    }
    const diff = dataCopy.getDate() - dia + (dia === 0 ? -6 : 1);
    const segunda = new Date(dataCopy);
    segunda.setDate(diff);
    segunda.setHours(0, 0, 0, 0);
    return segunda;
  };

  const [inicioSemana, setInicioSemana] = useState(() => {
    return calcularSegundaFeira(new Date());
  });

  // Gerar array de dias da semana (mostrar 4 dias por vez para melhor visualização)
  const diasSemana = useMemo(() => {
    const dias = [];
    const quantidadeDias = 4; // Mostrar 4 dias por vez
    for (let i = 0; i < quantidadeDias; i++) {
      const data = new Date(inicioSemana);
      data.setDate(inicioSemana.getDate() + i);
      dias.push(data);
    }
    return dias;
  }, [inicioSemana]);

  // Gerar array de horários (7h às 23h) com intervalos de 30 minutos
  const horarios = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 23; h++) {
      slots.push({ hora: h, minuto: 0 });
      if (h < 23) {
        slots.push({ hora: h, minuto: 30 });
      }
    }
    return slots;
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    carregarAgendamentos();
  }, [inicioSemana]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuAberto) {
        const menuElement = menuRefs.current[menuAberto];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setMenuAberto(null);
        }
      }
    };
    
    if (menuAberto) {
      // Usar setTimeout para garantir que o evento de abertura seja processado primeiro
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [menuAberto]);

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

  const carregarAgendamentos = async () => {
    try {
      // Criar datas no horário local (sem conversão de timezone)
      const dataInicio = new Date(inicioSemana);
      dataInicio.setHours(0, 0, 0, 0);
      
      const dataFim = new Date(inicioSemana);
      dataFim.setDate(dataFim.getDate() + 4); // Ajustar para 4 dias
      dataFim.setHours(23, 59, 59, 999);

      // Formatar datas como ISO string (mas tratando como local)
      // Usar formato YYYY-MM-DDTHH:mm:ss para evitar problemas de timezone
      const formatarDataLocal = (date: Date) => {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        const hora = String(date.getHours()).padStart(2, '0');
        const minuto = String(date.getMinutes()).padStart(2, '0');
        const segundo = String(date.getSeconds()).padStart(2, '0');
        return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
      };

      const filtros: any = {
        dataInicio: formatarDataLocal(dataInicio),
        dataFim: formatarDataLocal(dataFim),
        status: 'CONFIRMADO', // Apenas agendamentos confirmados
      };

      // Carregar agendamentos e bloqueios em paralelo
      const [agendamentosData, bloqueiosData] = await Promise.all([
        agendamentoService.listar(filtros),
        bloqueioAgendaService.listar({
          dataInicio: formatarDataLocal(dataInicio),
          dataFim: formatarDataLocal(dataFim),
          apenasAtivos: true,
        }),
      ]);

      setAgendamentos(agendamentosData);
      setBloqueios(bloqueiosData);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const getAgendamentosPorDia = (dia: Date) => {
    // Retorna todos os agendamentos do dia especificado
    let agendamentosFiltrados = agendamentos.filter((ag) => {
      const dataAgendamento = new Date(ag.dataHora);
      const anoAgendamento = dataAgendamento.getFullYear();
      const mesAgendamento = dataAgendamento.getMonth();
      const diaAgendamento = dataAgendamento.getDate();
      
      const anoComparacao = dia.getFullYear();
      const mesComparacao = dia.getMonth();
      const diaComparacao = dia.getDate();
      
      return anoAgendamento === anoComparacao && 
             mesAgendamento === mesComparacao && 
             diaAgendamento === diaComparacao;
    });

    // Aplicar filtro por nome ou telefone
    if (filtroNome.trim()) {
      const termoBusca = filtroNome.toLowerCase().trim();
      const termoBuscaNumerico = termoBusca.replace(/\D/g, '');
      
      agendamentosFiltrados = agendamentosFiltrados.filter((ag) => {
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
    }

    return agendamentosFiltrados;
  };

  const getAgendamentosPorHorario = (dia: Date, hora: number, minuto: number = 0) => {
    // Retorna agendamentos que começam neste horário específico
    let agendamentosFiltrados = agendamentos.filter((ag) => {
      const dataAgendamento = new Date(ag.dataHora);
      const anoAgendamento = dataAgendamento.getFullYear();
      const mesAgendamento = dataAgendamento.getMonth();
      const diaAgendamento = dataAgendamento.getDate();
      const horaAgendamento = dataAgendamento.getHours();
      const minutoAgendamento = dataAgendamento.getMinutes();
      
      const anoComparacao = dia.getFullYear();
      const mesComparacao = dia.getMonth();
      const diaComparacao = dia.getDate();
      
      if (anoAgendamento !== anoComparacao || 
          mesAgendamento !== mesComparacao || 
          diaAgendamento !== diaComparacao) {
        return false;
      }
      
      // Mostrar apenas na linha do horário de início exato
      return horaAgendamento === hora && minutoAgendamento === minuto;
    });

    // Aplicar filtro por nome ou telefone
    if (filtroNome.trim()) {
      const termoBusca = filtroNome.toLowerCase().trim();
      const termoBuscaNumerico = termoBusca.replace(/\D/g, '');
      
      agendamentosFiltrados = agendamentosFiltrados.filter((ag) => {
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
    }
    
    // Deduplicar por ID
    const idsVistos = new Set<string>();
    return agendamentosFiltrados.filter((ag) => {
      if (idsVistos.has(ag.id)) {
        return false;
      }
      idsVistos.add(ag.id);
      return true;
    });
  };

  const calcularLinhasAgendamento = (duracaoMinutos: number) => {
    // Cada linha representa 30 minutos, calcular quantas linhas o agendamento ocupa
    return Math.max(1, Math.ceil(duracaoMinutos / 30));
  };

  // Verificar se um horário está bloqueado para uma quadra específica
  const estaBloqueado = (dia: Date, hora: number, minuto: number, quadraId: string) => {
    const minutosSlot = hora * 60 + minuto;
    
    return bloqueios.some((bloqueio) => {
      if (!bloqueio.ativo) return false;

      const dataInicio = new Date(bloqueio.dataInicio);
      const dataFim = new Date(bloqueio.dataFim);
      
      // Verificar se o dia está dentro do período do bloqueio
      const anoDia = dia.getFullYear();
      const mesDia = dia.getMonth();
      const diaDia = dia.getDate();
      
      const anoInicio = dataInicio.getFullYear();
      const mesInicio = dataInicio.getMonth();
      const diaInicio = dataInicio.getDate();
      
      const anoFim = dataFim.getFullYear();
      const mesFim = dataFim.getMonth();
      const diaFim = dataFim.getDate();
      
      const diaEstaNoPeriodo = 
        (anoDia > anoInicio || (anoDia === anoInicio && mesDia > mesInicio) || (anoDia === anoInicio && mesDia === mesInicio && diaDia >= diaInicio)) &&
        (anoDia < anoFim || (anoDia === anoFim && mesDia < mesFim) || (anoDia === anoFim && mesDia === mesFim && diaDia <= diaFim));

      if (!diaEstaNoPeriodo) return false;

      // Verificar se a quadra está bloqueada
      if (bloqueio.quadraIds === null) {
        // Bloqueio geral - todas as quadras
        // Verificar se a quadra pertence ao mesmo point
        const quadra = quadras.find(q => q.id === quadraId);
        if (!quadra || quadra.pointId !== bloqueio.pointId) return false;
      } else {
        // Bloqueio específico - verificar se a quadra está na lista
        if (!bloqueio.quadraIds.includes(quadraId)) return false;
      }

      // Verificar horário
      if (bloqueio.horaInicio === null || bloqueio.horaInicio === undefined || bloqueio.horaFim === null || bloqueio.horaFim === undefined) {
        // Dia inteiro bloqueado
        return true;
      }

      // Verificar se o slot está dentro do intervalo de horário bloqueado
      return minutosSlot >= bloqueio.horaInicio && minutosSlot < bloqueio.horaFim;
    });
  };

  // Obter bloqueios que afetam uma quadra em um dia específico
  const getBloqueiosPorDiaEQuadra = (dia: Date, quadraId: string) => {
    return bloqueios.filter((bloqueio) => {
      if (!bloqueio.ativo) return false;

      const dataInicio = new Date(bloqueio.dataInicio);
      const dataFim = new Date(bloqueio.dataFim);
      
      const anoDia = dia.getFullYear();
      const mesDia = dia.getMonth();
      const diaDia = dia.getDate();
      
      const anoInicio = dataInicio.getFullYear();
      const mesInicio = dataInicio.getMonth();
      const diaInicio = dataInicio.getDate();
      
      const anoFim = dataFim.getFullYear();
      const mesFim = dataFim.getMonth();
      const diaFim = dataFim.getDate();
      
      const diaEstaNoPeriodo = 
        (anoDia > anoInicio || (anoDia === anoInicio && mesDia > mesInicio) || (anoDia === anoInicio && mesDia === mesInicio && diaDia >= diaInicio)) &&
        (anoDia < anoFim || (anoDia === anoFim && mesDia < mesFim) || (anoDia === anoFim && mesDia === mesFim && diaDia <= diaFim));

      if (!diaEstaNoPeriodo) return false;

      // Verificar se a quadra está bloqueada
      if (bloqueio.quadraIds === null) {
        const quadra = quadras.find(q => q.id === quadraId);
        if (!quadra || quadra.pointId !== bloqueio.pointId) return false;
      } else {
        if (!bloqueio.quadraIds.includes(quadraId)) return false;
      }

      return true;
    });
  };

  const temAgendamentoNoHorario = (dia: Date, slot: { hora: number; minuto: number }) => {
    return getAgendamentosPorHorario(dia, slot.hora, slot.minuto).length > 0;
  };

  const temAlgumAgendamentoNoSlot = (slot: { hora: number; minuto: number }) => {
    return diasSemana.some((dia) => temAgendamentoNoHorario(dia, slot));
  };

  const horariosFiltrados = useMemo(() => {
    if (!apenasReservados && !filtroNome.trim()) return horarios;
    return horarios.filter((slot) => {
      return diasSemana.some((dia) => {
        // Verificar se há agendamento que começa neste slot ou antes e ainda está ativo
        const agendamentosDoDia = getAgendamentosPorDia(dia);
        const temAgendamento = agendamentosDoDia.some((ag) => {
          const dataAgendamento = new Date(ag.dataHora);
          const horaInicio = dataAgendamento.getHours();
          const minutoInicio = dataAgendamento.getMinutes();
          const minutosInicio = horaInicio * 60 + minutoInicio;
          const minutosFim = minutosInicio + ag.duracao;
          const minutosSlot = slot.hora * 60 + slot.minuto;
          return minutosSlot >= minutosInicio && minutosSlot < minutosFim;
        });

        // Verificar se há bloqueio neste slot para alguma quadra
        const temBloqueio = quadras.some((quadra) => {
          return estaBloqueado(dia, slot.hora, slot.minuto, quadra.id);
        });

        return temAgendamento || temBloqueio;
      });
    });
  }, [apenasReservados, filtroNome, horarios, agendamentos, diasSemana, bloqueios, quadras]);

  const navegarSemana = (direcao: 'anterior' | 'proxima') => {
    // Calcular o próximo período de 4 dias consecutivos
    if (direcao === 'proxima') {
      // Avançar: próximo período começa 4 dias após o início atual
      const proximoInicio = new Date(inicioSemana);
      proximoInicio.setDate(inicioSemana.getDate() + 4);
      proximoInicio.setHours(0, 0, 0, 0);
      setInicioSemana(proximoInicio);
    } else {
      // Retroceder: período anterior começa 4 dias antes
      const anteriorInicio = new Date(inicioSemana);
      anteriorInicio.setDate(inicioSemana.getDate() - 4);
      anteriorInicio.setHours(0, 0, 0, 0);
      setInicioSemana(anteriorInicio);
    }
  };

  const irParaHoje = () => {
    const segundaAtual = calcularSegundaFeira(new Date());
    setInicioSemana(segundaAtual);
  };

  const handleEditar = (agendamento: Agendamento) => {
    setMenuAberto(null);
    setAgendamentoEditando(agendamento);
    setModalEditarAberto(true);
  };

  const handleCancelar = (agendamento: Agendamento) => {
    setMenuAberto(null);
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

  const getInfoAgendamento = (agendamento: Agendamento) => {
    if (agendamento.atletaId && agendamento.atleta) {
      return {
        nome: agendamento.atleta.nome,
        tipo: 'Atleta',
        icon: Users,
      };
    }
    if (agendamento.nomeAvulso) {
      return {
        nome: agendamento.nomeAvulso,
        tipo: 'Avulso',
        icon: UserPlus,
      };
    }
    return {
      nome: agendamento.usuario?.name || '—',
      tipo: 'Próprio',
      icon: User,
    };
  };

  // Função para obter cor da quadra (cores diferentes para cada quadra)
  const getCorQuadra = (quadraId: string) => {
    const cores = [
      { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
      { bg: 'bg-green-500', border: 'border-green-600', text: 'text-white' },
      { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-white' },
      { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white' },
      { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white' },
      { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' },
      { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white' },
      { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' },
    ];
    const index = quadras.findIndex(q => q.id === quadraId);
    return cores[index % cores.length] || cores[0];
  };

  const formatCurrency = (v: number | null) =>
    v == null
      ? '—'
      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Agenda Semanal</h1>
          <p className="text-gray-600">Visualize todos os agendamentos da sua arena</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setApenasReservados(!apenasReservados)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              apenasReservados
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {apenasReservados ? 'Mostrar todos' : 'Apenas reservados'}
          </button>
          <button
            onClick={() => {
              setAgendamentoEditando(null);
              setModalEditarAberto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Filtro de busca */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {filtroNome && (
            <button
              onClick={() => setFiltroNome('')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              title="Limpar filtro"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Controles de navegação */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navegarSemana('anterior')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {inicioSemana.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}{' '}
              -{' '}
              {new Date(inicioSemana.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(
                'pt-BR',
                {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }
              )}
            </h2>
            <button
              onClick={irParaHoje}
              className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ir para hoje
            </button>
          </div>

          <button
            onClick={() => navegarSemana('proxima')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Agenda */}
      <div className="bg-white rounded-xl shadow-lg overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <div className="min-w-[1000px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 border-r-2 border-gray-300 w-20">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Horário
                    </div>
                  </th>
                  {diasSemana.map((dia, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-700 min-w-[220px] bg-gradient-to-b from-blue-50 to-blue-100 border-r border-gray-200"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-gray-600 text-xs uppercase font-bold">
                          {dia.toLocaleDateString('pt-BR', { weekday: 'long' })}
                        </span>
                        <span className="text-gray-900 font-bold text-base mt-1">
                          {dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horariosFiltrados.map((slot) => {
                  const mostrarHora = slot.minuto === 0; // Mostrar apenas nas horas cheias
                  
                  return (
                    <tr key={`${slot.hora}-${slot.minuto}`} className="border-b border-gray-200">
                      <td className="sticky left-0 z-10 bg-white px-4 py-1 text-xs font-medium text-gray-600 border-r-2 border-gray-300 align-top">
                        {mostrarHora && (
                          <div className="font-semibold text-gray-700">
                            {slot.hora.toString().padStart(2, '0')}:00
                          </div>
                        )}
                      </td>
                      {diasSemana.map((dia, diaIdx) => {
                        const agendamentosDoDia = getAgendamentosPorDia(dia);
                        
                        // Encontrar agendamentos que começam neste slot
                        const agendamentosIniciando = agendamentosDoDia.filter((ag) => {
                          const dataAgendamento = new Date(ag.dataHora);
                          const horaInicio = dataAgendamento.getHours();
                          const minutoInicio = dataAgendamento.getMinutes();
                          return horaInicio === slot.hora && minutoInicio === slot.minuto;
                        });

                        // Verificar bloqueios para cada quadra neste slot
                        const bloqueiosNoSlot: { quadraId: string; bloqueio: BloqueioAgenda }[] = [];
                        quadras.forEach((quadra) => {
                          if (estaBloqueado(dia, slot.hora, slot.minuto, quadra.id)) {
                            const bloqueiosQuadra = getBloqueiosPorDiaEQuadra(dia, quadra.id);
                              bloqueiosQuadra.forEach((bloqueio) => {
                                // Verificar se o bloqueio cobre este horário específico
                                const minutosSlot = slot.hora * 60 + slot.minuto;
                                if (bloqueio.horaInicio === null || bloqueio.horaInicio === undefined || bloqueio.horaFim === null || bloqueio.horaFim === undefined) {
                                  // Dia inteiro bloqueado
                                  bloqueiosNoSlot.push({ quadraId: quadra.id, bloqueio });
                                } else if (minutosSlot >= bloqueio.horaInicio && minutosSlot < bloqueio.horaFim) {
                                  bloqueiosNoSlot.push({ quadraId: quadra.id, bloqueio });
                                }
                              });
                          }
                        });

                        // Calcular largura de cada agendamento quando há múltiplos
                        const quantidadeAgendamentos = agendamentosIniciando.length;
                        const totalItens = quantidadeAgendamentos + bloqueiosNoSlot.length;
                        const larguraPorItem = totalItens > 0 
                          ? `calc(${100 / totalItens}% - 4px)`
                          : '100%';

                        return (
                          <td
                            key={diaIdx}
                            className="px-1 py-0.5 align-top relative"
                            style={{ height: '30px' }}
                          >
                            <div className="absolute inset-1 flex gap-1">
                              {/* Renderizar bloqueios primeiro */}
                              {bloqueiosNoSlot.map((item, bloqueioIdx) => {
                                const bloqueio = item.bloqueio;
                                const quadra = quadras.find(q => q.id === item.quadraId);
                                
                                // Calcular altura do bloqueio
                                let linhasOcupadas = 1;
                                if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
                                  const duracaoMinutos = bloqueio.horaFim - bloqueio.horaInicio;
                                  linhasOcupadas = Math.max(1, Math.ceil(duracaoMinutos / 30));
                                } else {
                                  // Dia inteiro - ocupar até o fim do dia (23:00)
                                  const minutosRestantes = (23 * 60) - (slot.hora * 60 + slot.minuto);
                                  linhasOcupadas = Math.max(1, Math.ceil(minutosRestantes / 30));
                                }

                                // Formatar horário do bloqueio
                                let periodoTexto = '';
                                if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
                                  const horaInicio = Math.floor(bloqueio.horaInicio / 60);
                                  const minutoInicio = bloqueio.horaInicio % 60;
                                  const horaFim = Math.floor(bloqueio.horaFim / 60);
                                  const minutoFim = bloqueio.horaFim % 60;
                                  periodoTexto = `${horaInicio.toString().padStart(2, '0')}:${minutoInicio.toString().padStart(2, '0')} - ${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`;
                                } else {
                                  periodoTexto = 'Dia inteiro';
                                }

                                return (
                                  <div
                                    key={`bloqueio-${bloqueio.id}-${item.quadraId}-${bloqueioIdx}`}
                                    className="rounded-md shadow-sm overflow-visible relative bg-red-500 text-white border-2 border-red-600 opacity-80"
                                    style={{
                                      height: `${linhasOcupadas * 30 - 2}px`,
                                      width: larguraPorItem,
                                      zIndex: 5,
                                    }}
                                    title={`Bloqueio: ${bloqueio.titulo}${quadra ? ` - ${quadra.nome}` : ''}`}
                                  >
                                    <div className="p-1.5 h-full flex flex-col justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-start gap-1 mb-0.5">
                                          <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                          <div className="text-[10px] font-bold flex-1 truncate">
                                            {bloqueio.titulo}
                                          </div>
                                        </div>
                                        {quadra && (
                                          <div className="text-[10px] opacity-90 mb-0.5">
                                            {quadra.nome}
                                          </div>
                                        )}
                                        <div className="text-[10px] opacity-90">
                                          {periodoTexto}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {agendamentosIniciando.map((agendamento, agIdx) => {
                                const dataHora = new Date(agendamento.dataHora);
                                const horaInicio = dataHora.getHours();
                                const minutoInicio = dataHora.getMinutes();
                                const linhasOcupadas = calcularLinhasAgendamento(agendamento.duracao);
                                const info = getInfoAgendamento(agendamento);
                                const quadra = quadras.find(q => q.id === agendamento.quadraId);
                                const corQuadra = getCorQuadra(agendamento.quadraId);
                                
                                // Formatar duração
                                const horas = Math.floor(agendamento.duracao / 60);
                                const minutos = agendamento.duracao % 60;
                                let duracaoTexto = '';
                                if (horas > 0 && minutos > 0) {
                                  duracaoTexto = `${horas} hora${horas > 1 ? 's' : ''} e ${minutos} min.`;
                                } else if (horas > 0) {
                                  duracaoTexto = `${horas} hora${horas > 1 ? 's' : ''}`;
                                } else {
                                  duracaoTexto = `${minutos} min.`;
                                }

                                // Calcular horário de fim
                                const dataFim = new Date(dataHora.getTime() + agendamento.duracao * 60000);
                                const horaFim = dataFim.getHours();
                                const minutoFim = dataFim.getMinutes();
                                const periodoTexto = `${horaInicio.toString().padStart(2, '0')}:${minutoInicio.toString().padStart(2, '0')} - ${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`;

                                return (
                                  <div
                                    key={agendamento.id}
                                    ref={(el) => {
                                      if (el) {
                                        menuRefs.current[agendamento.id] = el;
                                      }
                                    }}
                                    className={`rounded-md shadow-sm cursor-pointer group overflow-visible relative ${
                                      agendamento.status === 'CONFIRMADO'
                                        ? `${corQuadra.bg} ${corQuadra.text} border-2 ${corQuadra.border}`
                                        : 'bg-yellow-400 text-gray-900 border-2 border-yellow-500'
                                    } hover:shadow-md transition-all`}
                                    style={{
                                      height: `${linhasOcupadas * 30 - 2}px`,
                                      width: larguraPorItem,
                                      zIndex: menuAberto === agendamento.id ? 20 : 10,
                                    }}
                                    onMouseEnter={(e) => {
                                      if (agendamento.observacoes) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const scrollY = window.scrollY || window.pageYOffset;
                                        const scrollX = window.scrollX || window.pageXOffset;
                                        
                                        // Posicionar acima do agendamento, centralizado
                                        let x = rect.left + rect.width / 2 + scrollX;
                                        let y = rect.top + scrollY - 10;
                                        
                                        // Ajustar se sair da tela à esquerda ou direita
                                        const tooltipWidth = 200; // largura aproximada do tooltip
                                        if (x - tooltipWidth / 2 < scrollX) {
                                          x = scrollX + tooltipWidth / 2 + 10;
                                        } else if (x + tooltipWidth / 2 > scrollX + window.innerWidth) {
                                          x = scrollX + window.innerWidth - tooltipWidth / 2 - 10;
                                        }
                                        
                                        setTooltipAgendamento(agendamento.observacoes);
                                        setTooltipPosicao({ x, y });
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      setTooltipAgendamento(null);
                                      setTooltipPosicao(null);
                                    }}
                                    onMouseMove={(e) => {
                                      if (agendamento.observacoes && tooltipAgendamento) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const scrollY = window.scrollY || window.pageYOffset;
                                        const scrollX = window.scrollX || window.pageXOffset;
                                        
                                        let x = rect.left + rect.width / 2 + scrollX;
                                        let y = rect.top + scrollY - 10;
                                        
                                        const tooltipWidth = 200;
                                        if (x - tooltipWidth / 2 < scrollX) {
                                          x = scrollX + tooltipWidth / 2 + 10;
                                        } else if (x + tooltipWidth / 2 > scrollX + window.innerWidth) {
                                          x = scrollX + window.innerWidth - tooltipWidth / 2 - 10;
                                        }
                                        
                                        setTooltipPosicao({ x, y });
                                      }
                                    }}
                                  >
                                    <div className="p-1.5 h-full flex flex-col justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-start justify-between gap-1 mb-0.5">
                                          <div className="text-[10px] font-bold opacity-90 flex-1">
                                            {quadra?.nome || 'Quadra'}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              if (menuAberto === agendamento.id) {
                                                setMenuAberto(null);
                                              } else {
                                                setMenuAberto(agendamento.id);
                                              }
                                            }}
                                            className="opacity-70 hover:opacity-100 transition-opacity z-10 relative"
                                          >
                                            <MoreVertical className="w-3 h-3" />
                                          </button>
                                        </div>
                                        <div className="text-xs font-bold truncate mb-0.5">
                                          {info.nome}
                                        </div>
                                        <div className="text-[10px] opacity-90 mb-0.5">
                                          {periodoTexto}
                                        </div>
                                        <div className="text-[10px] opacity-90">
                                          {duracaoTexto}
                                        </div>
                                      </div>
                                      {agendamento.status === 'CONFIRMADO' && (
                                        <div className="text-[9px] font-semibold opacity-75 mt-1">
                                          Confirmado
                                        </div>
                                      )}
                                    </div>

                                    {/* Menu de ações */}
                                    {menuAberto === agendamento.id && (
                                      <div 
                                        className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[160px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleEditar(agendamento);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit className="w-4 h-4" />
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleCancelar(agendamento);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <X className="w-4 h-4" />
                                          Cancelar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border-l-4 border-blue-500 rounded"></div>
            <span className="text-gray-700">Agendamento confirmado</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">Atleta</span>
          </div>
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">Avulso</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">Próprio</span>
          </div>
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

      {/* Tooltip de Observações */}
      {tooltipAgendamento && tooltipPosicao && (
        <div
          className="fixed z-[100] bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-xl max-w-xs pointer-events-none"
          style={{
            left: `${tooltipPosicao.x}px`,
            top: `${tooltipPosicao.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold mb-1 text-xs">Observações:</div>
          <div className="text-xs whitespace-pre-wrap">{tooltipAgendamento}</div>
          {/* Seta do tooltip */}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1"
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgb(17, 24, 39)',
            }}
          />
        </div>
      )}
    </div>
  );
}

