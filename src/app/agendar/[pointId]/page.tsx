// app/agendar/[pointId]/page.tsx - Página pública de agendamento
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, MapPin, User, Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Arena {
  id: string;
  nome: string;
  endereco?: string | null;
  logoUrl?: string | null;
  regiaoId?: string | null;
}

interface Quadra {
  id: string;
  nome: string;
}

interface Apoiador {
  id: string;
  nome: string;
  logoUrl?: string | null;
  exibirColorido?: boolean;
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
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [duracao, setDuracao] = useState(60);
  
  const [criandoAtleta, setCriandoAtleta] = useState(false);
  const [criandoAgendamento, setCriandoAgendamento] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [atletaId, setAtletaId] = useState<string | null>(null);
  const [apoiadores, setApoiadores] = useState<Apoiador[]>([]);
  const [indiceApoiador, setIndiceApoiador] = useState(0);

  useEffect(() => {
    if (pointId) {
      carregarArena();
    }
  }, [pointId]);

  useEffect(() => {
    if (arena) {
      buscarApoiadores(arena.regiaoId || null);
    }
  }, [arena]);

  useEffect(() => {
    if (apoiadores.length > 1) {
      const interval = setInterval(() => {
        setIndiceApoiador((prev) => (prev + 1) % apoiadores.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [apoiadores]);

  useEffect(() => {
    if (dataSelecionada && pointId) {
      buscarHorariosDisponiveis();
    } else {
      setHorariosDisponiveis([]);
      setHorarioSelecionado('');
    }
  }, [dataSelecionada, pointId, duracao]);

  const carregarArena = async () => {
    try {
      const response = await fetch(`/api/public/point/${pointId}`);
      if (response.ok) {
        const data = await response.json();
        setArena({
          id: data.id,
          nome: data.nome,
          endereco: data.endereco || null,
          logoUrl: data.logoUrl || null,
          regiaoId: data.regiaoId || null,
        });
      } else {
        const errorData = await response.json();
        setErro(errorData.mensagem || 'Arena não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar arena:', error);
      setErro('Erro ao carregar informações da arena');
    }
  };

  const buscarApoiadores = async (regiaoId: string | null) => {
    try {
      const url = regiaoId ? `/api/apoiadores?regiaoId=${regiaoId}` : `/api/apoiadores`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setApoiadores(data);
      }
    } catch (error) {
      console.error('Erro ao buscar apoiadores:', error);
    }
  };

  const buscarHorariosDisponiveis = async () => {
    if (!dataSelecionada || !pointId) return;

    setCarregandoHorarios(true);
    setErro('');
    setHorarioSelecionado('');

    try {
      const response = await fetch(
        `/api/public/agendamento/horarios-disponiveis?pointId=${pointId}&data=${dataSelecionada}&duracao=${duracao}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao buscar horários');
      }

      const data: HorariosDisponiveisResponse = await response.json();
      setHorariosDisponiveis(data.horarios);
      setQuadras(data.quadras);
      setArena((prev) => ({ ...(prev || {}), ...data.arena }));
    } catch (error: any) {
      console.error('Erro ao buscar horários:', error);
      setErro(error.message || 'Erro ao buscar horários disponíveis');
      setHorariosDisponiveis([]);
    } finally {
      setCarregandoHorarios(false);
    }
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
      // Usar a primeira quadra disponível (ou poderia ter seleção de quadra)
      const quadraId = quadras[0].id;
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
          observacoes: `Agendamento público - ${nome}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao criar agendamento');
      }

      const data = await response.json();
      setSucesso(true);
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        setNome('');
        setTelefone('');
        setDataSelecionada('');
        setHorarioSelecionado('');
        setAtletaId(null);
        setSucesso(false);
      }, 5000);
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
      // Se ainda não tem atletaId, criar primeiro
      let atletaIdFinal = atletaId;
      if (!atletaIdFinal) {
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

  // Data mínima: hoje
  const hoje = new Date().toISOString().split('T')[0];
  // Data máxima: 30 dias a partir de hoje
  const dataMaxima = new Date();
  dataMaxima.setDate(dataMaxima.getDate() + 30);
  const dataMaximaStr = dataMaxima.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-8 px-4 flex items-center justify-center">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Coluna Esquerda: Dados da Arena + Formulário */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Agendar Quadra
              </h1>
              {arena && (
                <div className="flex flex-col items-center gap-2">
                  {arena.logoUrl ? (
                    <div className="h-20 w-20 rounded-xl bg-white shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={arena.logoUrl}
                        alt={arena.nome}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : null}

                  <p className="text-lg font-medium text-emerald-700">{arena.nome}</p>

                  {arena.endereco ? (
                    <div className="flex items-center justify-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <p className="text-sm">{arena.endereco}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Mensagem de sucesso */}
            {sucesso && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900">Agendamento realizado com sucesso!</p>
                  <p className="text-sm text-green-700">
                    Você receberá uma confirmação em breve.
                  </p>
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
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>

              {/* Seleção de data e horário */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data e Horário
                </h2>

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

                {/* Horários disponíveis */}
                {dataSelecionada && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário Disponível *
                    </label>
                    {carregandoHorarios ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="ml-2 text-gray-600">Buscando horários...</span>
                      </div>
                    ) : horariosDisponiveis.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        {dataSelecionada ? 'Nenhum horário disponível para esta data' : 'Selecione uma data'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                        {horariosDisponiveis.map((horario) => (
                          <button
                            key={horario}
                            type="button"
                            onClick={() => setHorarioSelecionado(horario)}
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
                    )}
                  </div>
                )}
              </div>

              {/* Botão de submit */}
              <button
                type="submit"
                disabled={criandoAtleta || criandoAgendamento || !dataSelecionada || !horarioSelecionado || !nome.trim() || !telefone.trim()}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(criandoAtleta || criandoAgendamento) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {criandoAtleta ? 'Criando perfil...' : 'Agendando...'}
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

        {/* Coluna Direita: Apoiadores (Slideshow) */}
        <div className="flex flex-col justify-center h-full sticky top-8">
          {apoiadores.length > 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-12 flex flex-col items-center justify-center min-h-[500px] text-center transition-all duration-500 border border-white/50">
              <h3 className="text-sm font-medium text-gray-500 mb-8 uppercase tracking-wider">
                Nossos Apoiadores
              </h3>
              
              <div className="flex-1 flex items-center justify-center w-full">
                {apoiadores.map((apoiador, index) => (
                  <div 
                    key={apoiador.id} 
                    className={`transition-all duration-1000 absolute ${
                      index === indiceApoiador ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  >
                    {apoiador.logoUrl ? (
                      <div className="flex flex-col items-center gap-6">
                        <div className="h-48 w-auto relative">
                          <img
                            src={apoiador.logoUrl}
                            alt={apoiador.nome}
                            className={`h-full w-auto object-contain drop-shadow-lg ${apoiador.exibirColorido ? '' : 'filter grayscale'}`}
                          />
                        </div>
                        <span className="text-2xl font-bold text-gray-700">{apoiador.nome}</span>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-gray-600">{apoiador.nome}</span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Indicadores */}
              <div className="flex gap-2 mt-8">
                {apoiadores.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === indiceApoiador ? 'w-8 bg-emerald-500' : 'w-2 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 text-center text-gray-500 border border-white/30 hidden lg:block">
              <p>Agende sua quadra de forma rápida e fácil.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
