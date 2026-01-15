// app/app/arena/agendamentos/page.tsx - Agenda da arena
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import ConfirmarExclusaoRecorrenteModal from '@/components/ConfirmarExclusaoRecorrenteModal';
import QuadrasDisponiveisPorHorarioModal from '@/components/QuadrasDisponiveisPorHorarioModal';
import type { Quadra, Agendamento, StatusAgendamento, BloqueioAgenda } from '@/types/agendamento';
import { Calendar, Clock, MapPin, X, CheckCircle, XCircle, CalendarCheck, User, Users, UserPlus, Edit, Plus, Search, Lock, Smartphone, UserCog, GraduationCap, Phone } from 'lucide-react';
import { api } from '@/lib/api';

interface ModalCriarUsuarioIncompletoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalCriarUsuarioIncompleto({ isOpen, onClose, onSuccess }: ModalCriarUsuarioIncompletoProps) {
  const { usuario } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [atletaEncontrado, setAtletaEncontrado] = useState<{ id: string; nome: string; telefone: string } | null>(null);
  const [modo, setModo] = useState<'buscar' | 'criar' | 'vincular'>('buscar');
  const telefoneInputRef = useRef<HTMLInputElement>(null);

  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  const handleBuscarTelefone = async () => {
    if (!telefone.trim()) {
      setErro('Informe o telefone');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setBuscando(true);
    setErro('');
    setAtletaEncontrado(null);

    try {
      // Buscar atleta por telefone
      const { data, status } = await api.post('/user/atleta/buscar-por-telefone', {
        telefone: telefoneNormalizado,
      });

      if (status === 200 && data.existe) {
        // Atleta encontrado - mostrar opção de vincular
        setAtletaEncontrado({
          id: data.id,
          nome: data.nome,
          telefone: data.telefone,
        });
        setModo('vincular');
      } else {
        // Atleta não encontrado - modo criar
        setModo('criar');
      }
    } catch (err: any) {
      if (err?.response?.data?.codigo === 'ATLETA_NAO_ENCONTRADO' || err?.response?.status === 404) {
        // Atleta não encontrado - modo criar
        setModo('criar');
      } else {
        setErro(err?.response?.data?.mensagem || 'Erro ao buscar telefone. Tente novamente.');
      }
    } finally {
      setBuscando(false);
    }
  };

  const handleVincularAtleta = async () => {
    if (!atletaEncontrado) return;

    setSalvando(true);
    setErro('');

    try {
      const { data, status } = await api.post(`/atleta/${atletaEncontrado.id}/vincular-arena`);

      if (status === 200) {
        alert(`Atleta "${atletaEncontrado.nome}" vinculado à arena com sucesso!`);
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao vincular atleta');
      }
    } catch (err: any) {
      // Tratar caso especial: atleta já vinculado
      if (err?.response?.data?.codigo === 'ATLETA_JA_VINCULADO' || err?.response?.data?.jaVinculado) {
        // Mostrar mensagem informativa (não é erro crítico)
        alert(err?.response?.data?.mensagem || `O atleta "${atletaEncontrado.nome}" já está vinculado à sua arena.`);
        resetarModal();
        onClose();
      } else {
        setErro(
          err?.response?.data?.mensagem ||
            err?.response?.data?.error ||
            'Erro ao vincular atleta. Tente novamente.'
        );
        console.error('Erro ao vincular atleta:', err);
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (!nome.trim() || !telefone.trim()) {
      setErro('Nome e telefone são obrigatórios');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setSalvando(true);
    try {
      const { data, status } = await api.post('/user/criar-incompleto', {
        name: nome.trim(),
        telefone: telefoneNormalizado,
      });

      if (status === 201) {
        alert('Usuário criado com sucesso! Ele poderá completar o cadastro usando o telefone no appatleta.');
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao criar usuário');
      }
    } catch (err: any) {
      setErro(
        err?.response?.data?.mensagem ||
          err?.response?.data?.error ||
          'Erro ao criar usuário. Verifique os dados.'
      );
      console.error('Erro ao criar usuário incompleto:', err);
    } finally {
      setSalvando(false);
    }
  };

  const resetarModal = () => {
    setNome('');
    setTelefone('');
    setErro('');
    setAtletaEncontrado(null);
    setModo('buscar');
  };

  const handleClose = () => {
    resetarModal();
    onClose();
  };

  // Focar no campo de telefone quando a modal abrir no modo buscar
  useEffect(() => {
    if (isOpen && modo === 'buscar' && telefoneInputRef.current) {
      // Pequeno delay para garantir que a modal está renderizada
      setTimeout(() => {
        telefoneInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, modo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
          onClick={handleClose}
          disabled={salvando || buscando}
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold mb-4">Criar / Vincular Atleta</h3>

        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {erro}
          </div>
        )}

        {modo === 'buscar' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Informe o telefone do atleta. Se ele já estiver cadastrado, você poderá vinculá-lo à sua arena.
            </p>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={telefoneInputRef}
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={buscando}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={buscando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBuscarTelefone}
                disabled={buscando || telefone.replace(/\D/g, '').length < 10}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        )}

        {modo === 'vincular' && atletaEncontrado && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Atleta encontrado:</strong>
              </p>
              <p className="text-lg font-semibold text-gray-900">{atletaEncontrado.nome}</p>
              <p className="text-sm text-gray-600 mt-1">Telefone: {formatarTelefone(atletaEncontrado.telefone)}</p>
            </div>

            <p className="text-sm text-gray-600">
              Deseja vincular este atleta à sua arena? Ele aparecerá na sua lista de atletas.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setAtletaEncontrado(null);
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleVincularAtleta}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Vinculando...' : 'Vincular à Arena'}
              </button>
            </div>
          </div>
        )}

        {modo === 'criar' && (
          <form onSubmit={handleCriarUsuario} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Telefone não encontrado. Crie um novo usuário pendente que poderá se vincular posteriormente usando o telefone no appatleta.
            </p>

            <div>
              <label className="block font-semibold mb-1">Nome completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nome do usuário"
                required
                disabled={salvando}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={salvando}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O usuário usará este telefone para vincular a conta no appatleta
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setNome('');
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ArenaAgendamentosPage() {
  const router = useRouter();
  const { usuario, isAdmin, isOrganizer } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [quadraSelecionada, setQuadraSelecionada] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | ''>('');
  const [filtroDuracao, setFiltroDuracao] = useState<number | ''>('');
  const [filtroNome, setFiltroNome] = useState('');
  const [mostrarAntigos, setMostrarAntigos] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [agendamentoExcluindo, setAgendamentoExcluindo] = useState<Agendamento | null>(null);
  const [modalHorariosAberto, setModalHorariosAberto] = useState(false);
  const [dataInicialModal, setDataInicialModal] = useState<string | undefined>(undefined);
  const [horaInicialModal, setHoraInicialModal] = useState<string | undefined>(undefined);
  const [duracaoInicialModal, setDuracaoInicialModal] = useState<number | undefined>(undefined);
  const [modalCriarUsuarioIncompleto, setModalCriarUsuarioIncompleto] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || (navigator as any).vendor || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    if (isMobile) {
      router.replace('/app/arena/agendamentos/agenda-mobile');
    }
  }, [router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    carregarAgendamentos();
  }, [quadraSelecionada, filtroStatus, filtroDuracao, mostrarAntigos]);

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
      if (filtroDuracao) filtros.duracao = filtroDuracao;
      
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

  const handleSelecionarHorario = (data: string, hora: string, duracao: number) => {
    setModalHorariosAberto(false);
    // Redirecionar para a página de novo agendamento com os parâmetros
    router.push(`/app/arena/agendamentos/novo?data=${encodeURIComponent(data)}&hora=${encodeURIComponent(hora)}&duracao=${duracao}`);
  };

  // Obter pointIds permitidos (para organizador, apenas o pointIdGestor; para admin, todos)
  const pointIdsPermitidos = useMemo(() => {
    if (isAdmin) {
      // Admin pode ver todas as quadras, então não filtra
      return undefined;
    }
    if (isOrganizer && usuario?.pointIdGestor) {
      return [usuario.pointIdGestor];
    }
    return [];
  }, [isAdmin, isOrganizer, usuario?.pointIdGestor]);

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

  // Identifica se o agendamento foi criado pelo próprio atleta ou pelo organizer/admin
  const foiCriadoPeloAtleta = (agendamento: Agendamento): boolean => {
    // Se tem atleta vinculado e o usuarioId do agendamento é o mesmo do atleta, foi criado pelo atleta
    if (agendamento.atletaId && agendamento.atleta?.usuarioId && agendamento.usuarioId) {
      return agendamento.usuarioId === agendamento.atleta.usuarioId;
    }
    // Caso contrário, foi criado pelo organizer/admin
    return false;
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
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <GraduationCap className="w-3 h-3" />
          Aula
          {agendamento.professor?.usuario?.name && (
            <span className="text-green-600">({agendamento.professor.usuario.name})</span>
          )}
        </span>
      );
    }
    
    if (agendamento.atletaId && agendamento.atleta) {
      const criadoPeloAtleta = foiCriadoPeloAtleta(agendamento);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          <Users className="w-3 h-3" />
          Atleta
          {criadoPeloAtleta ? (
            <span title="Criado pelo atleta">
              <Smartphone className="w-3 h-3" />
            </span>
          ) : (
            <span title="Criado pelo organizer">
              <UserCog className="w-3 h-3" />
            </span>
          )}
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
    // Se for aula/professor, mostrar informações do professor primeiro
    if (agendamento.ehAula && agendamento.professor) {
      return {
        nome: agendamento.professor.usuario?.name || agendamento.professor.especialidade || 'Professor',
        contato: agendamento.professor.usuario?.email || '—',
        tipo: 'Professor/Aula',
      };
    }
    
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
    let lista = agendamentos;
    if (filtroNome.trim()) {
      const termoBusca = filtroNome.toLowerCase().trim();
      const termoBuscaNumerico = termoBusca.replace(/\D/g, '');

      lista = lista.filter((ag) => {
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

    if (filtroDuracao) {
      lista = lista.filter((ag) => ag.duracao === filtroDuracao);
    }

    return lista;
  }, [agendamentos, filtroNome, filtroDuracao]);

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
        <div className="flex flex-col sm:flex-row gap-2">
          {(isAdmin || isOrganizer) && (
            <button
              onClick={() => setModalCriarUsuarioIncompleto(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <UserPlus className="w-5 h-5" />
              Criar / Vincular Atleta
            </button>
          )}
          <button
            onClick={() => {
              setModalHorariosAberto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
          >
            <Clock className="w-4 h-4" />
            Ver horários disponíveis
          </button>
          <button
            onClick={() => {
              setAgendamentoEditando(null);
              setDataInicialModal(undefined);
              setHoraInicialModal(undefined);
              setDuracaoInicialModal(undefined);
              setModalEditarAberto(true);
            }}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duração</label>
              <select
                value={filtroDuracao === '' ? '' : String(filtroDuracao)}
                onChange={(e) => setFiltroDuracao(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Todas</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
                <option value="150">150 min</option>
                <option value="180">180 min</option>
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

      {/* Modal de Horários Disponíveis */}
      <QuadrasDisponiveisPorHorarioModal
        isOpen={modalHorariosAberto}
        onClose={() => setModalHorariosAberto(false)}
        dataInicial={dataInicialModal}
        duracaoInicial={duracaoInicialModal}
        onSelecionarHorario={handleSelecionarHorario}
        pointIdsPermitidos={pointIdsPermitidos}
      />

      {/* Modal de Edição */}
      <EditarAgendamentoModal
        isOpen={modalEditarAberto}
        agendamento={agendamentoEditando}
        dataInicial={dataInicialModal}
        horaInicial={horaInicialModal}
        onClose={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
          setDataInicialModal(undefined);
          setHoraInicialModal(undefined);
          setDuracaoInicialModal(undefined);
        }}
        onSuccess={() => {
          carregarAgendamentos();
          // Limpar dados iniciais após sucesso
          setDataInicialModal(undefined);
          setHoraInicialModal(undefined);
          setDuracaoInicialModal(undefined);
          // O componente agora mantém o modal aberto se a flag estiver marcada
          // Então só fechamos se não houver flag marcada (comportamento normal)
          // O componente gerencia isso internamente, não precisamos fazer nada aqui
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

      {/* Modal Criar / Vincular Atleta */}
      <ModalCriarUsuarioIncompleto
        isOpen={modalCriarUsuarioIncompleto}
        onClose={() => setModalCriarUsuarioIncompleto(false)}
        onSuccess={() => {
          // Pode recarregar dados se necessário
        }}
      />
    </div>
  );
}
