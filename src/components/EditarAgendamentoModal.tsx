// components/EditarAgendamentoModal.tsx - Modal de edição de agendamento (100% igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useAuth } from '@/context/AuthContext';
import { pointService, quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Agendamento, ModoAgendamento } from '@/types/agendamento';
import { Calendar, Clock, MapPin, AlertCircle, User, Users, UserPlus, Repeat } from 'lucide-react';
import type { RecorrenciaConfig, TipoRecorrencia } from '@/types/agendamento';

interface Atleta {
  id: string;
  nome: string;
  fone?: string;
}

interface EditarAgendamentoModalProps {
  isOpen: boolean;
  agendamento: Agendamento | null;
  onClose: () => void;
  onSuccess: () => void;
  quadraIdInicial?: string; // Para pré-selecionar uma quadra ao criar novo agendamento
}

export default function EditarAgendamentoModal({
  isOpen,
  agendamento,
  onClose,
  onSuccess,
  quadraIdInicial,
}: EditarAgendamentoModalProps) {
  const { usuario } = useAuth();
  // No appatleta, apenas USER pode criar/editar seus próprios agendamentos
  const isAdmin = false;
  const isOrganizer = false;
  const canGerenciarAgendamento = false;

  const [points, setPoints] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<Agendamento[]>([]);
  const [bloqueiosExistentes, setBloqueiosExistentes] = useState<any[]>([]);
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Modo de agendamento (apenas para admin)
  const [modo, setModo] = useState<ModoAgendamento>('normal');

  // Campos comuns
  const [pointId, setPointId] = useState('');
  const [quadraId, setQuadraId] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState(60);
  const [observacoes, setObservacoes] = useState('');
  const [valorHora, setValorHora] = useState<number | null>(null);
  const [valorCalculado, setValorCalculado] = useState<number | null>(null);
  const [valorNegociado, setValorNegociado] = useState<string>('');

  // Campos específicos por modo
  const [atletaId, setAtletaId] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telefoneAvulso, setTelefoneAvulso] = useState('');
  const [buscaAtleta, setBuscaAtleta] = useState('');

  // Campos de recorrência
  const [temRecorrencia, setTemRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>(null);
  const [intervaloRecorrencia, setIntervaloRecorrencia] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState<number[]>([]);
  const [diaMesRecorrencia, setDiaMesRecorrencia] = useState<number>(1);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState('');
  const [quantidadeOcorrencias, setQuantidadeOcorrencias] = useState<number>(12);
  const [aplicarARecorrencia, setAplicarARecorrencia] = useState(false); // Para agendamentos recorrentes: aplicar apenas neste ou em todos os futuros
  const [agendamentoJaRecorrente, setAgendamentoJaRecorrente] = useState(false); // Indica se o agendamento já é recorrente

  useEffect(() => {
    if (isOpen) {
      carregarDados();
      if (agendamento) {
        preencherFormulario();
      } else {
        // Modo criação - resetar formulário
        resetarFormulario();
        // Se houver quadraIdInicial, pré-selecionar após carregar dados
        if (quadraIdInicial) {
          // Aguardar um pouco para os dados carregarem
          setTimeout(() => {
            selecionarQuadraInicial(quadraIdInicial);
          }, 100);
        }
      }
    }
  }, [isOpen, agendamento, quadraIdInicial]);

  useEffect(() => {
    if (pointId && !isOrganizer) {
      carregarQuadras(pointId);
    }
  }, [pointId]);

  useEffect(() => {
    if (quadraId && data) {
      verificarDisponibilidade();
    }
  }, [quadraId, data]);

  useEffect(() => {
    if (modo === 'normal') {
      setAtletaId('');
      setNomeAvulso('');
      setTelefoneAvulso('');
    } else if (modo === 'atleta') {
      setNomeAvulso('');
      setTelefoneAvulso('');
      setBuscaAtleta('');
    } else if (modo === 'avulso') {
      setAtletaId('');
    }
  }, [modo]);

  const atletasFiltrados = useMemo(() => {
    if (!buscaAtleta.trim()) return atletas;
    const termo = buscaAtleta.toLowerCase();
    return atletas.filter((a) => {
      const base = `${a.nome} ${a.fone || ''}`.toLowerCase();
      return base.includes(termo);
    });
  }, [atletas, buscaAtleta]);

  const carregarDados = async () => {
    try {
      const [pointsData, atletasData, quadrasData] = await Promise.all([
        // USER e ADMIN podem ver todos os points
        (isAdmin || usuario?.role === 'USER') ? pointService.listar() : Promise.resolve([]),
        canGerenciarAgendamento
          ? (async () => {
              try {
                // Para ORGANIZER e ADMIN, não precisa passar parâmetros - a API já retorna todos os atletas
                const res = await api.get(`/atleta/listarAtletas`);
                const data = Array.isArray(res.data) ? res.data : res.data?.atletas || [];
                return data;
              } catch (error) {
                console.error('Erro ao carregar atletas:', error);
                return [];
              }
            })()
          : Promise.resolve([] as Atleta[]),
        isOrganizer ? quadraService.listar() : Promise.resolve([]),
      ]);

      setPoints(pointsData.filter((p: any) => p.ativo));
      if (canGerenciarAgendamento) {
        setCarregandoAtletas(true);
        setAtletas(atletasData as Atleta[]);
        setCarregandoAtletas(false);
      }
      // Se for ORGANIZER, carregar quadras diretamente
      if (isOrganizer && quadrasData.length > 0) {
        setQuadras((quadrasData as any[]).filter((q: any) => q.ativo));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const resetarFormulario = () => {
    setPointId('');
    setQuadraId('');
    setData('');
    setHora('');
    setDuracao(60);
    setObservacoes('');
    setValorHora(null);
    setValorCalculado(null);
    setValorNegociado('');
    setAtletaId('');
    setNomeAvulso('');
    setTelefoneAvulso('');
    setBuscaAtleta('');
    setModo('normal');
    setAgendamentosExistentes([]);
    setErro('');
  };

  const selecionarQuadraInicial = async (quadraIdParaSelecionar: string) => {
    try {
      // Buscar a quadra para obter o pointId
      const quadra = await quadraService.obter(quadraIdParaSelecionar);
      if (quadra) {
        setPointId(quadra.pointId);
        // Carregar quadras do point e então selecionar
        if (!isOrganizer) {
          await carregarQuadras(quadra.pointId);
        }
        // Aguardar um pouco para garantir que as quadras foram carregadas
        setTimeout(() => {
          setQuadraId(quadraIdParaSelecionar);
        }, 300);
      }
    } catch (error) {
      console.error('Erro ao buscar quadra inicial:', error);
    }
  };

  const preencherFormulario = () => {
    if (!agendamento) return;

    // Preenche dados básicos
    // Extrair data/hora diretamente da string UTC sem conversão de timezone
    // Isso garante que 20h gravado = 20h exibido no formulário
    const dataHoraStr = agendamento.dataHora;
    setData(dataHoraStr.split('T')[0]);
    const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
    setHora(match ? `${match[1]}:${match[2]}` : '00:00');
    setDuracao(agendamento.duracao);
    setObservacoes(agendamento.observacoes || '');
    setValorHora(agendamento.valorHora ?? null);
    setValorCalculado(agendamento.valorCalculado ?? null);
    setValorNegociado(
      agendamento.valorNegociado != null
        ? agendamento.valorNegociado.toString().replace('.', ',')
        : ''
    );

    // Preenche quadra e point
    setQuadraId(agendamento.quadraId);
    setPointId(agendamento.quadra.point.id);

    // Determina o modo baseado no agendamento
    if (agendamento.atletaId && agendamento.atleta) {
      setModo('atleta');
      setAtletaId(agendamento.atletaId);
    } else if (agendamento.nomeAvulso) {
      setModo('avulso');
      setNomeAvulso(agendamento.nomeAvulso);
      setTelefoneAvulso(agendamento.telefoneAvulso || '');
    } else {
      setModo('normal');
    }

    // Preenche campos de recorrência se o agendamento já for recorrente
    const temRecorrenciaAtual = !!agendamento.recorrenciaId || !!agendamento.recorrenciaConfig;
    setAgendamentoJaRecorrente(temRecorrenciaAtual);
    
    if (temRecorrenciaAtual && agendamento.recorrenciaConfig) {
      const config = agendamento.recorrenciaConfig;
      setTemRecorrencia(true);
      setTipoRecorrencia(config.tipo || null);
      setIntervaloRecorrencia(config.intervalo || 1);
      setDiasSemanaRecorrencia(config.diasSemana || []);
      setDiaMesRecorrencia(config.diaMes || 1);
      if (config.dataFim) {
        const dataFim = new Date(config.dataFim);
        setDataFimRecorrencia(dataFim.toISOString().split('T')[0]);
      } else {
        setDataFimRecorrencia('');
      }
      setQuantidadeOcorrencias(config.quantidadeOcorrencias || 12);
    } else {
      // Resetar campos de recorrência se não for recorrente
      setTemRecorrencia(false);
      setTipoRecorrencia(null);
      setIntervaloRecorrencia(1);
      setDiasSemanaRecorrencia([]);
      setDiaMesRecorrencia(1);
      setDataFimRecorrencia('');
      setQuantidadeOcorrencias(12);
    }
    
    // Resetar opção de aplicar recorrência
    setAplicarARecorrencia(false);
  };

  const carregarQuadras = async (pointId: string) => {
    try {
      const data = await quadraService.listar(pointId);
      setQuadras(data.filter((q: any) => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar quadras:', error);
    }
  };

  const verificarDisponibilidade = async () => {
    if (!quadraId || !data) return;

    try {
      const dataInicio = `${data}T00:00:00`;
      const dataFim = `${data}T23:59:59`;

      // Carregar agendamentos e bloqueios em paralelo
      const [agendamentos, bloqueios] = await Promise.all([
        agendamentoService.listar({
          quadraId,
          dataInicio,
          dataFim,
          status: 'CONFIRMADO',
        }),
        bloqueioAgendaService.listar({
          dataInicio,
          dataFim,
          apenasAtivos: true,
        }),
      ]);

      // Remove o agendamento atual da lista (para não considerar conflito com ele mesmo)
      if (agendamento) {
        setAgendamentosExistentes(
          agendamentos.filter((ag) => ag.id !== agendamento.id)
        );
      } else {
        setAgendamentosExistentes(agendamentos);
      }

      // Filtrar bloqueios que afetam esta quadra
      // Buscar a quadra novamente caso não esteja na lista ainda
      let quadra = quadras.find((q: any) => q.id === quadraId);
      if (!quadra && quadraId) {
        // Tentar buscar a quadra diretamente
        try {
          const quadraData = await quadraService.obter(quadraId);
          quadra = quadraData as any;
        } catch (error) {
          console.error('Erro ao buscar quadra:', error);
        }
      }

      if (quadra) {
        const bloqueiosAfetandoQuadra = bloqueios.filter((bloqueio: any) => {
          // Verificar se o bloqueio afeta esta quadra
          if (bloqueio.quadraIds === null) {
            // Bloqueio geral - verificar se a quadra pertence ao mesmo point
            return quadra.pointId === bloqueio.pointId;
          } else {
            // Bloqueio específico - verificar se a quadra está na lista
            return bloqueio.quadraIds.includes(quadraId);
          }
        });
        setBloqueiosExistentes(bloqueiosAfetandoQuadra);
      } else {
        setBloqueiosExistentes([]);
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
    }
  };

  const verificarConflito = (): string | null => {
    if (!data || !hora || !duracao || !quadraId) return null;

    const agora = new Date();
    const dataHoraSelecionada = new Date(`${data}T${hora}:00`);

    // Não permitir agendamento no passado
    if (dataHoraSelecionada < agora) {
      return 'Não é possível agendar no passado';
    }

    // Verificar conflitos com bloqueios
    const horaInicio = dataHoraSelecionada.getTime();
    const horaFim = horaInicio + duracao * 60000;
    const minutosInicio = dataHoraSelecionada.getHours() * 60 + dataHoraSelecionada.getMinutes();
    const minutosFim = minutosInicio + duracao;

    for (const bloqueio of bloqueiosExistentes) {
      const dataInicioBloqueio = new Date(bloqueio.dataInicio);
      const dataFimBloqueio = new Date(bloqueio.dataFim);
      
      // Verificar se o dia está dentro do período do bloqueio
      const anoDia = dataHoraSelecionada.getFullYear();
      const mesDia = dataHoraSelecionada.getMonth();
      const diaDia = dataHoraSelecionada.getDate();
      
      const anoInicio = dataInicioBloqueio.getFullYear();
      const mesInicio = dataInicioBloqueio.getMonth();
      const diaInicio = dataInicioBloqueio.getDate();
      
      const anoFim = dataFimBloqueio.getFullYear();
      const mesFim = dataFimBloqueio.getMonth();
      const diaFim = dataFimBloqueio.getDate();
      
      const diaEstaNoPeriodo = 
        (anoDia > anoInicio || (anoDia === anoInicio && mesDia > mesInicio) || (anoDia === anoInicio && mesDia === mesInicio && diaDia >= diaInicio)) &&
        (anoDia < anoFim || (anoDia === anoFim && mesDia < mesFim) || (anoDia === anoFim && mesDia === mesFim && diaDia <= diaFim));

      if (!diaEstaNoPeriodo) continue;

      // Verificar horário
      if (bloqueio.horaInicio === null || bloqueio.horaFim === null) {
        // Dia inteiro bloqueado
        return `Conflito com bloqueio: "${bloqueio.titulo}" (dia inteiro bloqueado)`;
      }

      // Verificar se há sobreposição de horários
      const bloqueioInicio = bloqueio.horaInicio;
      const bloqueioFim = bloqueio.horaFim;

      if (
        (minutosInicio >= bloqueioInicio && minutosInicio < bloqueioFim) ||
        (minutosFim > bloqueioInicio && minutosFim <= bloqueioFim) ||
        (minutosInicio <= bloqueioInicio && minutosFim >= bloqueioFim)
      ) {
        const horaInicioBloqueio = Math.floor(bloqueioInicio / 60);
        const minutoInicioBloqueio = bloqueioInicio % 60;
        const horaFimBloqueio = Math.floor(bloqueioFim / 60);
        const minutoFimBloqueio = bloqueioFim % 60;
        
        return `Conflito com bloqueio: "${bloqueio.titulo}" (${horaInicioBloqueio.toString().padStart(2, '0')}:${minutoInicioBloqueio.toString().padStart(2, '0')} às ${horaFimBloqueio.toString().padStart(2, '0')}:${minutoFimBloqueio.toString().padStart(2, '0')})`;
      }
    }

    // Verificar conflitos com agendamentos existentes
    for (const ag of agendamentosExistentes) {
      const agInicio = new Date(ag.dataHora).getTime();
      const agFim = agInicio + ag.duracao * 60000;

      if (
        (horaInicio >= agInicio && horaInicio < agFim) ||
        (horaFim > agInicio && horaFim <= agFim) ||
        (horaInicio <= agInicio && horaFim >= agFim)
      ) {
        const inicio = new Date(agInicio).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const fim = new Date(agFim).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `Conflito com agendamento existente das ${inicio} às ${fim}`;
      }
    }

    return null;
  };

  const validarFormulario = (): string | null => {
    if (!quadraId || !data || !hora) {
      return 'Preencha todos os campos obrigatórios';
    }

    // Para ADMIN, pointId é obrigatório
    if (isAdmin && !pointId) {
      return 'Selecione um estabelecimento';
    }

    if (modo === 'atleta' && !atletaId) {
      return 'Selecione um atleta';
    }

    if (modo === 'avulso') {
      if (!nomeAvulso.trim()) {
        return 'Informe o nome para agendamento avulso';
      }
      if (!telefoneAvulso.trim()) {
        return 'Informe o telefone para agendamento avulso';
      }
      const telefoneLimpo = telefoneAvulso.replace(/\D/g, '');
      if (telefoneLimpo.length < 10) {
        return 'Telefone inválido';
      }
    }

    // Validação de recorrência (criação e edição)
    if (temRecorrencia) {
      if (!tipoRecorrencia) {
        return 'Selecione o tipo de recorrência';
      }
      if (tipoRecorrencia === 'SEMANAL' && diasSemanaRecorrencia.length === 0) {
        return 'Selecione pelo menos um dia da semana para recorrência semanal';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErro('');

    const erroValidacao = validarFormulario();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    const conflito = verificarConflito();
    if (conflito) {
      setErro(conflito);
      return;
    }

    setSalvando(true);

    try {
      // Enviar o horário escolhido pelo usuário sem conversão de timezone
      // O backend vai salvar exatamente como informado (tratando como UTC direto)
      // Isso garante que 20h escolhido = 20h gravado no banco
      const dataHora = `${data}T${hora}:00`;
      const payload: any = {
        quadraId,
        dataHora,
        duracao,
        observacoes: observacoes || undefined,
      };

      // Se for admin/organizador e mudou o modo, atualiza os campos específicos
      if (canGerenciarAgendamento) {
        if (modo === 'atleta' && atletaId) {
          payload.atletaId = atletaId;
          // Remove campos de avulso se existirem
          payload.nomeAvulso = null;
          payload.telefoneAvulso = null;
        } else if (modo === 'avulso') {
          payload.nomeAvulso = nomeAvulso.trim();
          payload.telefoneAvulso = telefoneAvulso.trim();
          // Remove atletaId se existir
          payload.atletaId = null;
        } else {
          // Modo normal - remove campos específicos
          payload.atletaId = null;
          payload.nomeAvulso = null;
          payload.telefoneAvulso = null;
        }
      }

      // Valor negociado (ADMIN e ORGANIZER podem informar)
      if (canGerenciarAgendamento && valorNegociado.trim()) {
        const valor = parseFloat(valorNegociado.replace(',', '.'));
        if (!isNaN(valor) && valor > 0) {
          payload.valorNegociado = valor;
        }
      }

      // Configuração de recorrência (criação e edição)
      if (temRecorrencia && tipoRecorrencia) {
        const recorrenciaConfig: RecorrenciaConfig = {
          tipo: tipoRecorrencia,
          intervalo: intervaloRecorrencia,
        };

        if (tipoRecorrencia === 'SEMANAL' && diasSemanaRecorrencia.length > 0) {
          recorrenciaConfig.diasSemana = diasSemanaRecorrencia;
        }

        if (tipoRecorrencia === 'MENSAL' && diaMesRecorrencia) {
          recorrenciaConfig.diaMes = diaMesRecorrencia;
        }

        if (dataFimRecorrencia) {
          recorrenciaConfig.dataFim = `${dataFimRecorrencia}T23:59:59`;
        } else if (quantidadeOcorrencias) {
          recorrenciaConfig.quantidadeOcorrencias = quantidadeOcorrencias;
        }

        payload.recorrencia = recorrenciaConfig;
      } else if (agendamento?.recorrenciaId) {
        // Se era recorrente e desmarcou, enviar null para limpar
        payload.recorrencia = null;
      }

      let resultado;
      if (agendamento) {
        // Modo edição
        // Se o agendamento já é recorrente, adicionar opção de aplicar apenas neste ou em todos os futuros
        if (agendamentoJaRecorrente) {
          payload.aplicarARecorrencia = aplicarARecorrencia;
        }
        resultado = await agendamentoService.atualizar(agendamento.id, payload);
      } else {
        // Modo criação
        resultado = await agendamentoService.criar(payload);
      }

      // Atualiza os valores exibidos com o retorno do backend (recalculado)
      setValorHora(resultado.valorHora ?? null);
      setValorCalculado(resultado.valorCalculado ?? null);
      setValorNegociado(
        resultado.valorNegociado != null
          ? resultado.valorNegociado.toString().replace('.', ',')
          : ''
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(`Erro ao ${agendamento ? 'atualizar' : 'criar'} agendamento:`, error);
      setErro(
        error?.response?.data?.mensagem ||
          error?.data?.mensagem ||
          `Erro ao ${agendamento ? 'atualizar' : 'criar'} agendamento. Tente novamente.`
      );
    } finally {
      setSalvando(false);
    }
  };

  const getHorariosOcupados = (): string[] => {
    if (!data) return [];

    return agendamentosExistentes.map((ag) => {
      const agData = new Date(ag.dataHora);
      return agData.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });
  };

  const horariosOcupados = getHorariosOcupados();
  const conflito = verificarConflito();

  const formatCurrency = (v: number | null) =>
    v == null
      ? '—'
      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-gray-900 mb-2">
            {agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
          </Dialog.Title>
          <p className="text-sm text-gray-600 mb-6">
            {agendamento
              ? 'Atualize as informações do agendamento'
              : 'Preencha os dados para criar um novo agendamento'}
          </p>

          {/* Seletor de Modo (apenas para admin/organizador) */}
          {canGerenciarAgendamento && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Agendamento
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setModo('normal')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    modo === 'normal'
                      ? 'border-blue-600 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Para mim</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModo('atleta')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    modo === 'atleta'
                      ? 'border-blue-600 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Para atleta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModo('avulso')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    modo === 'avulso'
                      ? 'border-blue-600 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="font-medium">Avulso</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de Atleta (modo atleta) */}
            {canGerenciarAgendamento && modo === 'atleta' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="inline w-4 h-4 mr-1" />
                  Selecionar Atleta *
                </label>
                {carregandoAtletas ? (
                  <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-center text-gray-600">
                    Carregando atletas...
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={buscaAtleta}
                      onChange={(e) => setBuscaAtleta(e.target.value)}
                      placeholder="Buscar por nome ou telefone..."
                      className="mb-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                    <select
                      value={atletaId}
                      onChange={(e) => setAtletaId(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">Selecione um atleta</option>
                      {atletasFiltrados.map((atleta) => (
                        <option key={atleta.id} value={atleta.id}>
                          {atleta.nome} {atleta.fone && `- ${atleta.fone}`}
                        </option>
                      ))}
                    </select>
                    {atletasFiltrados.length === 0 && !!buscaAtleta.trim() && (
                      <p className="mt-1 text-xs text-gray-500">
                        Nenhum atleta encontrado para "{buscaAtleta}". Tente outro nome ou telefone.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Campos Avulso (modo avulso) */}
            {canGerenciarAgendamento && modo === 'avulso' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <UserPlus className="inline w-4 h-4 mr-1" />
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={nomeAvulso}
                    onChange={(e) => setNomeAvulso(e.target.value)}
                    required
                    placeholder="Nome completo"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                  <input
                    type="text"
                    value={telefoneAvulso}
                    onChange={(e) => {
                      const masked = e.target.value
                        .replace(/\D/g, '')
                        .replace(/^(\d{2})(\d)/, '($1) $2')
                        .replace(/(\d{5})(\d)/, '$1-$2')
                        .slice(0, 15);
                      setTelefoneAvulso(masked);
                    }}
                    required
                    placeholder="(99) 99999-9999"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  Estabelecimento
                </label>
                {isAdmin ? (
                  <select
                    value={pointId}
                    onChange={(e) => {
                      setPointId(e.target.value);
                      setQuadraId('');
                    }}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Selecione um estabelecimento</option>
                    {points.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                    {isOrganizer ? 'Arena do gestor' : agendamento?.quadra?.point?.nome || 'Selecione um estabelecimento'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quadra *</label>
                <select
                  value={quadraId}
                  onChange={(e) => setQuadraId(e.target.value)}
                  required
                  disabled={!pointId && !isOrganizer}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione uma quadra</option>
                  {quadras.map((quadra) => (
                    <option key={quadra.id} value={quadra.id}>
                      {quadra.nome} {quadra.tipo && `(${quadra.tipo})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Data *
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  Hora *
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duração (min) *</label>
                <select
                  value={duracao}
                  onChange={(e) => setDuracao(Number(e.target.value))}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Informações adicionais sobre o agendamento..."
              />
            </div>

            {/* Valores */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                      R$
                    </span>
                    Tabela / hora
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(valorHora)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Total calculado (tabela)</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(valorCalculado)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <label className="block text-xs text-emerald-700 mb-1 font-medium">
                    Valor negociado
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                      R$
                    </span>
                    {canGerenciarAgendamento && (
                      <span className="ml-1 text-[10px] text-emerald-700">(editável)</span>
                    )}
                  </label>
                  {canGerenciarAgendamento ? (
                    <input
                      type="text"
                      value={valorNegociado}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d,.-]/g, '');
                        setValorNegociado(raw);
                      }}
                      placeholder="Ex: 90,00"
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-emerald-800">
                      {formatCurrency(
                        valorNegociado.trim()
                          ? parseFloat(valorNegociado.replace(',', '.'))
                          : valorCalculado
                      )}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                O <span className="font-semibold text-emerald-700">valor negociado</span> é o que será considerado como{' '}
                <span className="font-semibold">valor final do agendamento</span>. Se ficar em branco, o sistema usa automaticamente o{' '}
                <span className="font-semibold">total calculado pela tabela de preços</span> da quadra (quando existir).
              </p>
            </div>

            {/* Horários Ocupados */}
            {quadraId && data && horariosOcupados.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Horários já ocupados neste dia:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {horariosOcupados.map((horario, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium"
                        >
                          {horario}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {erro && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              </div>
            )}

            {conflito && !erro && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{conflito}</p>
                </div>
              </div>
            )}

            {/* Seção de Recorrência */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="temRecorrencia"
                    checked={temRecorrencia}
                    onChange={(e) => {
                      setTemRecorrencia(e.target.checked);
                      if (!e.target.checked) {
                        setTipoRecorrencia(null);
                      }
                    }}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="temRecorrencia" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <Repeat className="w-4 h-4 text-purple-600" />
                    Agendamento Recorrente
                  </label>
                </div>

                {temRecorrencia && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Recorrência *</label>
                      <select
                        value={tipoRecorrencia || ''}
                        onChange={(e) => setTipoRecorrencia(e.target.value as TipoRecorrencia || null)}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Selecione o tipo</option>
                        <option value="DIARIO">Diário</option>
                        <option value="SEMANAL">Semanal</option>
                        <option value="MENSAL">Mensal</option>
                      </select>
                    </div>

                    {tipoRecorrencia && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Intervalo {tipoRecorrencia === 'DIARIO' ? '(dias)' : tipoRecorrencia === 'SEMANAL' ? '(semanas)' : '(meses)'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={intervaloRecorrencia}
                            onChange={(e) => setIntervaloRecorrencia(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          />
                        </div>

                        {tipoRecorrencia === 'SEMANAL' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dias da Semana *</label>
                            <div className="grid grid-cols-7 gap-2">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (diasSemanaRecorrencia.includes(idx)) {
                                      setDiasSemanaRecorrencia(diasSemanaRecorrencia.filter(d => d !== idx));
                                    } else {
                                      setDiasSemanaRecorrencia([...diasSemanaRecorrencia, idx]);
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-lg border-2 transition-all ${
                                    diasSemanaRecorrencia.includes(idx)
                                      ? 'border-purple-600 bg-purple-100 text-purple-700 font-semibold'
                                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                  }`}
                                >
                                  {dia}
                                </button>
                              ))}
                            </div>
                            {diasSemanaRecorrencia.length === 0 && (
                              <p className="mt-1 text-xs text-red-600">Selecione pelo menos um dia da semana</p>
                            )}
                          </div>
                        )}

                        {tipoRecorrencia === 'MENSAL' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dia do Mês</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={diaMesRecorrencia}
                              onChange={(e) => setDiaMesRecorrencia(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                            <p className="mt-1 text-xs text-gray-500">Deixe vazio para usar o mesmo dia do mês da data inicial</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data de Término (opcional)</label>
                            <input
                              type="date"
                              value={dataFimRecorrencia}
                              onChange={(e) => {
                                setDataFimRecorrencia(e.target.value);
                                if (e.target.value) {
                                  setQuantidadeOcorrencias(0);
                                }
                              }}
                              min={data}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade de Ocorrências (opcional)</label>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={quantidadeOcorrencias}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setQuantidadeOcorrencias(val);
                                if (val > 0) {
                                  setDataFimRecorrencia('');
                                }
                              }}
                              disabled={!!dataFimRecorrencia}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {dataFimRecorrencia
                            ? `A recorrência terminará em ${new Date(dataFimRecorrencia).toLocaleDateString('pt-BR')}`
                            : quantidadeOcorrencias > 0
                            ? `Serão criados ${quantidadeOcorrencias} agendamento(s)`
                            : 'A recorrência continuará até ser cancelada manualmente'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

            {/* Opção de aplicar recorrência quando já é recorrente */}
            {agendamento && agendamentoJaRecorrente && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <Repeat className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Este agendamento faz parte de uma recorrência
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aplicarRecorrencia"
                          checked={!aplicarARecorrencia}
                          onChange={() => setAplicarARecorrencia(false)}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Aplicar alterações apenas neste agendamento
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aplicarRecorrencia"
                          checked={aplicarARecorrencia}
                          onChange={() => setAplicarARecorrencia(true)}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Aplicar alterações neste e em todos os agendamentos futuros desta recorrência
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || !!conflito}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {salvando ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </span>
                ) : agendamento ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Agendamento'
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

