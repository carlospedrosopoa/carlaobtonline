// components/EditarAgendamentoModal.tsx - Modal de edição de agendamento (100% igual ao cursor)
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { useAuth } from '@/context/AuthContext';
import { pointService, quadraService, agendamentoService, bloqueioAgendaService, tabelaPrecoService } from '@/services/agendamentoService';
import { professorService } from '@/services/professorService';
import { api } from '@/lib/api';
import type { Agendamento, ModoAgendamento } from '@/types/agendamento';
import type { ProfessorAdmin } from '@/services/professorService';
import { Calendar, Clock, MapPin, AlertCircle, User, Users, UserPlus, Repeat, CreditCard } from 'lucide-react';
import type { RecorrenciaConfig, TipoRecorrencia } from '@/types/agendamento';
import InputMonetario from './InputMonetario';

interface Atleta {
  id: string;
  nome: string;
  fone?: string;
  usuarioId?: string | null;
  usuario?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
}

interface EditarAgendamentoModalProps {
  isOpen: boolean;
  agendamento: Agendamento | null;
  onClose: () => void;
  onSuccess: () => void;
  quadraIdInicial?: string; // Para pré-selecionar uma quadra ao criar novo agendamento
  dataInicial?: string; // Para pré-preencher a data ao criar novo agendamento (formato: YYYY-MM-DD)
  horaInicial?: string; // Para pré-preencher a hora ao criar novo agendamento (formato: HH:mm)
  readOnly?: boolean;
}

export default function EditarAgendamentoModal({
  isOpen,
  agendamento,
  onClose,
  onSuccess,
  quadraIdInicial,
  dataInicial,
  horaInicial,
  readOnly = false,
}: EditarAgendamentoModalProps) {
  const { usuario, isAdmin: isAdminContext, isOrganizer: isOrganizerContext } = useAuth();
  // ADMIN e ORGANIZER podem gerenciar agendamentos (criar para atletas ou próprios)
  const isAdmin = isAdminContext;
  const isOrganizer = isOrganizerContext;
  const canGerenciarAgendamento = !readOnly && (isAdmin || isOrganizer);

  const [points, setPoints] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [professores, setProfessores] = useState<ProfessorAdmin[]>([]);
  const [carregandoProfessores, setCarregandoProfessores] = useState(false);
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<Agendamento[]>([]);
  const [bloqueiosExistentes, setBloqueiosExistentes] = useState<any[]>([]);
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoCards, setGerandoCards] = useState(false);
  const [erro, setErro] = useState('');
  const [agendamentoCompleto, setAgendamentoCompleto] = useState<Agendamento | null>(null);
  const [carregandoAgendamento, setCarregandoAgendamento] = useState(false);
  // Armazenar dados completos dos participantes para exibição
  const [participantesCompletos, setParticipantesCompletos] = useState<Array<{
    id: string;
    atletaId: string;
    atleta: {
      id: string;
      nome: string;
      fone?: string;
      usuarioId?: string | null;
      fotoUrl?: string | null;
      usuario?: {
        id: string;
        name: string;
        email: string;
      } | null;
    };
  }>>([]);

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
  const [valorNegociado, setValorNegociado] = useState<number | null>(null);

  // Campos específicos por modo
  const [atletaId, setAtletaId] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telefoneAvulso, setTelefoneAvulso] = useState('');
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [buscandoAtleta, setBuscandoAtleta] = useState(false);
  const [sugestoesAtletas, setSugestoesAtletas] = useState<Atleta[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [bloquearSugestoes, setBloquearSugestoes] = useState(false);
  // Atletas participantes (múltiplos)
  const [atletasParticipantesIds, setAtletasParticipantesIds] = useState<string[]>([]);
  const [mostrarSelecaoAtletas, setMostrarSelecaoAtletas] = useState(false);
  const [buscaAtletasParticipantes, setBuscaAtletasParticipantes] = useState('');
  // Participantes avulsos (apenas nome)
  const [participantesAvulsos, setParticipantesAvulsos] = useState<Array<{ id: string; nome: string }>>([]);
  const [nomeAvulsoParticipante, setNomeAvulsoParticipante] = useState('');
  // Campos de aula/professor
  const [ehAula, setEhAula] = useState(false);
  const [professorId, setProfessorId] = useState<string>('');

  // Campos de recorrência
  const [temRecorrencia, setTemRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>(null);
  const [intervaloRecorrencia, setIntervaloRecorrencia] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState<number[]>([]);
  const [diaMesRecorrencia, setDiaMesRecorrencia] = useState<number>(1);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState('');
  const [quantidadeOcorrencias, setQuantidadeOcorrencias] = useState<number>(12);
  const [aplicarARecorrencia, setAplicarARecorrencia] = useState(false); // Para agendamentos recorrentes: aplicar apenas neste ou em todos os futuros (não usado mais, mas mantido para compatibilidade)
  const [agendamentoJaRecorrente, setAgendamentoJaRecorrente] = useState(false); // Indica se o agendamento já é recorrente (não usado mais, mas mantido para compatibilidade)
  const [manterNaTela, setManterNaTela] = useState(false); // Flag para manter na tela após salvar (apenas para gestores)
  const [restaurandoDados, setRestaurandoDados] = useState(false); // Flag para indicar que estamos restaurando dados preservados
  const [valoresOriginais, setValoresOriginais] = useState<any>(null); // Armazenar valores originais para comparação
  const inputBuscaAtletaRef = useRef<HTMLInputElement>(null); // Ref para o campo de busca de atleta

  // Função para normalizar texto removendo acentuação
  const normalizarTexto = (texto: string): string => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const carregarDados = useCallback(async () => {
    try {
      const [pointsData, atletasData, quadrasData, professoresData] = await Promise.all([
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
        // Carregar professores apenas para ADMIN e ORGANIZER
        canGerenciarAgendamento
          ? (async () => {
              try {
                setCarregandoProfessores(true);
                const data = await professorService.listar({ ativo: true });
                return data;
              } catch (error) {
                console.error('Erro ao carregar professores:', error);
                return [];
              } finally {
                setCarregandoProfessores(false);
              }
            })()
          : Promise.resolve([]),
      ]);

      setPoints(pointsData.filter((p: any) => p.ativo));
      if (canGerenciarAgendamento) {
        setCarregandoAtletas(true);
        setAtletas(atletasData as Atleta[]);
        setCarregandoAtletas(false);
        setProfessores(professoresData);
      }
      // Se for ORGANIZER, carregar quadras diretamente
      if (isOrganizer && quadrasData.length > 0) {
        setQuadras((quadrasData as any[]).filter((q: any) => q.ativo));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }, [isAdmin, usuario?.role, canGerenciarAgendamento, isOrganizer]);

  useEffect(() => {
    if (isOpen) {
      carregarDados();
      if (agendamento) {
        // Buscar agendamento completo para garantir que os participantes sejam carregados
        carregarAgendamentoCompleto(agendamento.id);
      } else {
        // Modo criação - resetar formulário
        resetarFormulario();
        
        // Se houver dataInicial e horaInicial, pré-preencher
        if (dataInicial) {
          setData(dataInicial);
        }
        if (horaInicial) {
          setHora(horaInicial);
        }
        
        // Se houver quadraIdInicial, pré-selecionar após carregar dados
        if (quadraIdInicial) {
          // Aguardar um pouco para os dados carregarem
          setTimeout(() => {
            selecionarQuadraInicial(quadraIdInicial);
          }, 100);
        }
        
        // Focar no campo de busca de atleta após um pequeno delay (para garantir que o modal esteja renderizado)
        if (canGerenciarAgendamento) {
          setTimeout(() => {
            inputBuscaAtletaRef.current?.focus();
          }, 300);
        }
      }
    } else {
      // Limpar quando fechar
      setAgendamentoCompleto(null);
      setManterNaTela(false);
    }
  }, [isOpen, agendamento?.id, carregarDados]);

  // Preencher formulário quando o agendamento completo for carregado
  useEffect(() => {
    if (agendamentoCompleto) {
      preencherFormulario(agendamentoCompleto);
    }
  }, [agendamentoCompleto]);

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

  // Calcular valores quando quadra, data, hora ou duração mudarem
  useEffect(() => {
    const calcularValores = async () => {
      // Só calcular se tiver quadra, data e hora selecionados
      if (!quadraId || !data || !hora || !duracao) {
        setValorHora(null);
        setValorCalculado(null);
        return;
      }

      // Não calcular se estiver restaurando dados preservados
      if (restaurandoDados) return;

      try {
        // Buscar tabela de preços da quadra
        const tabelasPreco = await tabelaPrecoService.listar(quadraId);
        const tabelasAtivas = tabelasPreco.filter((tp) => tp.ativo);

        if (tabelasAtivas.length > 0) {
          // Converter hora para minutos do dia (0-1439)
          const [horaStr, minutoStr] = hora.split(':');
          const horaNum = parseInt(horaStr, 10);
          const minutoNum = parseInt(minutoStr, 10);
          const minutosDoDia = horaNum * 60 + minutoNum;

          // Encontrar tabela de preço aplicável ao horário
          // Ordenar por inicioMinutoDia para garantir que pegamos a primeira que se aplica
          const tabelasOrdenadas = [...tabelasAtivas].sort((a, b) => a.inicioMinutoDia - b.inicioMinutoDia);
          const precoAplicavel = tabelasOrdenadas.find((tp) => {
            const inicioMinuto = tp.inicioMinutoDia || 0;
            const fimMinuto = tp.fimMinutoDia !== undefined && tp.fimMinutoDia !== null ? tp.fimMinutoDia : 1439; // 23:59 se não definido
            return minutosDoDia >= inicioMinuto && minutosDoDia < fimMinuto;
          });

          if (precoAplicavel) {
            // Se for aula, usar valorHoraAula se disponível, senão usar valorHora como fallback
            let valorHoraCalculado: number;
            if (ehAula) {
              valorHoraCalculado = (precoAplicavel.valorHoraAula !== null && precoAplicavel.valorHoraAula !== undefined)
                ? parseFloat(precoAplicavel.valorHoraAula.toString())
                : parseFloat(precoAplicavel.valorHora.toString());
            } else {
              valorHoraCalculado = parseFloat(precoAplicavel.valorHora.toString());
            }
            const valorCalculadoCalculado = (valorHoraCalculado * duracao) / 60;
            setValorHora(valorHoraCalculado);
            setValorCalculado(valorCalculadoCalculado);
          } else {
            // Se não encontrou tabela aplicável, limpar valores
            setValorHora(null);
            setValorCalculado(null);
          }
        } else {
          // Se não há tabelas de preço, limpar valores
          setValorHora(null);
          setValorCalculado(null);
        }
      } catch (error) {
        console.error('Erro ao calcular valores:', error);
        setValorHora(null);
        setValorCalculado(null);
      }
    };

    calcularValores();
  }, [quadraId, data, hora, duracao, ehAula, restaurandoDados]);


  useEffect(() => {
    // Não limpar campos se estivermos restaurando dados preservados
    if (restaurandoDados) return;
    
    // Não limpar campos se estivermos preenchendo um agendamento existente
    // (o preencherFormulario já preenche os campos corretamente)
    if (agendamentoCompleto) return;
    
    if (modo === 'normal') {
      setAtletaId('');
      setNomeAvulso('');
      setTelefoneAvulso('');
    } else if (modo === 'atleta') {
      setNomeAvulso('');
      setTelefoneAvulso('');
      setBuscaAtleta('');
    }
  }, [modo, restaurandoDados, agendamentoCompleto]);

  

  useEffect(() => {
    const termo = buscaAtleta.trim();
    if (bloquearSugestoes) {
      return;
    }
    if (termo.length < 2) {
      setSugestoesAtletas([]);
      setMostrarSugestoes(false);
      return;
    }
    setMostrarSugestoes(true);
    setBuscandoAtleta(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/user/atleta/buscar?q=${encodeURIComponent(termo)}&limite=20`);
        const lista = Array.isArray(res.data?.atletas) ? res.data.atletas : [];
        // compatibilidade com tipo Atleta local
        setSugestoesAtletas(
          lista.map((a: any) => ({ id: a.id, nome: a.nome, fone: a.telefone }))
        );
      } catch (error) {
        console.error('Erro na busca dinâmica de atletas:', error);
        setSugestoesAtletas([]);
      } finally {
        setBuscandoAtleta(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [buscaAtleta]);

  const resetarFormulario = () => {
    setParticipantesAvulsos([]);
    setNomeAvulsoParticipante('');
    setPointId('');
    setQuadraId('');
    // Definir data atual como padrão para novos agendamentos
    const hoje = new Date();
    const dataAtual = hoje.toISOString().split('T')[0];
    setData(dataAtual);
    setHora('');
    setDuracao(60);
    setObservacoes('');
    setValorHora(null);
    setValorCalculado(null);
    setValorNegociado(null);
    setAtletaId('');
    setNomeAvulso('');
    setTelefoneAvulso('');
    setBuscaAtleta('');
    setModo('atleta'); // Padrão: Cliente Cadastrado
    setAgendamentosExistentes([]);
    setErro('');
    setAtletasParticipantesIds([]);
    setMostrarSelecaoAtletas(false);
    setBuscaAtletasParticipantes('');
    setParticipantesCompletos([]);
    setManterNaTela(false); // Resetar flag ao resetar formulário
    setEhAula(false);
    setProfessorId('');
    // Limpar campos de recorrência
    setTemRecorrencia(false);
    setTipoRecorrencia(null);
    setIntervaloRecorrencia(1);
    setDiasSemanaRecorrencia([]);
    setDiaMesRecorrencia(1);
    setDataFimRecorrencia('');
    setQuantidadeOcorrencias(12);
    setAgendamentoJaRecorrente(false);
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

  const carregarAgendamentoCompleto = async (agendamentoId: string) => {
    try {
      setCarregandoAgendamento(true);
      const agendamentoCompleto = await agendamentoService.obter(agendamentoId);
      setAgendamentoCompleto(agendamentoCompleto);
    } catch (error) {
      console.error('Erro ao carregar agendamento completo:', error);
      // Em caso de erro, usar o agendamento passado como prop
      setAgendamentoCompleto(agendamento);
    } finally {
      setCarregandoAgendamento(false);
    }
  };

  const preencherFormulario = (agendamentoParaPreencher?: Agendamento) => {
    const agendamentoParaUsar = agendamentoParaPreencher || agendamento;
    if (!agendamentoParaUsar) return;

    // Preenche dados básicos
    // Extrair data/hora diretamente da string UTC sem conversão de timezone
    // Isso garante que 20h gravado = 20h exibido no formulário
    const dataHoraStr = agendamentoParaUsar.dataHora;
    const dataPreenchida = dataHoraStr.split('T')[0];
    const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
    const horaPreenchida = match ? `${match[1]}:${match[2]}` : '00:00';
    
    setData(dataPreenchida);
    setHora(horaPreenchida);
    setDuracao(agendamentoParaUsar.duracao);
    setObservacoes(agendamentoParaUsar.observacoes || '');
    setValorHora(agendamentoParaUsar.valorHora ?? null);
    setValorCalculado(agendamentoParaUsar.valorCalculado ?? null);
    setValorNegociado(agendamentoParaUsar.valorNegociado ?? null);

    // Preenche campos de aula/professor
    // Garantir que ehAula seja boolean verdadeiro (pode ser boolean, undefined ou null)
    const ehAulaValue = agendamentoParaUsar.ehAula === true || Boolean(agendamentoParaUsar.ehAula);
    setEhAula(ehAulaValue);
    // Preencher professorId se existir (pode ser string vazia, null ou undefined)
    setProfessorId(agendamentoParaUsar.professorId ? String(agendamentoParaUsar.professorId) : '');
    
    console.log('[EditarAgendamentoModal] Preenchendo campos de aula:', {
      ehAulaOriginal: agendamentoParaUsar.ehAula,
      ehAulaValue,
      professorIdOriginal: agendamentoParaUsar.professorId,
      professorIdPreenchido: agendamentoParaUsar.professorId ? String(agendamentoParaUsar.professorId) : ''
    });

    // Armazenar valores originais para comparação
    setValoresOriginais({
      quadraId: agendamentoParaUsar.quadraId,
      dataHora: `${dataPreenchida}T${horaPreenchida}:00`,
      duracao: agendamentoParaUsar.duracao,
      observacoes: agendamentoParaUsar.observacoes || '',
      valorHora: agendamentoParaUsar.valorHora ?? null,
      valorCalculado: agendamentoParaUsar.valorCalculado ?? null,
      valorNegociado: agendamentoParaUsar.valorNegociado ?? null,
      atletaId: agendamentoParaUsar.atletaId || null,
      nomeAvulso: agendamentoParaUsar.nomeAvulso || '',
      telefoneAvulso: agendamentoParaUsar.telefoneAvulso || '',
      atletasParticipantesIds: agendamentoParaUsar.atletasParticipantes?.filter((ap) => ap.atletaId).map((ap) => ap.atletaId!) || [],
      participantesAvulsos: agendamentoParaUsar.atletasParticipantes?.filter((ap) => !ap.atletaId && ap.atleta?.nome).map((ap) => ({ nome: ap.atleta.nome })) || [],
      ehAula: agendamentoParaUsar.ehAula || false,
      professorId: agendamentoParaUsar.professorId || null,
    });

    // Preenche quadra e point
    setQuadraId(agendamentoParaUsar.quadraId);
    setPointId(agendamentoParaUsar.quadra.point.id);

    // Determina o modo baseado no agendamento
    // Se tiver nomeAvulso (compatibilidade com dados antigos), trata como 'normal' (próprio)
    if (agendamentoParaUsar.atletaId && agendamentoParaUsar.atleta) {
      setModo('atleta');
      setAtletaId(agendamentoParaUsar.atletaId);
      // Preencher o campo de busca com o nome do atleta para exibir
      setBuscaAtleta(agendamentoParaUsar.atleta.nome || '');
      setBloquearSugestoes(true); // Bloquear sugestões já que temos um atleta selecionado
    } else {
      // Modo 'normal' (próprio) - sem cliente vinculado
      // Se tiver nomeAvulso (dados antigos), não carregamos mas tratamos como próprio
      setModo('normal');
      setBuscaAtleta('');
      setBloquearSugestoes(false);
    }

    // Preenche campos de recorrência se o agendamento já for recorrente
    const temRecorrenciaAtual = !!agendamentoParaUsar.recorrenciaId || !!agendamentoParaUsar.recorrenciaConfig;
    setAgendamentoJaRecorrente(temRecorrenciaAtual);
    
    if (temRecorrenciaAtual && agendamentoParaUsar.recorrenciaConfig) {
      const config = agendamentoParaUsar.recorrenciaConfig;
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

    // Preencher atletas participantes e participantes avulsos
    if (agendamentoParaUsar.atletasParticipantes && agendamentoParaUsar.atletasParticipantes.length > 0) {
      console.log('[EditarAgendamentoModal] Carregando participantes:', agendamentoParaUsar.atletasParticipantes);
      // Separar atletas cadastrados de participantes avulsos
      const idsParticipantes = agendamentoParaUsar.atletasParticipantes
        .filter(ap => ap.atletaId)
        .map(ap => ap.atletaId!);
      const avulsos = agendamentoParaUsar.atletasParticipantes
        .filter(ap => !ap.atletaId && ap.atleta?.nome)
        .map(ap => ({
          id: ap.id,
          nome: ap.atleta.nome,
        }));
      
      console.log('[EditarAgendamentoModal] IDs dos participantes:', idsParticipantes);
      console.log('[EditarAgendamentoModal] Participantes avulsos:', avulsos);
      
      setAtletasParticipantesIds(idsParticipantes);
      setParticipantesAvulsos(avulsos);
      // Armazenar dados completos dos participantes para exibição
      setParticipantesCompletos(agendamentoParaUsar.atletasParticipantes);
    } else {
      console.log('[EditarAgendamentoModal] Nenhum participante encontrado. atletasParticipantes:', agendamentoParaUsar.atletasParticipantes);
      setAtletasParticipantesIds([]);
      setParticipantesAvulsos([]);
      setParticipantesCompletos([]);
    }
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

    // Criar data/hora selecionada no timezone local para comparação correta
    const [ano, mes, dia] = data.split('-').map(Number);
    const [horaNum, minutoNum] = hora.split(':').map(Number);
    const dataHoraSelecionada = new Date(ano, mes - 1, dia, horaNum, minutoNum, 0);

    // Se estamos editando um agendamento, verificar se o horário selecionado é o mesmo do agendamento atual
    // (mesmo que a quadra tenha mudado, não há conflito se mantivermos o mesmo horário)
    if (agendamento) {
      // Extrair data/hora do agendamento atual diretamente da string ISO (sem conversão de timezone)
      const agendamentoDataHoraStr = agendamento.dataHora;
      const agendamentoDataPart = agendamentoDataHoraStr.split('T')[0];
      const agendamentoHoraMatch = agendamentoDataHoraStr.match(/T(\d{2}):(\d{2})/);
      
      // Se a data, hora e duração são as mesmas, não há conflito (mesmo que a quadra tenha mudado)
      // O agendamento atual será ignorado no loop de verificação abaixo
      if (
        agendamentoDataPart === data &&
        agendamentoHoraMatch &&
        agendamentoHoraMatch[1] === hora.split(':')[0] &&
        agendamentoHoraMatch[2] === hora.split(':')[1] &&
        agendamento.duracao === duracao
      ) {
        // Mesmo horário e duração - não há conflito (mesmo que a quadra tenha mudado)
        // O agendamento atual será ignorado no loop abaixo
      }
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
        minutosInicio < bloqueioFim && minutosFim > bloqueioInicio
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
      // Se estamos editando um agendamento, garantir que não estamos comparando com ele mesmo
      if (agendamento && ag.id === agendamento.id) {
        continue;
      }

      // Se estamos editando e mantendo o mesmo horário/data/duração, ignorar qualquer
      // agendamento que tenha exatamente o mesmo horário (pode ser o próprio agendamento
      // que ainda está na lista por algum motivo, especialmente quando mudamos a quadra)
      if (agendamento) {
        const agendamentoDataHoraStr = agendamento.dataHora;
        const agendamentoDataPart = agendamentoDataHoraStr.split('T')[0];
        const agendamentoHoraMatch = agendamentoDataHoraStr.match(/T(\d{2}):(\d{2})/);
        const agDataPart = ag.dataHora.split('T')[0];
        const agHoraMatch = ag.dataHora.match(/T(\d{2}):(\d{2})/);
        
        // Se o horário selecionado é o mesmo do agendamento atual E o agendamento na lista
        // tem o mesmo horário/data/duração, ignorar (provavelmente é o próprio agendamento)
        if (
          agendamentoDataPart === data &&
          agendamentoHoraMatch &&
          agendamentoHoraMatch[1] === hora.split(':')[0] &&
          agendamentoHoraMatch[2] === hora.split(':')[1] &&
          agendamento.duracao === duracao &&
          agendamentoDataPart === agDataPart &&
          agendamentoHoraMatch && agHoraMatch &&
          agendamentoHoraMatch[1] === agHoraMatch[1] &&
          agendamentoHoraMatch[2] === agHoraMatch[2] &&
          agendamento.duracao === ag.duracao
        ) {
          continue;
        }
      }

      // Extrair hora/minuto diretamente da string ISO sem conversão de timezone
      // Isso evita problemas de fuso horário
      const agDataHoraStr = ag.dataHora;
      const agDataPart = agDataHoraStr.split('T')[0];
      const agHoraMatch = agDataHoraStr.match(/T(\d{2}):(\d{2})/);
      
      // Verificar se é o mesmo dia
      if (agDataPart !== data) {
        continue; // Diferentes dias, não há conflito
      }
      
      if (!agHoraMatch) {
        continue; // Não foi possível extrair hora
      }
      
      // Extrair hora e minuto do agendamento existente diretamente da string
      const agHoraNum = parseInt(agHoraMatch[1], 10);
      const agMinutoNum = parseInt(agHoraMatch[2], 10);
      const agMinutosInicio = agHoraNum * 60 + agMinutoNum;
      const agMinutosFim = agMinutosInicio + ag.duracao;
      
      // Comparar com os minutos do horário selecionado
      if (
        minutosInicio < agMinutosFim && minutosFim > agMinutosInicio
      ) {
        // Formatar horários para exibição
        const inicio = `${agHoraNum.toString().padStart(2, '0')}:${agMinutoNum.toString().padStart(2, '0')}`;
        const agHoraFim = Math.floor(agMinutosFim / 60) % 24;
        const agMinutoFim = agMinutosFim % 60;
        const fim = `${agHoraFim.toString().padStart(2, '0')}:${agMinutoFim.toString().padStart(2, '0')}`;
        return `Conflito com agendamento existente das ${inicio} às ${fim}`;
      }
    }

    return null;
  };

  // Função para verificar se houve alterações
  const temAlteracoes = useMemo(() => {
    // Se não é edição (criação), não há alterações a verificar - sempre pode salvar
    if (!agendamento) {
      return false;
    }

    // Se é edição mas ainda não carregou valores originais, permitir salvar
    if (!valoresOriginais) {
      return false;
    }

    // Comparar valores atuais com originais
    const dataHoraAtual = `${data}T${hora}:00`;
    const dataHoraOriginal = valoresOriginais.dataHora?.substring(0, 16) || '';
    const dataHoraAtualNormalizada = dataHoraAtual.substring(0, 16);

    // Comparar campos principais
    const mudouDataHora = dataHoraAtualNormalizada !== dataHoraOriginal;
    const mudouQuadra = quadraId !== valoresOriginais.quadraId;
    const mudouDuracao = duracao !== valoresOriginais.duracao;
    const mudouObservacoes = (observacoes || '') !== (valoresOriginais.observacoes || '');
    const mudouValorNegociado = valorNegociado !== valoresOriginais.valorNegociado;

    // Comparar modo e campos específicos
    let mudouModo = false;
    if (modo === 'atleta') {
      mudouModo = atletaId !== valoresOriginais.atletaId;
    }

    // Comparar participantes (ordem importa)
    const participantesAtuais = [...atletasParticipantesIds].sort();
    const participantesOriginais = [...(valoresOriginais.atletasParticipantesIds || [])].sort();
    const mudouParticipantesAtletas = JSON.stringify(participantesAtuais) !== JSON.stringify(participantesOriginais);
    
    // Comparar participantes avulsos (ordem importa, comparar por nome)
    const avulsosAtuais = [...participantesAvulsos].map(a => a.nome).sort();
    const avulsosOriginais = [...(valoresOriginais.participantesAvulsos || [])].map((a: any) => a.nome || a).sort();
    const mudouParticipantesAvulsos = JSON.stringify(avulsosAtuais) !== JSON.stringify(avulsosOriginais);
    
    const mudouParticipantes = mudouParticipantesAtletas || mudouParticipantesAvulsos;

    // Comparar campos de aula/professor
    const mudouEhAula = ehAula !== (valoresOriginais.ehAula || false);
    const mudouProfessorId = (professorId || '') !== (valoresOriginais.professorId || '');

    return mudouDataHora || mudouQuadra || mudouDuracao || mudouObservacoes || 
           mudouValorNegociado || mudouModo || mudouParticipantes || mudouEhAula || mudouProfessorId;
  }, [
    agendamento,
    valoresOriginais,
    data,
    hora,
    quadraId,
    duracao,
    observacoes,
    valorNegociado,
    modo,
    atletaId,
    nomeAvulso,
    telefoneAvulso,
    atletasParticipantesIds,
    participantesAvulsos,
    ehAula,
    professorId,
  ]);

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

    // Validação de recorrência (criação e edição)
    if (temRecorrencia) {
      if (!tipoRecorrencia) {
        return 'Selecione o tipo de recorrência';
      }
      if (tipoRecorrencia === 'SEMANAL' && diasSemanaRecorrencia.length === 0) {
        return 'Selecione pelo menos um dia da semana para recorrência semanal';
      }
    }

    // Validação de aula/professor
    if (ehAula && !professorId) {
      return 'Selecione um professor quando o agendamento for para aula';
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

    try {
      // Enviar o horário escolhido pelo usuário sem conversão de timezone
      // O backend vai salvar exatamente como informado (tratando como UTC direto)
      // Isso garante que 20h escolhido = 20h gravado no banco
      const payload: any = {
        // Sempre incluir observacoes (mesmo que seja string vazia, enviar como null)
        observacoes: observacoes || null,
      };

      // Só enviar dataHora, quadraId e duracao se estiver editando E realmente alterou, ou se estiver criando
      if (agendamento) {
        // Modo edição - só enviar campos que foram realmente alterados
        const dataHoraAtual = agendamento.dataHora;
        const dataHoraNova = `${data}T${hora}:00`;
        const dataHoraAtualNormalizada = dataHoraAtual ? dataHoraAtual.substring(0, 16) : null;
        const dataHoraNovaNormalizada = dataHoraNova.substring(0, 16);
        
        // Só enviar dataHora se realmente mudou
        if (dataHoraAtualNormalizada !== dataHoraNovaNormalizada) {
          payload.dataHora = dataHoraNova;
        }
        
        // Só enviar quadraId se realmente mudou
        if (quadraId !== agendamento.quadraId) {
          payload.quadraId = quadraId;
        }
        
        // Só enviar duracao se realmente mudou
        if (duracao !== agendamento.duracao) {
          payload.duracao = duracao;
        }
      } else {
        // Modo criação - enviar todos os campos obrigatórios
        payload.quadraId = quadraId;
        payload.dataHora = `${data}T${hora}:00`;
        payload.duracao = duracao;
      }

      // Se for admin/organizador e mudou o modo, atualiza os campos específicos
      if (canGerenciarAgendamento) {
        if (modo === 'atleta' && atletaId) {
          payload.atletaId = atletaId;
          // Remove campos de avulso se existirem (compatibilidade com dados antigos)
          payload.nomeAvulso = null;
          payload.telefoneAvulso = null;
        } else {
          // Modo normal (próprio) - remove campos específicos
          payload.atletaId = null;
          payload.nomeAvulso = null;
          payload.telefoneAvulso = null;
        }
      }

      // Valor negociado (ADMIN e ORGANIZER podem informar)
      // Sempre enviar valorNegociado quando canGerenciarAgendamento for true, mesmo se for null
      if (canGerenciarAgendamento) {
        payload.valorNegociado = valorNegociado !== null && valorNegociado !== undefined ? valorNegociado : null;
      }

      // Sempre enviar valores calculados quando houver qualquer alteração (para permitir recalcular valores)
      // Isso é útil quando a tabela de preços foi criada após o agendamento
      if (agendamento) {
        // Enviar valores calculados sempre que houver alteração (mesmo que sejam null)
        payload.valorHora = valorHora;
        payload.valorCalculado = valorCalculado;
      } else {
        // Modo criação - sempre enviar valores calculados
        payload.valorHora = valorHora;
        payload.valorCalculado = valorCalculado;
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

      // Atletas participantes (múltiplos)
      if (atletasParticipantesIds.length > 0) {
        payload.atletasParticipantesIds = atletasParticipantesIds;
      } else {
        payload.atletasParticipantesIds = [];
      }

      // Participantes avulsos (não criam atletas, são salvos diretamente na tabela AgendamentoAtleta)
      // Sempre enviar o array, mesmo que vazio, para garantir que o backend processe corretamente
      payload.participantesAvulsos = participantesAvulsos.length > 0 
        ? participantesAvulsos.map(av => ({ nome: av.nome }))
        : [];
      
      console.log('[EditarAgendamentoModal] Participantes avulsos no estado:', participantesAvulsos);
      console.log('[EditarAgendamentoModal] Participantes avulsos no payload:', payload.participantesAvulsos);

      // Campos de aula/professor
      if (ehAula) {
        payload.ehAula = true;
        if (professorId) {
          payload.professorId = professorId;
        }
      } else {
        // Se não é aula, garantir que professorId seja null/undefined
        payload.ehAula = false;
        payload.professorId = null;
      }

      // Log do payload completo antes de enviar
      console.log('[EditarAgendamentoModal] ============================================');
      console.log('[EditarAgendamentoModal] Payload completo que será enviado:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('[EditarAgendamentoModal] valorNegociado no estado:', valorNegociado);
      console.log('[EditarAgendamentoModal] valorNegociado no payload:', payload.valorNegociado);
      console.log('[EditarAgendamentoModal] canGerenciarAgendamento:', canGerenciarAgendamento);
      console.log('[EditarAgendamentoModal] ============================================');

      // Executar salvamento diretamente (sem modal de confirmação)
      // A lógica de aplicar aos futuros foi removida - sempre edita apenas o agendamento atual
      if (agendamento) {
        // Modo edição
        setSalvando(true);
        try {
          const agendamentoAtualizado = await agendamentoService.atualizar(agendamento.id, payload);
          
          // Atualizar estado com valores atualizados
          setValorHora(agendamentoAtualizado.valorHora || null);
          setValorCalculado(agendamentoAtualizado.valorCalculado || null);
          setValorNegociado(agendamentoAtualizado.valorNegociado || null);
          
          // Armazenar valores originais para comparação futura
          const dataHoraStr = agendamentoAtualizado.dataHora;
          const dataResult = dataHoraStr.split('T')[0];
          const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
          const horaResult = match ? `${match[1]}:${match[2]}` : '00:00';
          
          setValoresOriginais({
            quadraId: agendamentoAtualizado.quadraId,
            dataHora: `${dataResult}T${horaResult}:00`,
            duracao: agendamentoAtualizado.duracao,
            observacoes: agendamentoAtualizado.observacoes || '',
            valorHora: agendamentoAtualizado.valorHora ?? null,
            valorCalculado: agendamentoAtualizado.valorCalculado ?? null,
            valorNegociado: agendamentoAtualizado.valorNegociado ?? null,
            atletaId: agendamentoAtualizado.atletaId || null,
            nomeAvulso: agendamentoAtualizado.nomeAvulso || '',
            telefoneAvulso: agendamentoAtualizado.telefoneAvulso || '',
            atletasParticipantesIds: agendamentoAtualizado.atletasParticipantes?.map((ap: any) => ap.atletaId).filter((id: string) => id) || [],
            participantesAvulsos: agendamentoAtualizado.atletasParticipantes?.filter((ap: any) => !ap.atletaId && ap.atleta?.nome).map((ap: any) => ({ nome: ap.atleta.nome })) || [],
            ehAula: agendamentoAtualizado.ehAula || false,
            professorId: agendamentoAtualizado.professorId || null,
          });
          
          onSuccess();
          onClose();
        } catch (error: any) {
          console.error('Erro ao atualizar agendamento:', error);
          setErro(error?.response?.data?.mensagem || error?.data?.mensagem || 'Erro ao atualizar agendamento. Tente novamente.');
        } finally {
          setSalvando(false);
        }
      } else {
        // Modo criação
        setSalvando(true);
        try {
          const novoAgendamento = await agendamentoService.criar(payload);
          
          // Atualizar estado com valores calculados
          setValorHora(novoAgendamento.valorHora || null);
          setValorCalculado(novoAgendamento.valorCalculado || null);
          setValorNegociado(novoAgendamento.valorNegociado || null);
          
          // Armazenar valores originais para comparação futura
          setValoresOriginais({
            valorHora: novoAgendamento.valorHora,
            valorCalculado: novoAgendamento.valorCalculado,
            valorNegociado: novoAgendamento.valorNegociado,
          });
          
          // Se a flag "manterNaTela" estiver marcada (apenas para gestores), manter modal aberto e limpar apenas quadra/participantes
          if (manterNaTela && canGerenciarAgendamento) {
            // Limpar apenas seleção de quadras e participantes
            setQuadraId('');
            setAtletasParticipantesIds([]);
            setParticipantesCompletos([]);
            setMostrarSelecaoAtletas(false);
            setBuscaAtletasParticipantes('');
            // Limpar valores calculados (serão recalculados quando selecionar nova quadra)
            setValorHora(null);
            setValorCalculado(null);
            // Limpar campos de recorrência (cada agendamento deve ser único)
            setTemRecorrencia(false);
            setTipoRecorrencia(null);
            setIntervaloRecorrencia(1);
            setDiasSemanaRecorrencia([]);
            setDiaMesRecorrencia(1);
            setDataFimRecorrencia('');
            setQuantidadeOcorrencias(12);
            // Limpar erro se houver
            setErro('');
            // Manter todos os outros dados (data, hora, duracao, observacoes, valorNegociado, modo, atletaId, etc)
            // Não fechar o modal - mantém aberto
            onSuccess(); // Atualiza a lista de agendamentos
            // NÃO chamar onClose() - mantém o modal aberto
          } else {
            // Comportamento normal: fechar o modal
            onSuccess();
            onClose();
          }
        } catch (error: any) {
          console.error('Erro ao criar agendamento:', error);
          setErro(error?.response?.data?.mensagem || error?.data?.mensagem || 'Erro ao criar agendamento. Tente novamente.');
        } finally {
          setSalvando(false);
        }
      }
    } catch (error: any) {
      console.error(`Erro ao preparar ${agendamento ? 'atualização' : 'criação'} de agendamento:`, error);
      setErro(
        error?.response?.data?.mensagem ||
          error?.data?.mensagem ||
          `Erro ao preparar ${agendamento ? 'atualização' : 'criação'} de agendamento. Tente novamente.`
      );
      setSalvando(false);
    }
  };

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
          {carregandoAgendamento && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">Carregando dados do agendamento...</p>
            </div>
          )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Botão "Para Mim" oculto por enquanto */}
                {/* <button
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
                </button> */}
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
                  <span className="font-medium">Atleta Cadastrado</span>
                </button>
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
                  <span className="font-medium">Próprio</span>
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
                      ref={inputBuscaAtletaRef}
                      type="text"
                      value={buscaAtleta}
                      onChange={(e) => {
                        setBuscaAtleta(e.target.value);
                        setAtletaId('');
                        setBloquearSugestoes(false);
                      }}
                      placeholder="Buscar por nome ou telefone..."
                      className="mb-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      aria-expanded={mostrarSugestoes}
                      aria-controls="lista-sugestoes-atletas"
                    />
                    {mostrarSugestoes && (
                      <div
                        id="lista-sugestoes-atletas"
                        role="listbox"
                        className="mb-2 max-h-56 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm"
                      >
                        {buscandoAtleta && (
                          <div className="px-4 py-2 text-sm text-gray-600" aria-live="polite">
                            Buscando atletas...
                          </div>
                        )}
                        {!buscandoAtleta && sugestoesAtletas.length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-500" aria-live="polite">
                            Nenhum atleta encontrado
                          </div>
                        )}
                        {!buscandoAtleta && sugestoesAtletas.map((a) => (
                          <button
                            key={a.id}
                            role="option"
                            type="button"
                            onClick={() => {
                              setAtletaId(a.id);
                              setBuscaAtleta(a.nome || '');
                              setMostrarSugestoes(false);
                              setBloquearSugestoes(true);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-100 focus:outline-none"
                            aria-selected={atletaId === a.id}
                          >
                            <span className="block text-sm text-gray-900">{a.nome}</span>
                            {a.fone && (
                              <span className="block text-xs text-gray-600">{a.fone}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                  </>
                )}
              </div>
            )}

            {/* Seleção de Atletas Participantes (múltiplos) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Users className="inline w-4 h-4 mr-1" />
                  Atletas Participantes (opcional)
                  {(atletasParticipantesIds.length > 0 || participantesAvulsos.length > 0) && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({atletasParticipantesIds.length + participantesAvulsos.length} selecionado{(atletasParticipantesIds.length + participantesAvulsos.length) !== 1 ? 's' : ''})
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarSelecaoAtletas(!mostrarSelecaoAtletas)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {mostrarSelecaoAtletas ? 'Ocultar' : 'Selecionar'}
                </button>
              </div>
              
              {/* Mostrar participantes selecionados mesmo quando a seleção está oculta */}
              {!mostrarSelecaoAtletas && (atletasParticipantesIds.length > 0 || participantesCompletos.length > 0 || participantesAvulsos.length > 0) && (
                <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs font-medium text-purple-700 mb-2">
                    Participantes adicionados:
                  </p>
                  <div className="space-y-1.5">
                    {/* Participantes avulsos */}
                    {participantesAvulsos.map((avulso) => (
                      <div
                        key={avulso.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-purple-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {avulso.nome} <span className="text-xs text-gray-500 italic">(avulso)</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setParticipantesAvulsos(participantesAvulsos.filter(p => p.id !== avulso.id));
                          }}
                          className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Remover participante"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {participantesCompletos.length > 0 ? (
                      // Usar dados completos do agendamento
                      participantesCompletos.map((participante) => (
                        <div
                          key={participante.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-purple-100"
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
                          <button
                            type="button"
                            onClick={() => {
                              setAtletasParticipantesIds(atletasParticipantesIds.filter(aid => aid !== participante.atletaId));
                              setParticipantesCompletos(participantesCompletos.filter(p => p.id !== participante.id));
                            }}
                            className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Remover participante"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    ) : (
                      // Fallback: tentar encontrar na lista de atletas
                      atletasParticipantesIds.map((id) => {
                        const atleta = atletas.find(a => a.id === id);
                        return atleta ? (
                          <div
                            key={id}
                            className="flex items-center justify-between p-2 bg-white rounded border border-purple-100"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {atleta.nome}
                              </p>
                              {atleta.fone && (
                                <p className="text-xs text-gray-600 truncate">
                                  {atleta.fone}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setAtletasParticipantesIds(atletasParticipantesIds.filter(aid => aid !== id))}
                              className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Remover participante"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div key={id} className="text-xs text-gray-500 p-2">
                            Atleta {id} (não encontrado na lista)
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {mostrarSelecaoAtletas && (
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  {carregandoAtletas ? (
                    <div className="text-center text-gray-600 py-4">
                      Carregando atletas...
                    </div>
                  ) : (
                    <>
                      {/* Campo de busca e adicionar avulso */}
                      <div className="mb-3 flex gap-2">
                        <input
                          type="text"
                          value={buscaAtletasParticipantes}
                          onChange={(e) => setBuscaAtletasParticipantes(e.target.value)}
                          placeholder="Buscar atleta por nome ou telefone..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nomeAvulsoParticipante}
                            onChange={(e) => setNomeAvulsoParticipante(e.target.value)}
                            placeholder="Nome avulso"
                            className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && nomeAvulsoParticipante.trim()) {
                                e.preventDefault();
                                const novoId = `avulso-${Date.now()}-${Math.random()}`;
                                setParticipantesAvulsos([
                                  ...participantesAvulsos,
                                  {
                                    id: novoId,
                                    nome: nomeAvulsoParticipante.trim(),
                                  }
                                ]);
                                setNomeAvulsoParticipante('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (nomeAvulsoParticipante.trim()) {
                                const novoId = `avulso-${Date.now()}-${Math.random()}`;
                                setParticipantesAvulsos([
                                  ...participantesAvulsos,
                                  {
                                    id: novoId,
                                    nome: nomeAvulsoParticipante.trim(),
                                  }
                                ]);
                                setNomeAvulsoParticipante('');
                              }
                            }}
                            disabled={!nomeAvulsoParticipante.trim()}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            <UserPlus className="w-4 h-4 inline mr-1" />
                            Adicionar
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {(() => {
                          const atletasFiltradosParticipantes = !buscaAtletasParticipantes.trim() 
                            ? atletas 
                            : atletas.filter((a) => {
                                const termoNormalizado = normalizarTexto(buscaAtletasParticipantes);
                                const nomeNormalizado = normalizarTexto(a.nome || '');
                                const foneNormalizado = normalizarTexto(a.fone || '');
                                const nomeMatch = nomeNormalizado.includes(termoNormalizado);
                                const foneMatch = foneNormalizado.includes(termoNormalizado);
                                return nomeMatch || foneMatch;
                              });
                          
                          if (atletasFiltradosParticipantes.length === 0 && buscaAtletasParticipantes.trim()) {
                            return (
                              <div className="text-center text-gray-500 py-4">
                                Nenhum atleta encontrado
                              </div>
                            );
                          }
                          
                          return atletasFiltradosParticipantes.map((atleta) => {
                            const isSelected = atletasParticipantesIds.includes(atleta.id);
                            return (
                              <label
                                key={atleta.id}
                                className={`flex items-center gap-3 p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-white border-gray-200 hover:border-blue-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAtletasParticipantesIds([...atletasParticipantesIds, atleta.id]);
                                    } else {
                                      setAtletasParticipantesIds(atletasParticipantesIds.filter(id => id !== atleta.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{atleta.nome}</div>
                                  {atleta.fone && (
                                    <div className="text-xs text-gray-600">{atleta.fone}</div>
                                  )}
                                  {(() => {
                                    const email = atleta.usuario?.email || '';
                                    const isTemp = email.startsWith('temp_') || email.endsWith('@pendente.local');
                                    if (isOrganizer && (!atleta.usuario || isTemp)) {
                                      return (
                                        <div className="text-xs text-gray-600">
                                          Atleta ainda não vinculado a sua arena
                                        </div>
                                      );
                                    }
                                    if (atleta.usuario) {
                                      return (
                                        <div className="text-xs text-blue-600">
                                          Usuário: {atleta.usuario.name} ({atleta.usuario.email})
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </label>
                            );
                          });
                        })()}
                      </div>
                      {(atletasParticipantesIds.length > 0 || participantesAvulsos.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Selecionados: {atletasParticipantesIds.length + participantesAvulsos.length}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {/* Participantes avulsos */}
                            {participantesAvulsos.map((avulso) => (
                              <span
                                key={avulso.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                              >
                                {avulso.nome} <span className="text-xs italic">(avulso)</span>
                                <button
                                  type="button"
                                  onClick={() => setParticipantesAvulsos(participantesAvulsos.filter(p => p.id !== avulso.id))}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {/* Atletas selecionados */}
                            {atletasParticipantesIds.map((id) => {
                              const atleta = atletas.find(a => a.id === id);
                              return atleta ? (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                                >
                                  {atleta.nome}
                                  <button
                                    type="button"
                                    onClick={() => setAtletasParticipantesIds(atletasParticipantesIds.filter(aid => aid !== id))}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    ×
                                  </button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>


            {/* Campos de Aula/Professor */}
            {canGerenciarAgendamento && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={ehAula}
                      onChange={(e) => {
                        setEhAula(e.target.checked);
                        if (!e.target.checked) {
                          setProfessorId(''); // Limpar professor quando desmarcar
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>Este agendamento é para aula/professor</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Quando marcado, o sistema usará o valor de locação para aulas da tabela de preços
                  </p>
                </div>

                {ehAula && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Professor *
                    </label>
                    {carregandoProfessores ? (
                      <div className="text-sm text-gray-500 py-2">Carregando professores...</div>
                    ) : (
                      <select
                        value={professorId}
                        onChange={(e) => setProfessorId(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="">Selecione um professor</option>
                        {professores
                          .filter((p) => p.ativo)
                          .map((professor) => (
                            <option key={professor.id} value={professor.id}>
                              {professor.usuario?.name || 'Professor'} 
                              {professor.especialidade && ` - ${professor.especialidade}`}
                            </option>
                          ))}
                      </select>
                    )}
                    {professores.length === 0 && !carregandoProfessores && (
                      <p className="text-xs text-gray-500 mt-1">
                        Nenhum professor ativo encontrado
                      </p>
                    )}
                  </div>
                )}
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
                  disabled={readOnly || (!pointId && !isOrganizer)}
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

            {/* Informações de Auditoria - apenas para agendamentos existentes */}
            {agendamento && agendamentoCompleto && (agendamentoCompleto.createdBy || agendamentoCompleto.updatedBy) && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Informações de Auditoria</h4>
                <div className="space-y-1.5 text-xs text-gray-600">
                  {agendamentoCompleto.createdBy && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Criado por:</span>
                      <span>{agendamentoCompleto.createdBy.name || agendamentoCompleto.createdBy.email}</span>
                      {agendamentoCompleto.createdAt && (
                        <span className="text-gray-500">
                          em {new Date(agendamentoCompleto.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {agendamentoCompleto.updatedBy && agendamentoCompleto.updatedBy.id !== agendamentoCompleto.createdBy?.id && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Atualizado por:</span>
                      <span>{agendamentoCompleto.updatedBy.name || agendamentoCompleto.updatedBy.email}</span>
                      {agendamentoCompleto.updatedAt && (
                        <span className="text-gray-500">
                          em {new Date(agendamentoCompleto.updatedAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <InputMonetario
                      value={valorNegociado}
                      onChange={setValorNegociado}
                      placeholder="Ex: 90,00"
                      min={0}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-emerald-800">
                      {formatCurrency(valorNegociado ?? valorCalculado)}
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


            {/* Botão Gerar Cards - apenas para agendamentos existentes com valor e com cliente vinculado */}
            {agendamento && canGerenciarAgendamento && (agendamento.valorNegociado || agendamento.valorCalculado) && 
             (agendamento.atletaId || agendamento.nomeAvulso || (agendamento.atletasParticipantes && agendamento.atletasParticipantes.length > 0)) && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-900 mb-2">
                      Gerar Comandas de Cliente
                    </p>
                    <p className="text-xs text-emerald-700 mb-3">
                      Cria uma comanda para cada cliente envolvido no agendamento (original + participantes) com o item "Locação" dividido proporcionalmente. Se o cliente já tiver uma comanda aberta, o item será adicionado à comanda existente.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!agendamento?.id) return;
                        if (!confirm('Deseja gerar comandas de cliente para todos os participantes deste agendamento?')) return;

                        try {
                          setGerandoCards(true);
                          setErro('');
                          const resultado = await agendamentoService.gerarCards(agendamento.id);
                          if (resultado && resultado.mensagem) {
                            // Garantir que os valores sejam números antes de usar toFixed
                            const valorTotal = typeof resultado.valorTotal === 'number' ? resultado.valorTotal : parseFloat(resultado.valorTotal) || 0;
                            const valorPorCliente = typeof resultado.valorPorCliente === 'number' ? resultado.valorPorCliente : parseFloat(resultado.valorPorCliente) || 0;
                            const totalClientes = resultado.totalClientes || 0;
                            const totalCardsCriados = resultado.totalCardsCriados || 0;
                            const totalCardsAtualizados = resultado.totalCardsAtualizados || 0;
                            
                            let mensagemDetalhada = `${resultado.mensagem}\n\n`;
                            mensagemDetalhada += `Valor total: R$ ${valorTotal.toFixed(2)}\n`;
                            mensagemDetalhada += `Valor por cliente: R$ ${valorPorCliente.toFixed(2)}\n`;
                            mensagemDetalhada += `Total de clientes: ${totalClientes}\n`;
                            if (totalCardsCriados > 0) {
                              mensagemDetalhada += `\nCards criados: ${totalCardsCriados}`;
                            }
                            if (totalCardsAtualizados > 0) {
                              mensagemDetalhada += `\nCards atualizados (item adicionado ao card existente): ${totalCardsAtualizados}`;
                            }
                            
                            alert(mensagemDetalhada);
                            onSuccess();
                            onClose(); // Fechar o modal após gerar cards com sucesso
                          } else {
                            throw new Error('Resposta inválida da API');
                          }
                        } catch (error: any) {
                          console.error('Erro completo ao gerar cards:', error);
                          
                          // Verificar se é um erro de rede/timeout
                          const isNetworkError = error?.message?.includes('Failed to fetch') || 
                                                 error?.message?.includes('NetworkError') ||
                                                 error?.message?.includes('cancelada');
                          
                          let mensagemErro = error?.response?.data?.mensagem || 
                                            error?.data?.mensagem || 
                                            error?.message || 
                                            'Erro ao gerar cards';
                          
                          // Se for erro de rede mas os cards podem ter sido criados, verificar no servidor
                          if (isNetworkError) {
                            mensagemErro = 'A requisição pode ter demorado muito, mas os cards podem ter sido criados. Verifique nas comandas.';
                            console.warn('Erro de rede ao gerar cards, mas a operação pode ter sido concluída no servidor');
                          }
                          
                          setErro(mensagemErro);
                          
                          // Não mostrar alert de erro se os cards foram criados (pode ser um erro de parsing)
                          if (!error?.response?.data?.cards && !error?.data?.cards) {
                            alert(`Erro: ${mensagemErro}`);
                          }
                        } finally {
                          setGerandoCards(false);
                        }
                      }}
                      disabled={gerandoCards || salvando || temAlteracoes}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title={temAlteracoes ? 'Salve as alterações antes de gerar cards' : ''}
                    >
                      {gerandoCards ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Gerando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Gerar Cards
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Flag para manter na tela após salvar (apenas para gestores em modo criação) */}
            {canGerenciarAgendamento && !agendamento && (
              <div className="pt-4 pb-2 border-t border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manterNaTela}
                    onChange={(e) => setManterNaTela(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Manter na tela após salvar (limpa apenas quadra e participantes)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Quando marcado, após salvar o agendamento, o formulário permanece aberto com os dados preenchidos, limpando apenas a seleção de quadras e participantes.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors disabled:opacity-50"
              >
                {readOnly ? 'Fechar' : 'Cancelar'}
              </button>
              {!readOnly && (
              <button
                type="submit"
                disabled={salvando || Boolean(conflito) || (agendamento ? !temAlteracoes : false)}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={agendamento && !temAlteracoes ? 'Não há alterações para salvar' : ''}
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
              )}
            </div>
          </form>
        </Dialog.Panel>
      </div>

    </Dialog>
  );
}

