// app/agendar/[pointId]/page.tsx - Página pública de agendamento
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, MapPin, User, Phone, CheckCircle, XCircle, Loader2, X, MessageCircle } from 'lucide-react';

interface Arena {
  id: string;
  nome: string;
  logoUrl?: string;
}

interface Quadra {
  id: string;
  nome: string;
}

interface HorariosDisponiveisResponse {
  horarios: string[];
  quadras: Quadra[];
  arena: Arena;
}

export default function AgendarPublicoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pointId = params?.pointId as string;
  // Aceitar tanto 'usuarioId' quanto 'usuariold' (typo comum) para compatibilidade
  const usuarioIdFromUrl = searchParams?.get('usuarioId') || searchParams?.get('usuariold') || null;

  const [arena, setArena] = useState<Arena | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<Quadra[]>([]);
  const [quadraSelecionada, setQuadraSelecionada] = useState<string>('');
  // Inicializar com a data de hoje
  const hoje = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [carregandoQuadras, setCarregandoQuadras] = useState(false);
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [duracao, setDuracao] = useState(60);
  const [esporteSelecionado, setEsporteSelecionado] = useState<string>('');
  const [esportesDisponiveis, setEsportesDisponiveis] = useState<string[]>([]);
  
  const [buscandoAtleta, setBuscandoAtleta] = useState(false);
  const [criandoAtleta, setCriandoAtleta] = useState(false);
  const [criandoAgendamento, setCriandoAgendamento] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [atletaId, setAtletaId] = useState<string | null>(null);
  const nomeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pointId) {
      carregarArena();
      carregarEsportes();
    }
  }, [pointId]);

  const carregarEsportes = async () => {
    try {
      const response = await fetch(`/api/public/point/${pointId}/esportes`);
      if (response.ok) {
        const data = await response.json();
        setEsportesDisponiveis(data.esportes || []);
      }
    } catch (error) {
      console.error('Erro ao carregar esportes:', error);
    }
  };

  // Resetar quando mudar data ou duração
  useEffect(() => {
    if (!dataSelecionada) {
      setHorariosDisponiveis([]);
      setHorarioSelecionado('');
      setQuadraSelecionada('');
      setQuadrasDisponiveis([]);
    }
  }, [dataSelecionada, duracao]);

  // Rebuscar quadras quando mudar esporte e já tiver horário selecionado
  useEffect(() => {
    if (horarioSelecionado) {
      buscarQuadrasDisponiveis(horarioSelecionado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esporteSelecionado]);

  const carregarArena = async () => {
    try {
      const response = await fetch(`/api/public/point/${pointId}`);
      if (response.ok) {
        const data = await response.json();
        setArena({ id: data.id, nome: data.nome, logoUrl: data.logoUrl });
      } else {
        const errorData = await response.json();
        setErro(errorData.mensagem || 'Arena não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar arena:', error);
      setErro('Erro ao carregar informações da arena');
    }
  };

  const buscarHorariosDisponiveis = async () => {
    if (!dataSelecionada || !pointId) return;
    
    // Se há esportes disponíveis, esporte é obrigatório
    if (esportesDisponiveis.length > 0 && !esporteSelecionado) {
      setErro('Selecione um esporte para buscar horários disponíveis');
      return;
    }

    setCarregandoHorarios(true);
    setErro('');
    setHorarioSelecionado('');

    try {
      const url = `/api/public/agendamento/horarios-disponiveis?pointId=${pointId}&data=${dataSelecionada}&duracao=${duracao}${esporteSelecionado ? `&esporte=${encodeURIComponent(esporteSelecionado)}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao buscar horários');
      }

      const data: HorariosDisponiveisResponse = await response.json();
      setHorariosDisponiveis(data.horarios);
      setQuadras(data.quadras); // Manter todas as quadras para referência
      setArena(data.arena);
      setHorarioSelecionado(''); // Resetar horário selecionado
      setQuadraSelecionada(''); // Resetar quadra selecionada
      setQuadrasDisponiveis([]); // Limpar quadras disponíveis até selecionar horário
    } catch (error: any) {
      console.error('Erro ao buscar horários:', error);
      setErro(error.message || 'Erro ao buscar horários disponíveis');
      setHorariosDisponiveis([]);
    } finally {
      setCarregandoHorarios(false);
    }
  };

  const buscarQuadrasDisponiveis = async (horario: string) => {
    if (!dataSelecionada || !pointId || !horario) return;

    setCarregandoQuadras(true);
    setErro('');
    setQuadraSelecionada(''); // Resetar seleção de quadra

    try {
      const url = `/api/public/agendamento/quadras-disponiveis?pointId=${pointId}&data=${dataSelecionada}&horario=${horario}&duracao=${duracao}${esporteSelecionado ? `&esporte=${encodeURIComponent(esporteSelecionado)}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao buscar quadras disponíveis');
      }

      const data = await response.json();
      setQuadrasDisponiveis(data.quadras);
      
      // Selecionar primeira quadra automaticamente se houver apenas uma
      if (data.quadras.length === 1) {
        setQuadraSelecionada(data.quadras[0].id);
      }
    } catch (error: any) {
      console.error('Erro ao buscar quadras disponíveis:', error);
      setErro(error.message || 'Erro ao buscar quadras disponíveis');
      setQuadrasDisponiveis([]);
    } finally {
      setCarregandoQuadras(false);
    }
  };

  const handleHorarioClick = (horario: string) => {
    setHorarioSelecionado(horario);
    buscarQuadrasDisponiveis(horario);
  };

  const formatarTelefone = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Formata como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarTelefone(e.target.value);
    setTelefone(formatted);
    // Resetar atletaId e nome quando telefone mudar
    if (atletaId) {
      setAtletaId(null);
      setNome('');
    }
  };

  const buscarAtletaPorTelefone = async (telefoneParaBuscar: string) => {
    const telefoneNormalizado = telefoneParaBuscar.replace(/\D/g, '');
    
    // Só buscar se tiver pelo menos 10 dígitos
    if (telefoneNormalizado.length < 10) {
      return;
    }

    setBuscandoAtleta(true);
    setErro('');

    try {
      const response = await fetch(
        `/api/public/atleta/buscar-por-telefone?telefone=${encodeURIComponent(telefoneNormalizado)}`
      );

      if (!response.ok) {
        // Se não encontrou, não é erro - apenas não tem atleta cadastrado
        if (response.status === 404) {
          // Atleta não encontrado - usuário vai preencher nome
          setAtletaId(null);
          if (!nome.trim()) {
            setNome('');
          }
          return;
        }
        throw new Error('Erro ao buscar atleta');
      }

      const data = await response.json();
      
      if (data.encontrado && data.atleta) {
        // Atleta encontrado - preencher nome e atletaId automaticamente
        setNome(data.atleta.nome);
        setAtletaId(data.atleta.id);
        // Posicionar cursor no campo nome após buscar
        setTimeout(() => {
          nomeInputRef.current?.focus();
        }, 100);
      } else {
        // Atleta não encontrado - manter nome se já foi preenchido
        setAtletaId(null);
        if (!nome.trim()) {
          setNome('');
        }
        // Posicionar cursor no campo nome mesmo quando não encontrou
        setTimeout(() => {
          nomeInputRef.current?.focus();
        }, 100);
      }
    } catch (error: any) {
      console.error('Erro ao buscar atleta:', error);
      // Não mostrar erro - apenas deixar usuário preencher manualmente
      setAtletaId(null);
      // Posicionar cursor no campo nome mesmo em caso de erro
      setTimeout(() => {
        nomeInputRef.current?.focus();
      }, 100);
    } finally {
      setBuscandoAtleta(false);
    }
  };

  const criarAtletaTemporario = async () => {
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone');
      return;
    }

    setCriandoAtleta(true);
    setErro('');

    try {
      const response = await fetch('/api/public/atleta/temporario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, ''), // Remove formatação
          pointId,
          usuarioId: usuarioIdFromUrl, // Passar usuarioId da URL se disponível
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Melhorar mensagem de erro se não tiver usuarioId
        let mensagemErro = errorData.mensagem || 'Erro ao criar perfil temporário';
        if (mensagemErro.includes('usuarioId') && !usuarioIdFromUrl) {
          mensagemErro = 'É necessário informar um usuarioId válido. Verifique se o link está correto ou faça login primeiro.';
        }
        throw new Error(mensagemErro);
      }

      const data = await response.json();
      setAtletaId(data.id);
      return data.id;
    } catch (error: any) {
      console.error('Erro ao criar atleta temporário:', error);
      setErro(error.message || 'Erro ao criar perfil temporário');
      throw error;
    } finally {
      setCriandoAtleta(false);
    }
  };

  const criarAgendamento = async (atletaIdParaUsar?: string | null) => {
    if (!dataSelecionada || !horarioSelecionado) {
      setErro('Selecione data e horário');
      return;
    }

    if (!quadraSelecionada) {
      setErro('Selecione uma quadra');
      return;
    }

    // Usar o atletaId passado como parâmetro ou do estado
    const atletaIdFinal = atletaIdParaUsar || atletaId;
    
    if (!atletaIdFinal) {
      setErro('Erro: perfil temporário não foi criado');
      return;
    }

    if (quadras.length === 0) {
      setErro('Nenhuma quadra disponível');
      return;
    }

    setCriandoAgendamento(true);
    setErro('');

    try {
      // Usar a quadra selecionada pelo usuário
      const quadraId = quadraSelecionada;
      const dataHora = `${dataSelecionada}T${horarioSelecionado}:00`;

      const response = await fetch('/api/public/agendamento/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadraId,
          dataHora,
          duracao,
          atletaId: atletaIdFinal,
          usuarioId: usuarioIdFromUrl, // Passar usuarioId da URL se disponível
          pointId, // Passar pointId para validação de segurança
          observacoes: `Agendamento público - ${nome}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao criar agendamento');
      }

      const data = await response.json();
      setSucesso(true);
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      setErro(error.message || 'Erro ao criar agendamento');
    } finally {
      setCriandoAgendamento(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    try {
      // Se já tem atletaId (encontrado pela busca de telefone), usar ele diretamente
      // Se não tem, criar atleta temporário primeiro
      let atletaIdFinal = atletaId;
      if (!atletaIdFinal) {
        // Validar se tem nome e telefone para criar
        if (!nome.trim() || !telefone.trim()) {
          setErro('Preencha nome e telefone');
          return;
        }
        // Criar atleta temporário
        atletaIdFinal = await criarAtletaTemporario();
        // Garantir que o estado foi atualizado
        if (atletaIdFinal) {
          setAtletaId(atletaIdFinal);
        }
      }

      // Criar agendamento passando o atletaIdFinal diretamente
      await criarAgendamento(atletaIdFinal);
    } catch (error) {
      // Erro já foi tratado nas funções
    }
  };

  // Data mínima: hoje (já definida acima)
  // Data máxima: 30 dias a partir de hoje
  const dataMaxima = new Date();
  dataMaxima.setDate(dataMaxima.getDate() + 30);
  const dataMaximaStr = dataMaxima.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            {arena?.logoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={arena.logoUrl}
                  alt={`Logo ${arena.nome}`}
                  className="h-20 w-auto object-contain"
                />
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Agendar Quadra
            </h1>
            {arena && (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <MapPin className="w-5 h-5" />
                <p className="text-lg font-medium">{arena.nome}</p>
              </div>
            )}
          </div>

          {/* Modal de sucesso */}
          {sucesso && (
<<<<<<< HEAD
            <div className="mb-6 p-6 bg-green-50 border-2 border-green-300 rounded-lg relative">
              <button
                onClick={() => {
                  setSucesso(false);
                  // Limpar formulário ao fechar
                  setNome('');
                  setTelefone('');
                  setDataSelecionada('');
                  setHorarioSelecionado('');
                  setQuadraSelecionada('');
                  setHorariosDisponiveis([]);
                  setQuadrasDisponiveis([]);
                  setAtletaId(null);
                }}
                className="absolute top-3 right-3 text-green-600 hover:text-green-800 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 text-lg mb-2">
                    Agendamento realizado com sucesso!
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Você receberá uma confirmação por WhatsApp em breve.
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      Clique no botão X acima para fechar e fazer um novo agendamento.
                    </p>
                  </div>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
                <button
                  onClick={() => {
                    setSucesso(false);
                    // Limpar formulário ao fechar
                    setNome('');
                    setTelefone('');
                    setDataSelecionada(hoje);
                    setHorarioSelecionado('');
                    setQuadraSelecionada('');
                    setHorariosDisponiveis([]);
                    setQuadrasDisponiveis([]);
                    setAtletaId(null);
                    setEsporteSelecionado('');
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="text-center">
                  {/* Logo da arena */}
                  {arena?.logoUrl && (
                    <div className="flex justify-center mb-6">
                      <img
                        src={arena.logoUrl}
                        alt={`Logo ${arena.nome}`}
                        className="h-24 w-auto object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Ícone de sucesso */}
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                  </div>
                  
                  {/* Título */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Agendamento Confirmado!
                  </h2>
                  
                  {/* Mensagem */}
                  <p className="text-gray-600 mb-6">
                    Seu agendamento foi realizado com sucesso.
                  </p>
                  
                  {/* Informação sobre WhatsApp */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <MessageCircle className="w-5 h-5" />
                      <p className="text-sm font-medium">
                        Você receberá uma confirmação por WhatsApp em breve.
                      </p>
                    </div>
                  </div>
                  
                  {/* Botão de fechar */}
                  <button
                    onClick={() => {
                      setSucesso(false);
                      // Limpar formulário ao fechar
                      setNome('');
                      setTelefone('');
                      setDataSelecionada(hoje);
                      setHorarioSelecionado('');
                      setQuadraSelecionada('');
                      setHorariosDisponiveis([]);
                      setQuadrasDisponiveis([]);
                      setAtletaId(null);
                      setEsporteSelecionado('');
                    }}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Fazer Novo Agendamento
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de erro */}
          {erro && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <p className="text-red-900">{erro}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados pessoais */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                Seus Dados
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    onBlur={() => {
                      if (telefone.trim()) {
                        buscarAtletaPorTelefone(telefone);
                      }
                    }}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-10"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                  {buscandoAtleta && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    </div>
                  )}
                </div>
                {atletaId && (
                  <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Atleta encontrado! Nome preenchido automaticamente.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  ref={nomeInputRef}
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  disabled={buscandoAtleta}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={atletaId ? "Nome do atleta" : "Seu nome completo"}
                />
                {atletaId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Você pode editar o nome se necessário
                  </p>
                )}
              </div>
            </div>

            {/* Seleção de data e horário */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Data e Horário
              </h2>

              {/* Filtro de esporte - deve vir antes de buscar horários */}
              {esportesDisponiveis.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Esporte *
                  </label>
                  <select
                    value={esporteSelecionado}
                    onChange={(e) => {
                      setEsporteSelecionado(e.target.value);
                      // Limpar horários e quadras quando mudar esporte
                      setHorariosDisponiveis([]);
                      setHorarioSelecionado('');
                      setQuadraSelecionada('');
                      setQuadrasDisponiveis([]);
                    }}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Selecione um esporte</option>
                    {esportesDisponiveis.map((esporte) => (
                      <option key={esporte} value={esporte}>
                        {esporte}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Selecione o esporte para ver os horários disponíveis
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={dataSelecionada}
                    onChange={(e) => setDataSelecionada(e.target.value)}
                    min={hoje}
                    max={dataMaximaStr}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duração (minutos) *
                  </label>
                  <select
                    value={duracao}
                    onChange={(e) => setDuracao(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
              </div>

              {/* Botão para buscar horários */}
              {dataSelecionada && (
                <div>
                  <button
                    type="button"
                    onClick={buscarHorariosDisponiveis}
                    disabled={carregandoHorarios || !dataSelecionada || (esportesDisponiveis.length > 0 && !esporteSelecionado)}
                    className="w-full py-2 px-4 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {carregandoHorarios ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Buscando horários...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-5 h-5" />
                        Buscar Horários Disponíveis
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Horários disponíveis */}
              {dataSelecionada && horariosDisponiveis.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horário Disponível *
                  </label>
                  {carregandoHorarios ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="ml-2 text-gray-600">Buscando horários...</span>
                    </div>
                  ) : horariosDisponiveis.length === 0 && dataSelecionada ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      Nenhum horário disponível para esta data e duração. Tente outra data ou duração.
                    </p>
                  ) : horariosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {horariosDisponiveis.map((horario) => (
                        <button
                          key={horario}
                          type="button"
                          onClick={() => handleHorarioClick(horario)}
                          className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                            horarioSelecionado === horario
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          <Clock className="w-4 h-4 inline mr-1" />
                          {horario}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Seleção de quadra - aparece apenas após selecionar horário */}
              {horarioSelecionado && (
                <div>
                  {carregandoQuadras ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="ml-2 text-gray-600">Buscando quadras disponíveis...</span>
                    </div>
                  ) : quadrasDisponiveis.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quadra Disponível *
                      </label>
                      <select
                        value={quadraSelecionada}
                        onChange={(e) => setQuadraSelecionada(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Selecione uma quadra</option>
                        {quadrasDisponiveis.map((quadra) => (
                          <option key={quadra.id} value={quadra.id}>
                            {quadra.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {esporteSelecionado 
                          ? `Nenhuma quadra disponível para ${esporteSelecionado} no horário selecionado. Tente outro horário ou esporte.`
                          : 'Nenhuma quadra disponível para o horário selecionado. Tente outro horário.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={buscandoAtleta || criandoAtleta || criandoAgendamento || !dataSelecionada || !horarioSelecionado || !quadraSelecionada || !nome.trim() || !telefone.trim() || sucesso}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {criandoAtleta ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Criando perfil...
                </>
              ) : criandoAgendamento ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirmando agendamento...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Agendamento
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

