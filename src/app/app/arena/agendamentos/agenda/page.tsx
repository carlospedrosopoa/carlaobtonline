// app/app/arena/agendamentos/agenda/page.tsx - Agenda semanal da arena
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import ConfirmarExclusaoRecorrenteModal from '@/components/ConfirmarExclusaoRecorrenteModal';
import LimparAgendaFuturaModal from '@/components/LimparAgendaFuturaModal';
import QuadrasDisponiveisPorHorarioModal from '@/components/QuadrasDisponiveisPorHorarioModal';
import type { Quadra, Agendamento, StatusAgendamento, BloqueioAgenda } from '@/types/agendamento';
import { Calendar, ChevronLeft, ChevronRight, Clock, Filter, X, Edit, User, Users, UserPlus, Plus, MoreVertical, Search, Lock, CalendarDays, Trash2, CheckCircle, MessageCircle, RotateCw, Smartphone, UserCog, GraduationCap } from 'lucide-react';
import { gzappyService } from '@/services/gzappyService';

export default function ArenaAgendaSemanalPage() {
  const { usuario, isAdmin, isOrganizer } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [apenasReservados, setApenasReservados] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [dataInicialModal, setDataInicialModal] = useState<string | undefined>(undefined);
  const [horaInicialModal, setHoraInicialModal] = useState<string | undefined>(undefined);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [agendamentoExcluindo, setAgendamentoExcluindo] = useState<Agendamento | null>(null);
  const [modalLimparFuturaAberto, setModalLimparFuturaAberto] = useState(false);
  const [dataLimiteLimpeza, setDataLimiteLimpeza] = useState<Date>(new Date());
  const [carregandoLimpeza, setCarregandoLimpeza] = useState(false);
  const [erroLimpeza, setErroLimpeza] = useState('');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [modalQuadrasDisponiveisAberto, setModalQuadrasDisponiveisAberto] = useState(false);
  const [tooltipAgendamento, setTooltipAgendamento] = useState<string | null>(null);
  const [tooltipPosicao, setTooltipPosicao] = useState<{ x: number; y: number } | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Inicializar sempre com a data atual como primeiro dia
  const [inicioSemana, setInicioSemana] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
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

  // Gerar array de horários (6h às 23h) com intervalos de 30 minutos
  const horarios = useMemo(() => {
    const slots = [];
    for (let h = 6; h <= 23; h++) {
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
      const ano = inicioSemana.getFullYear();
      const mes = inicioSemana.getMonth();
      const dia = inicioSemana.getDate();
      
      // Criar data início: meia-noite do dia local em UTC (mesma lógica da criação)
      const dataInicio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
      
      // Criar data fim: 4 dias depois, 23:59:59 do dia local em UTC
      // Usar setUTCDate para lidar corretamente com mudanças de mês
      const dataFimTemp = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));
      dataFimTemp.setUTCDate(dataFimTemp.getUTCDate() + 4);

      // Converter para ISO string UTC
      const dataInicioISO = dataInicio.toISOString();
      const dataFimISO = dataFimTemp.toISOString();
      
      const filtros: any = {
        dataInicio: dataInicioISO,
        dataFim: dataFimISO,
        status: 'CONFIRMADO', // Apenas agendamentos confirmados
      };

      // Debug: log das datas sendo enviadas
      console.log('🔍 Carregando agendamentos:', {
        inicioSemana: inicioSemana.toISOString(),
        dataInicio: dataInicioISO,
        dataFim: dataFimISO,
        filtros
      });

      // Carregar agendamentos e bloqueios em paralelo
      const [agendamentosData, bloqueiosData] = await Promise.all([
        agendamentoService.listar(filtros),
        bloqueioAgendaService.listar({
          dataInicio: dataInicioISO,
          dataFim: dataFimISO,
          apenasAtivos: true,
        }),
      ]);

      console.log('✅ Agendamentos recebidos:', agendamentosData.length, agendamentosData);

      setAgendamentos(agendamentosData);
      setBloqueios(bloqueiosData);
    } catch (error) {
      console.error('❌ Erro ao carregar agendamentos:', error);
    }
  };

  const getAgendamentosPorDia = (dia: Date) => {
    // Retorna todos os agendamentos do dia especificado
    // Comparar usando strings de data (YYYY-MM-DD) para evitar problemas de timezone
    const formatarDataParaComparacao = (date: Date) => {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
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
        // Buscar no nome do professor (se for aula)
        if (ag.ehAula && ag.professor?.usuario?.name && ag.professor.usuario.name.toLowerCase().includes(termoBusca)) {
          return true;
        }
        // Buscar na especialidade do professor
        if (ag.ehAula && ag.professor?.especialidade && ag.professor.especialidade.toLowerCase().includes(termoBusca)) {
          return true;
        }
        // Buscar no email do professor
        if (ag.ehAula && ag.professor?.usuario?.email && ag.professor.usuario.email.toLowerCase().includes(termoBusca)) {
          return true;
        }
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
    // Comparar usando strings de data e hora diretamente da string ISO (timezone-agnostic)
    const formatarDataParaComparacao = (date: Date) => {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };
    
    const diaComparacaoStr = formatarDataParaComparacao(dia);
    
    let agendamentosFiltrados = agendamentos.filter((ag) => {
      const dataAgendamento = new Date(ag.dataHora);
      const diaAgendamentoStr = formatarDataParaComparacao(dataAgendamento);
      
      // Comparar dia primeiro
      if (diaAgendamentoStr !== diaComparacaoStr) {
        return false;
      }
      
      // Extrair hora/minuto diretamente da string ISO sem conversão de timezone
      // Isso evita problemas de timezone ao comparar horários
      const match = ag.dataHora.match(/T(\d{2}):(\d{2})/);
      if (!match) return false;
      
      const horaAgendamento = parseInt(match[1], 10);
      const minutoAgendamento = parseInt(match[2], 10);
      
      // Mostrar apenas na linha do horário de início exato
      return horaAgendamento === hora && minutoAgendamento === minuto;
    });

    // Aplicar filtro por nome ou telefone
    if (filtroNome.trim()) {
      const termoBusca = filtroNome.toLowerCase().trim();
      const termoBuscaNumerico = termoBusca.replace(/\D/g, '');
      
      agendamentosFiltrados = agendamentosFiltrados.filter((ag) => {
        // Buscar no nome do professor (se for aula)
        if (ag.ehAula && ag.professor?.usuario?.name && ag.professor.usuario.name.toLowerCase().includes(termoBusca)) {
          return true;
        }
        // Buscar na especialidade do professor
        if (ag.ehAula && ag.professor?.especialidade && ag.professor.especialidade.toLowerCase().includes(termoBusca)) {
          return true;
        }
        // Buscar no email do professor
        if (ag.ehAula && ag.professor?.usuario?.email && ag.professor.usuario.email.toLowerCase().includes(termoBusca)) {
          return true;
        }
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
          // Extrair hora/minuto diretamente da string UTC sem conversão de timezone
          const match = ag.dataHora.match(/T(\d{2}):(\d{2})/);
          const horaInicio = match ? parseInt(match[1], 10) : 0;
          const minutoInicio = match ? parseInt(match[2], 10) : 0;
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
    // Ir para a data de hoje, não para a segunda-feira
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    setInicioSemana(hoje);
  };

  const irParaData = (data: Date) => {
    // Define a data informada como o primeiro dia da navegação
    const dataAjustada = new Date(data);
    dataAjustada.setHours(0, 0, 0, 0);
    setInicioSemana(dataAjustada);
  };

  const handleDataSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dataSelecionada = e.target.value;
    if (dataSelecionada) {
      const data = new Date(dataSelecionada + 'T00:00:00');
      irParaData(data);
    }
  };

  const handleEditar = (agendamento: Agendamento) => {
    setMenuAberto(null);
    setAgendamentoEditando(agendamento);
    setDataInicialModal(undefined);
    setHoraInicialModal(undefined);
    setModalEditarAberto(true);
  };

  const handleClicarCelulaVazia = (dia: Date, slot: { hora: number; minuto: number }) => {
    // Formatar data (YYYY-MM-DD)
    const ano = dia.getFullYear();
    const mes = String(dia.getMonth() + 1).padStart(2, '0');
    const diaNum = String(dia.getDate()).padStart(2, '0');
    const dataFormatada = `${ano}-${mes}-${diaNum}`;
    
    // Formatar hora (HH:mm)
    const horaFormatada = `${slot.hora.toString().padStart(2, '0')}:${slot.minuto.toString().padStart(2, '0')}`;
    
    // Abrir modal de criação com data e hora pré-preenchidas
    setAgendamentoEditando(null);
    setDataInicialModal(dataFormatada);
    setHoraInicialModal(horaFormatada);
    setModalEditarAberto(true);
  };

  const handleCancelar = (agendamento: Agendamento) => {
    setMenuAberto(null);
    setAgendamentoCancelando(agendamento);
    setModalCancelarAberto(true);
  };

  const abrirModalLimparFutura = () => {
    // Usar a data atual como padrão
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    setDataLimiteLimpeza(hoje);
    setErroLimpeza('');
    setModalLimparFuturaAberto(true);
  };

  const handleLimparFutura = async (dataLimite: Date, senha: string) => {
    setCarregandoLimpeza(true);
    setErroLimpeza('');

    try {
      // Converter data limite para UTC ISO string
      const ano = dataLimite.getFullYear();
      const mes = dataLimite.getMonth();
      const dia = dataLimite.getDate();
      const dataLimiteUTC = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
      
      // Identificar pointId da arena atual
      // Se for ORGANIZER, usar o pointIdGestor
      // Se for ADMIN, usar o pointId da primeira quadra carregada (ou undefined para todas)
      let pointIdFiltro: string | undefined = undefined;
      if (usuario?.role === 'ORGANIZER' && usuario?.pointIdGestor) {
        pointIdFiltro = usuario.pointIdGestor;
      } else if (usuario?.role === 'ADMIN' && quadras.length > 0) {
        // Para ADMIN, usar o pointId da primeira quadra visualizada
        // Isso garante que deleta apenas da arena que está sendo visualizada
        pointIdFiltro = quadras[0].pointId;
      }
      
      const resultado = await agendamentoService.limparFuturos(
        dataLimiteUTC.toISOString(),
        senha,
        pointIdFiltro
      );

      alert(`✅ ${resultado.mensagem}`);
      setModalLimparFuturaAberto(false);
      // Recarregar agendamentos
      carregarAgendamentos();
    } catch (error: any) {
      const mensagemErro = error?.response?.data?.mensagem || error?.message || 'Erro ao limpar agenda futura';
      setErroLimpeza(mensagemErro);
    } finally {
      setCarregandoLimpeza(false);
    }
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
    setMenuAberto(null);
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

  const obterTelefoneCliente = (agendamento: Agendamento): string | null => {
    // Prioridade: telefoneAvulso > telefone do atleta > whatsapp do usuário
    if (agendamento.telefoneAvulso) {
      return agendamento.telefoneAvulso;
    }
    if (agendamento.atleta?.fone) {
      return agendamento.atleta.fone;
    }
    if (agendamento.usuario?.email) {
      // Se não tiver telefone, não podemos enviar
      return null;
    }
    return null;
  };

  const formatarMensagemConfirmacao = (agendamento: Agendamento): string => {
    const nomeArena = agendamento.quadra?.point?.nome || 'Arena';
    const nomeCliente = agendamento.atleta?.nome || agendamento.nomeAvulso || agendamento.usuario?.name || 'Cliente';
    const nomeQuadra = agendamento.quadra?.nome || 'Quadra';
    
    // Extrair data e hora diretamente da string ISO, igual a agenda faz
    // A data é salva como UTC mas representa o horário local escolhido pelo usuário
    // Usar regex para extrair diretamente sem conversão de timezone
    let dataFormatada: string;
    let horaFormatada: string;
    
    const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!matchDataHora) {
      // Fallback se o formato não for o esperado
      const dataHora = new Date(agendamento.dataHora);
      const ano = dataHora.getFullYear();
      const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
      const dia = String(dataHora.getDate()).padStart(2, '0');
      const hora = String(dataHora.getHours()).padStart(2, '0');
      const minuto = String(dataHora.getMinutes()).padStart(2, '0');
      dataFormatada = `${dia}/${mes}/${ano}`;
      horaFormatada = `${hora}:${minuto}`;
    } else {
      // Extrair diretamente da string ISO (mesmo método usado na agenda)
      const [, ano, mes, dia, hora, minuto] = matchDataHora;
      dataFormatada = `${dia}/${mes}/${ano}`;
      horaFormatada = `${hora}:${minuto}`;
    }

    const horas = Math.floor(agendamento.duracao / 60);
    const minutos = agendamento.duracao % 60;
    const duracaoTexto = horas > 0 
      ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
      : `${minutos}min`;

    let mensagem = `*${nomeArena}*\n\n`;
    mensagem += `✅ *Agendamento Confirmado*\n\n`;
    mensagem += `👤 *Cliente:* ${nomeCliente}\n`;
    mensagem += `🏸 *Quadra:* ${nomeQuadra}\n`;
    mensagem += `📅 *Data:* ${dataFormatada}\n`;
    mensagem += `🕐 *Horário:* ${horaFormatada}\n`;
    mensagem += `⏱️ *Duração:* ${duracaoTexto}\n`;

    if (agendamento.valorCalculado || agendamento.valorNegociado) {
      const valor = agendamento.valorNegociado || agendamento.valorCalculado || 0;
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);
      mensagem += `💰 *Valor:* ${valorFormatado}\n`;
    }

    if (agendamento.observacoes) {
      mensagem += `\n📝 *Observações:*\n${agendamento.observacoes}\n`;
    }

    mensagem += `\nEsperamos você! 🎾`;

    return mensagem;
  };

  const handleEnviarConfirmacao = async (agendamento: Agendamento) => {
    setMenuAberto(null);

    const telefone = obterTelefoneCliente(agendamento);
    if (!telefone) {
      alert('Telefone do cliente não encontrado. Não é possível enviar a confirmação.');
      return;
    }

    const pointId = usuario?.pointIdGestor || agendamento.quadra?.point?.id;
    if (!pointId) {
      alert('Erro: Arena não identificada.');
      return;
    }

    try {
      const mensagem = formatarMensagemConfirmacao(agendamento);
      
      await gzappyService.enviar({
        destinatario: telefone,
        mensagem: mensagem,
        tipo: 'texto',
        pointId: pointId,
      });

      alert('✅ Mensagem de confirmação enviada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao enviar confirmação:', error);
      const mensagemErro = error?.response?.data?.mensagem || error?.message || 'Erro ao enviar mensagem de confirmação';
      alert(`Erro ao enviar confirmação: ${mensagemErro}`);
    }
  };

  const getTipoBadge = (agendamento: Agendamento) => {
    // Verificar se é aula - tratar diferentes formatos que podem vir do backend
    // Verifica ehAula explícito OU se tem professorId (que indica aula)
    const ehAula = agendamento.ehAula;
    const ehAulaValue = ehAula === true || 
                       (typeof ehAula === 'string' && ehAula === 'true') || 
                       (typeof ehAula === 'number' && ehAula === 1) ||
                       (agendamento.professorId !== null && agendamento.professorId !== undefined);
    
    // Se for aula, mostrar badge especial (prioridade máxima)
    if (ehAulaValue) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-100 text-green-700">
          <GraduationCap className="w-2.5 h-2.5" />
          Aula
          {agendamento.professor?.usuario?.name && (
            <span className="text-green-600 truncate max-w-[60px]">({agendamento.professor.usuario.name})</span>
          )}
        </span>
      );
    }
    
    if (agendamento.atletaId && agendamento.atleta) {
      const criadoPeloAtleta = foiCriadoPeloAtleta(agendamento);
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-700">
          <Users className="w-2.5 h-2.5" />
          Atleta
          {criadoPeloAtleta ? (
            <span title="Criado pelo atleta">
              <Smartphone className="w-2.5 h-2.5" />
            </span>
          ) : (
            <span title="Criado pelo organizer">
              <UserCog className="w-2.5 h-2.5" />
            </span>
          )}
        </span>
      );
    }
    if (agendamento.nomeAvulso) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-700">
          <UserPlus className="w-2.5 h-2.5" />
          Avulso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-700">
        <User className="w-2.5 h-2.5" />
        Próprio
      </span>
    );
  };

  const getInfoAgendamento = (agendamento: Agendamento) => {
    // Se for aula/professor, mostrar informações do professor primeiro
    if (agendamento.ehAula && agendamento.professor) {
      return {
        nome: agendamento.professor.usuario?.name || agendamento.professor.especialidade || 'Professor',
        tipo: 'Professor/Aula',
        icon: GraduationCap,
      };
    }
    
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

  // Identifica se o agendamento foi criado pelo próprio atleta ou pelo organizer/admin
  const foiCriadoPeloAtleta = (agendamento: Agendamento): boolean => {
    // Se tem atleta vinculado e o usuarioId do agendamento é o mesmo do atleta, foi criado pelo atleta
    if (agendamento.atletaId && agendamento.atleta?.usuarioId && agendamento.usuarioId) {
      return agendamento.usuarioId === agendamento.atleta.usuarioId;
    }
    // Caso contrário, foi criado pelo organizer/admin
    return false;
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalQuadrasDisponiveisAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            <CheckCircle className="w-4 h-4" />
            Quadras Disponíveis
          </button>
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
              setDataInicialModal(undefined);
              setHoraInicialModal(undefined);
              setModalEditarAberto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
          <button
            onClick={() => {
              carregarAgendamentos();
              carregarDados();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            title="Atualizar agenda"
          >
            <RotateCw className="w-4 h-4" />
            Atualizar
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={() => navegarSemana('anterior')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1 text-center space-y-2">
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
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={irParaHoje}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ir para hoje
              </button>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={inicioSemana.toISOString().split('T')[0]}
                  onChange={handleDataSelecionada}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  title="Selecione uma data para iniciar a navegação"
                />
              </div>
              {/* Botão apenas para ADMIN e ORGANIZER - USER não tem acesso */}
              {usuario?.role !== 'USER' && (usuario?.role === 'ADMIN' || usuario?.role === 'ORGANIZER') && (
                <button
                  onClick={abrirModalLimparFutura}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  title="Limpar agenda futura"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Agenda Futura
                </button>
              )}
            </div>
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
                        
                        // Encontrar agendamentos que aparecem neste slot
                        const minutosSlot = slot.hora * 60 + slot.minuto;
                        const minutosSlotFim = minutosSlot + 30;
                        
                        // Agendamentos que começam neste slot (ou no slot mais próximo arredondando para baixo)
                        const agendamentosIniciando = agendamentosDoDia.filter((ag) => {
                          const match = ag.dataHora.match(/T(\d{2}):(\d{2})/);
                          const horaInicio = match ? parseInt(match[1], 10) : 0;
                          const minutoInicio = match ? parseInt(match[2], 10) : 0;
                          const minutosInicio = horaInicio * 60 + minutoInicio;
                          
                          // Se começa exatamente no slot, mostrar
                          if (horaInicio === slot.hora && minutoInicio === slot.minuto) {
                            return true;
                          }
                          
                          // Para horários intermediários, mostrar no slot mais próximo (arredondando para baixo)
                          const proximoSlot = minutosSlot + 30;
                          return minutosInicio >= minutosSlot && minutosInicio < proximoSlot;
                        });
                        
                        // Buscar TODOS os agendamentos que estão ativos neste slot (para detectar sobreposições)
                        const todosAgendamentosAtivosNoSlot = agendamentosDoDia.filter((ag) => {
                          const match = ag.dataHora.match(/T(\d{2}):(\d{2})/);
                          const horaInicio = match ? parseInt(match[1], 10) : 0;
                          const minutoInicio = match ? parseInt(match[2], 10) : 0;
                          const minutosInicio = horaInicio * 60 + minutoInicio;
                          const minutosFim = minutosInicio + ag.duracao;
                          
                          // Agendamento está ativo no slot se se sobrepõe ao slot
                          return minutosInicio < minutosSlotFim && minutosFim > minutosSlot;
                        });
                        
                        // Se há múltiplos agendamentos ativos (sobreposição), renderizar todos lado a lado
                        // Caso contrário, renderizar apenas os que começam neste slot
                        const agendamentosParaRenderizar = todosAgendamentosAtivosNoSlot.length > 1 
                          ? todosAgendamentosAtivosNoSlot // Múltiplos ativos = renderizar todos para aparecerem lado a lado
                          : agendamentosIniciando; // Apenas um ou nenhum = renderizar apenas os que começam aqui

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
                        const quantidadeAgendamentos = agendamentosParaRenderizar.length;
                        const totalItens = quantidadeAgendamentos + bloqueiosNoSlot.length;
                        // Calcular largura considerando o gap entre os itens (gap-1 = 4px)
                        const gapPx = 4; // gap-1 = 4px
                        const totalGaps = totalItens > 1 ? (totalItens - 1) * gapPx : 0;
                        const larguraPorItem = totalItens > 0 
                          ? `calc((100% - ${totalGaps}px) / ${totalItens})`
                          : '100%';

                        // Verificar se a célula está vazia (sem agendamentos nem bloqueios)
                        const celulaVazia = agendamentosParaRenderizar.length === 0 && bloqueiosNoSlot.length === 0;

                        return (
                          <td
                            key={diaIdx}
                            onClick={() => {
                              if (celulaVazia) {
                                handleClicarCelulaVazia(dia, slot);
                              }
                            }}
                            className={`px-1 py-0.5 align-top relative ${celulaVazia ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                            style={{ height: '60px' }}
                            title={celulaVazia ? `Criar agendamento para ${dia.toLocaleDateString('pt-BR')} às ${slot.hora.toString().padStart(2, '0')}:${slot.minuto.toString().padStart(2, '0')}` : ''}
                          >
                            <div className="absolute inset-1 flex flex-nowrap gap-1">
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
                                      height: `${linhasOcupadas * 60 - 2}px`,
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
                              {agendamentosParaRenderizar.map((agendamento, agIdx) => {
                                // Extrair hora/minuto diretamente da string UTC sem conversão de timezone
                                // Isso garante que 20h gravado = 20h exibido
                                const dataHoraStr = agendamento.dataHora;
                                const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
                                const horaInicio = match ? parseInt(match[1], 10) : 0;
                                const minutoInicio = match ? parseInt(match[2], 10) : 0;
                                const minutosInicio = horaInicio * 60 + minutoInicio;
                                const minutosFim = minutosInicio + agendamento.duracao;
                                const dataHora = new Date(agendamento.dataHora); // Para cálculos de data
                                
                                // Calcular altura baseado em quanto do agendamento está neste slot
                                // Se o agendamento começou antes deste slot, calcular apenas a parte que está neste slot
                                let linhasOcupadas: number;
                                if (minutosInicio < minutosSlot) {
                                  // Agendamento começou antes - calcular apenas a parte que está neste slot
                                  const minutosNoSlot = Math.min(minutosFim - minutosSlot, 30);
                                  linhasOcupadas = Math.max(1, Math.ceil(minutosNoSlot / 30));
                                } else {
                                  // Agendamento começa neste slot - usar duração completa
                                  linhasOcupadas = calcularLinhasAgendamento(agendamento.duracao);
                                }
                                
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

                                // Calcular horário de fim (usar UTC diretamente)
                                const minutosTotais = horaInicio * 60 + minutoInicio + agendamento.duracao;
                                const horaFim = Math.floor(minutosTotais / 60) % 24;
                                const minutoFim = minutosTotais % 60;
                                const periodoTexto = `${horaInicio.toString().padStart(2, '0')}:${minutoInicio.toString().padStart(2, '0')} - ${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`;

                                return (
                                  <div
                                    key={agendamento.id}
                                    ref={(el) => {
                                      if (el) {
                                        menuRefs.current[agendamento.id] = el;
                                      }
                                    }}
                                    onClick={() => {
                                      // Só permite editar se o status for CONFIRMADO e o menu não estiver aberto
                                      if (agendamento.status === 'CONFIRMADO' && menuAberto !== agendamento.id) {
                                        handleEditar(agendamento);
                                      }
                                    }}
                                    className={`rounded-md shadow-sm cursor-pointer group overflow-visible relative ${
                                      agendamento.status === 'CONFIRMADO'
                                        ? `${corQuadra.bg} ${corQuadra.text} border-2 ${corQuadra.border}`
                                        : 'bg-yellow-400 text-gray-900 border-2 border-yellow-500'
                                    } hover:shadow-md transition-all`}
                                    style={{
                                      height: `${linhasOcupadas * 60 - 2}px`,
                                      width: larguraPorItem,
                                      zIndex: menuAberto === agendamento.id ? 20 : 10,
                                    }}
                                    onMouseEnter={(e) => {
                                      if (agendamento.observacoes) {
                                        // Usar a posição do mouse diretamente
                                        let x = e.clientX;
                                        let y = e.clientY - 10; // 10px acima do cursor
                                        
                                        // Ajustar se sair da tela à esquerda ou direita
                                        const tooltipWidth = 200; // largura aproximada do tooltip
                                        if (x - tooltipWidth / 2 < 10) {
                                          x = tooltipWidth / 2 + 10;
                                        } else if (x + tooltipWidth / 2 > window.innerWidth - 10) {
                                          x = window.innerWidth - tooltipWidth / 2 - 10;
                                        }
                                        
                                        // Ajustar se sair da tela acima
                                        if (y < 10) {
                                          y = e.clientY + 20; // Mostrar abaixo do cursor se não couber acima
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
                                        // Usar a posição do mouse diretamente
                                        let x = e.clientX;
                                        let y = e.clientY - 10; // 10px acima do cursor
                                        
                                        const tooltipWidth = 200;
                                        if (x - tooltipWidth / 2 < 10) {
                                          x = tooltipWidth / 2 + 10;
                                        } else if (x + tooltipWidth / 2 > window.innerWidth - 10) {
                                          x = window.innerWidth - tooltipWidth / 2 - 10;
                                        }
                                        
                                        // Ajustar se sair da tela acima
                                        if (y < 10) {
                                          y = e.clientY + 20; // Mostrar abaixo do cursor se não couber acima
                                        }
                                        
                                        setTooltipPosicao({ x, y });
                                      }
                                    }}
                                  >
                                    <div className="p-1.5 h-full flex flex-col justify-between relative">
                                      {/* Badge na primeira linha */}
                                      <div className="mb-1">
                                        {getTipoBadge(agendamento)}
                                      </div>
                                      
                                      <div className="flex-1">
                                        <div className="flex items-start justify-between gap-1 mb-0.5">
                                          <div className="text-[10px] font-bold opacity-90 flex-1 flex items-center gap-1">
                                            {quadra?.nome || 'Quadra'}
                                            {/* Indicador visual: criado pelo atleta ou organizer */}
                                            {agendamento.atletaId && (
                                              foiCriadoPeloAtleta(agendamento) ? (
                                                <span title="Criado pelo atleta">
                                                  <Smartphone className="w-3 h-3" />
                                                </span>
                                              ) : (
                                                <span title="Criado pelo organizer">
                                                  <UserCog className="w-3 h-3" />
                                                </span>
                                              )
                                            )}
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
                                            title="Menu de ações"
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
                                        {agendamento.status === 'CONFIRMADO' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleEnviarConfirmacao(agendamento);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                          >
                                            <MessageCircle className="w-4 h-4" />
                                            Enviar Confirmação
                                          </button>
                                        )}
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
                                        {(isAdmin || isOrganizer) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleDeletar(agendamento);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-100 flex items-center gap-2 font-semibold border-t border-gray-200 mt-1 pt-2"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            Excluir Permanentemente
                                          </button>
                                        )}
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
            <GraduationCap className="w-4 h-4 text-green-600" />
            <span className="text-gray-700">Aula/Professor</span>
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
          setDataInicialModal(undefined);
          setHoraInicialModal(undefined);
        }}
        onSuccess={() => {
          carregarAgendamentos();
          // O componente agora mantém o modal aberto se a flag estiver marcada
          // Então só fechamos se não houver flag marcada (comportamento normal)
          // O componente gerencia isso internamente, não precisamos fazer nada aqui
        }}
        dataInicial={dataInicialModal}
        horaInicial={horaInicialModal}
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

      <LimparAgendaFuturaModal
        isOpen={modalLimparFuturaAberto}
        dataLimite={dataLimiteLimpeza}
        onClose={() => {
          setModalLimparFuturaAberto(false);
          setErroLimpeza('');
        }}
        onConfirmar={handleLimparFutura}
        carregando={carregandoLimpeza}
        erro={erroLimpeza}
      />

      {/* Modal de Horários Disponíveis por Data */}
      <QuadrasDisponiveisPorHorarioModal
        isOpen={modalQuadrasDisponiveisAberto}
        onClose={() => setModalQuadrasDisponiveisAberto(false)}
        dataInicial={dataInicialModal}
        duracaoInicial={60}
        onSelecionarHorario={(data, hora, duracao) => {
          setModalQuadrasDisponiveisAberto(false);
          setDataInicialModal(data);
          setHoraInicialModal(hora);
          setAgendamentoEditando(null);
          setModalEditarAberto(true);
        }}
        pointIdsPermitidos={
          isAdmin ? undefined : isOrganizer && usuario?.pointIdGestor ? [usuario.pointIdGestor] : []
        }
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

