// app/app/arena/panelinhas/[id]/page.tsx - Detalhes da Panelinha e Gerenciamento de Jogos
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, Trophy, Calendar, MapPin, Plus, Edit, Save, X, 
  ArrowLeft, Trophy as TrophyIcon, Gamepad2 
} from 'lucide-react';
import Link from 'next/link';

interface Panelinha {
  id: string;
  nome: string;
  descricao?: string;
  esporte?: string;
  atletaIdCriador: string;
  ehCriador: boolean;
  totalMembros: number;
  membros: Array<{
    id: string;
    nome: string;
    fotoUrl?: string;
    telefone?: string;
    dataNascimento?: string;
    genero?: string;
    categoria?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Jogo {
  id: string;
  data: string;
  local?: string;
  pointId?: string;
  gamesTime1?: number | null;
  gamesTime2?: number | null;
  tiebreakTime1?: number | null;
  tiebreakTime2?: number | null;
  atleta1?: { id: string; nome: string; fotoUrl?: string } | null;
  atleta2?: { id: string; nome: string; fotoUrl?: string } | null;
  atleta3?: { id: string; nome: string; fotoUrl?: string } | null;
  atleta4?: { id: string; nome: string; fotoUrl?: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Ranking {
  atletaId: string;
  nome: string;
  fotoUrl?: string;
  jogos: number;
  vitorias: number;
  derrotas: number;
  gamesGanhos: number;
  gamesPerdidos: number;
  porcentagemVitorias: number;
  pontos: number;
  posicao: number;
}

export default function PanelinhaDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [panelinha, setPanelinha] = useState<Panelinha | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'ranking' | 'membros'>('jogos');
  const [modalNovoJogo, setModalNovoJogo] = useState(false);
  const [modalEditarPlacar, setModalEditarPlacar] = useState<Jogo | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [formJogo, setFormJogo] = useState({
    data: '',
    local: '',
    pointId: '',
    atleta1Id: '',
    atleta2Id: '',
    atleta3Id: '',
    atleta4Id: '',
    gamesTime1: '',
    gamesTime2: '',
    tiebreakTime1: '',
    tiebreakTime2: '',
  });

  const [formPlacar, setFormPlacar] = useState({
    gamesTime1: '',
    gamesTime2: '',
    tiebreakTime1: '',
    tiebreakTime2: '',
  });

  useEffect(() => {
    if (id) {
      carregarPanelinha();
      if (abaAtiva === 'jogos') {
        carregarJogos();
      } else if (abaAtiva === 'ranking') {
        carregarRanking();
      }
    }
  }, [id, abaAtiva]);

  const carregarPanelinha = async () => {
    try {
      setLoading(true);
      setErro('');
      const { data } = await api.get(`/user/panelinha/${id}`);
      setPanelinha(data);
    } catch (error: any) {
      console.error('Erro ao carregar panelinha:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar panelinha');
    } finally {
      setLoading(false);
    }
  };

  const carregarJogos = async () => {
    try {
      const { data } = await api.get(`/user/panelinha/${id}/jogos`);
      setJogos(data.jogos || []);
    } catch (error: any) {
      console.error('Erro ao carregar jogos:', error);
    }
  };

  const carregarRanking = async () => {
    try {
      const { data } = await api.get(`/user/panelinha/${id}/ranking`);
      setRanking(data.ranking || []);
    } catch (error: any) {
      console.error('Erro ao carregar ranking:', error);
    }
  };

  const handleAbrirModalNovoJogo = () => {
    const hoje = new Date();
    hoje.setHours(hoje.getHours() + 1);
    setFormJogo({
      data: hoje.toISOString().slice(0, 16),
      local: usuario?.pointIdGestor ? 'Arena' : '',
      pointId: usuario?.pointIdGestor || '',
      atleta1Id: '',
      atleta2Id: '',
      atleta3Id: '',
      atleta4Id: '',
      gamesTime1: '',
      gamesTime2: '',
      tiebreakTime1: '',
      tiebreakTime2: '',
    });
    setErro('');
    setModalNovoJogo(true);
  };

  const handleSelecionarAtleta = (atletaId: string) => {
    if (salvando) return;
    
    // Verificar se o atleta já foi selecionado
    if ([formJogo.atleta1Id, formJogo.atleta2Id, formJogo.atleta3Id, formJogo.atleta4Id].includes(atletaId)) {
      // Se já está selecionado, remover da posição atual
      if (formJogo.atleta1Id === atletaId) {
        setFormJogo({ ...formJogo, atleta1Id: '' });
      } else if (formJogo.atleta2Id === atletaId) {
        setFormJogo({ ...formJogo, atleta2Id: '' });
      } else if (formJogo.atleta3Id === atletaId) {
        setFormJogo({ ...formJogo, atleta3Id: '' });
      } else if (formJogo.atleta4Id === atletaId) {
        setFormJogo({ ...formJogo, atleta4Id: '' });
      }
      return;
    }

    // Adicionar na próxima posição disponível
    // Ordem: Time 1 completo (Jogador 1, Jogador 2) → Time 2 completo (Jogador 1, Jogador 2)
    if (!formJogo.atleta1Id) {
      setFormJogo({ ...formJogo, atleta1Id: atletaId });
    } else if (!formJogo.atleta3Id) {
      setFormJogo({ ...formJogo, atleta3Id: atletaId });
    } else if (!formJogo.atleta2Id) {
      setFormJogo({ ...formJogo, atleta2Id: atletaId });
    } else if (!formJogo.atleta4Id) {
      setFormJogo({ ...formJogo, atleta4Id: atletaId });
    }
  };

  const getPosicaoAtleta = (atletaId: string): string | null => {
    if (formJogo.atleta1Id === atletaId) return 'Time 1 - Jogador 1';
    if (formJogo.atleta2Id === atletaId) return 'Time 2 - Jogador 1';
    if (formJogo.atleta3Id === atletaId) return 'Time 1 - Jogador 2';
    if (formJogo.atleta4Id === atletaId) return 'Time 2 - Jogador 2';
    return null;
  };

  const criarJogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formJogo.data || !formJogo.local || !formJogo.atleta1Id || !formJogo.atleta2Id) {
      setErro('Data, local e pelo menos 2 atletas são obrigatórios');
      return;
    }

    if (!formJogo.pointId) {
      setErro('A seleção da arena é obrigatória');
      return;
    }

    // Se tem 4 atletas, todos são obrigatórios
    if ((formJogo.atleta3Id || formJogo.atleta4Id) && (!formJogo.atleta3Id || !formJogo.atleta4Id)) {
      setErro('Para duplas, selecione 4 atletas (2 por time)');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const payload: any = {
        data: formJogo.data,
        local: formJogo.local,
        pointId: formJogo.pointId,
        atleta1Id: formJogo.atleta1Id,
        atleta2Id: formJogo.atleta2Id,
        atleta3Id: formJogo.atleta3Id || null,
        atleta4Id: formJogo.atleta4Id || null,
      };

      if (formJogo.gamesTime1 && formJogo.gamesTime2) {
        payload.gamesTime1 = parseInt(formJogo.gamesTime1);
        payload.gamesTime2 = parseInt(formJogo.gamesTime2);
        if (formJogo.tiebreakTime1) payload.tiebreakTime1 = parseInt(formJogo.tiebreakTime1);
        if (formJogo.tiebreakTime2) payload.tiebreakTime2 = parseInt(formJogo.tiebreakTime2);
      }

      await api.post(`/user/panelinha/${id}/jogos`, payload);
      setModalNovoJogo(false);
      carregarJogos();
      if (payload.gamesTime1 !== undefined && payload.gamesTime2 !== undefined) {
        carregarRanking();
      }
    } catch (error: any) {
      console.error('Erro ao criar jogo:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao criar jogo');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalEditarPlacar = (jogo: Jogo) => {
    setFormPlacar({
      gamesTime1: jogo.gamesTime1?.toString() || '',
      gamesTime2: jogo.gamesTime2?.toString() || '',
      tiebreakTime1: jogo.tiebreakTime1?.toString() || '',
      tiebreakTime2: jogo.tiebreakTime2?.toString() || '',
    });
    setErro('');
    setModalEditarPlacar(jogo);
  };

  const atualizarPlacar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarPlacar) return;

    if (!formPlacar.gamesTime1 || !formPlacar.gamesTime2) {
      setErro('Placar completo (games de ambos os times) é obrigatório');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const payload: any = {
        gamesTime1: parseInt(formPlacar.gamesTime1),
        gamesTime2: parseInt(formPlacar.gamesTime2),
        tiebreakTime1: formPlacar.tiebreakTime1 ? parseInt(formPlacar.tiebreakTime1) : null,
        tiebreakTime2: formPlacar.tiebreakTime2 ? parseInt(formPlacar.tiebreakTime2) : null,
      };

      await api.put(`/partida/${modalEditarPlacar.id}`, payload);
      setModalEditarPlacar(null);
      carregarJogos();
      carregarRanking();
    } catch (error: any) {
      console.error('Erro ao atualizar placar:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao atualizar placar');
    } finally {
      setSalvando(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const [cardModal, setCardModal] = useState<{ jogoId: string; imageUrl: string } | null>(null);
  const [carregandoCard, setCarregandoCard] = useState(false);

  const gerarCard = async (jogo: Jogo) => {
    try {
      setCarregandoCard(true);
      setErro('');
      
      // Obter token do localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      // Fazer requisição com token de autenticação
      const response = await fetch(`/api/card/partida/${jogo.id}?refresh=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ mensagem: 'Erro ao gerar card' }));
        throw new Error(errorData.mensagem || 'Erro ao gerar card');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setCardModal({ jogoId: jogo.id, imageUrl });
    } catch (error: any) {
      console.error('Erro ao gerar card:', error);
      setErro(error?.message || 'Erro ao gerar card');
    } finally {
      setCarregandoCard(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  if (!panelinha) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Panelinha não encontrada</p>
          <Link href="/app/arena/panelinhas" className="mt-4 inline-block text-emerald-600 hover:text-emerald-700">
            Voltar para Panelinhas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/app/arena/panelinhas"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </Link>
        </div>

        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{panelinha.nome}</h1>
          {panelinha.esporte && (
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
              {panelinha.esporte}
            </span>
          )}
        </div>

        {panelinha.descricao && (
          <p className="text-gray-600 mb-4">{panelinha.descricao}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{panelinha.totalMembros} membro{panelinha.totalMembros !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {erro && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {erro}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setAbaAtiva('jogos')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === 'jogos'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                Jogos ({jogos.length})
              </div>
            </button>
            <button
              onClick={() => setAbaAtiva('ranking')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === 'ranking'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrophyIcon className="w-4 h-4" />
                Ranking
              </div>
            </button>
            <button
              onClick={() => setAbaAtiva('membros')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === 'membros'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Membros ({panelinha.totalMembros})
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Aba Jogos */}
          {abaAtiva === 'jogos' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Jogos</h2>
                <button
                  onClick={handleAbrirModalNovoJogo}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Novo Jogo
                </button>
              </div>

              {jogos.length === 0 ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Nenhum jogo cadastrado ainda</p>
                  <button
                    onClick={handleAbrirModalNovoJogo}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Criar Primeiro Jogo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {jogos.map((jogo) => (
                    <div
                      key={jogo.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{formatarData(jogo.data)}</span>
                            {jogo.local && (
                              <>
                                <MapPin className="w-4 h-4 text-gray-400 ml-2" />
                                <span className="text-gray-600">{jogo.local}</span>
                              </>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {/* Time 1 */}
                            <div>
                              <div className="font-medium text-gray-700 mb-2">Time 1</div>
                              <div className="space-y-1">
                                {jogo.atleta1 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {jogo.atleta1.fotoUrl && (
                                      <img
                                        src={jogo.atleta1.fotoUrl}
                                        alt={jogo.atleta1.nome}
                                        className="w-6 h-6 rounded-full"
                                      />
                                    )}
                                    <span>{jogo.atleta1.nome}</span>
                                  </div>
                                )}
                                {jogo.atleta3 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {jogo.atleta3.fotoUrl && (
                                      <img
                                        src={jogo.atleta3.fotoUrl}
                                        alt={jogo.atleta3.nome}
                                        className="w-6 h-6 rounded-full"
                                      />
                                    )}
                                    <span>{jogo.atleta3.nome}</span>
                                  </div>
                                )}
                              </div>
                              {jogo.gamesTime1 !== null && jogo.gamesTime2 !== null && (
                                <div className="mt-2 text-lg font-bold text-emerald-600">
                                  {jogo.gamesTime1}
                                  {jogo.tiebreakTime1 && (
                                    <span className="text-sm text-gray-500"> ({jogo.tiebreakTime1})</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Time 2 */}
                            <div>
                              <div className="font-medium text-gray-700 mb-2">Time 2</div>
                              <div className="space-y-1">
                                {jogo.atleta2 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {jogo.atleta2.fotoUrl && (
                                      <img
                                        src={jogo.atleta2.fotoUrl}
                                        alt={jogo.atleta2.nome}
                                        className="w-6 h-6 rounded-full"
                                      />
                                    )}
                                    <span>{jogo.atleta2.nome}</span>
                                  </div>
                                )}
                                {jogo.atleta4 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {jogo.atleta4.fotoUrl && (
                                      <img
                                        src={jogo.atleta4.fotoUrl}
                                        alt={jogo.atleta4.nome}
                                        className="w-6 h-6 rounded-full"
                                      />
                                    )}
                                    <span>{jogo.atleta4.nome}</span>
                                  </div>
                                )}
                              </div>
                              {jogo.gamesTime1 !== null && jogo.gamesTime2 !== null && (
                                <div className="mt-2 text-lg font-bold text-emerald-600">
                                  {jogo.gamesTime2}
                                  {jogo.tiebreakTime2 && (
                                    <span className="text-sm text-gray-500"> ({jogo.tiebreakTime2})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          {jogo.gamesTime1 === null || jogo.gamesTime2 === null ? (
                            <button
                              onClick={() => abrirModalEditarPlacar(jogo)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirModalEditarPlacar(jogo)}
                                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                                title="Editar placar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => gerarCard(jogo)}
                                disabled={carregandoCard}
                                className={`px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm ${carregandoCard ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Gerar card do jogo"
                              >
                                <Trophy className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba Ranking */}
          {abaAtiva === 'ranking' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Ranking</h2>
              {ranking.length === 0 ? (
                <div className="text-center py-12">
                  <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Ranking será calculado após os primeiros jogos com placares</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Posição</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Atleta</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Jogos</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Vitórias</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Derrotas</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Games</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">% Vitórias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((atleta, idx) => (
                        <tr key={atleta.atletaId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {idx < 3 && (
                                <TrophyIcon
                                  className={`w-5 h-5 ${
                                    idx === 0
                                      ? 'text-yellow-500'
                                      : idx === 1
                                      ? 'text-gray-400'
                                      : 'text-amber-600'
                                  }`}
                                />
                              )}
                              <span className="font-medium text-gray-900">{atleta.posicao}º</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {atleta.fotoUrl && (
                                <img
                                  src={atleta.fotoUrl}
                                  alt={atleta.nome}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <span className="text-gray-900">{atleta.nome}</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4 text-gray-700">{atleta.jogos}</td>
                          <td className="text-center py-3 px-4 text-green-600 font-medium">
                            {atleta.vitorias}
                          </td>
                          <td className="text-center py-3 px-4 text-red-600 font-medium">
                            {atleta.derrotas}
                          </td>
                          <td className="text-center py-3 px-4 text-gray-700">
                            {atleta.gamesGanhos} - {atleta.gamesPerdidos}
                          </td>
                          <td className="text-center py-3 px-4 font-medium text-gray-900">
                            {(atleta.porcentagemVitorias ?? 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Aba Membros */}
          {abaAtiva === 'membros' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Membros</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {panelinha.membros.map((membro) => (
                  <div
                    key={membro.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {membro.fotoUrl ? (
                        <img
                          src={membro.fotoUrl}
                          alt={membro.nome}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">
                            {membro.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{membro.nome}</div>
                        {membro.categoria && (
                          <div className="text-sm text-gray-600">{membro.categoria}</div>
                        )}
                        {membro.telefone && (
                          <div className="text-sm text-gray-500">{membro.telefone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Jogo */}
      {modalNovoJogo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Novo Jogo</h2>
              <button
                onClick={() => setModalNovoJogo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={criarJogo} className="p-6 space-y-4">
              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {erro}
                </div>
              )}

              {/* Visualização dos times formados */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Times Formados
                </label>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50">
                    <h3 className="text-sm font-semibold text-emerald-800 mb-3">Time 1</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 min-h-[40px]">
                        {formJogo.atleta1Id ? (
                          (() => {
                            const atleta = panelinha.membros.find(m => m.id === formJogo.atleta1Id);
                            return atleta ? (
                              <div className="flex items-center gap-2">
                                {atleta.fotoUrl ? (
                                  <img src={atleta.fotoUrl} alt={atleta.nome} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-semibold">
                                    {atleta.nome.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm font-medium">{atleta.nome}</span>
                              </div>
                            ) : null;
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">Jogador 1</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 min-h-[40px]">
                        {formJogo.atleta3Id ? (
                          (() => {
                            const atleta = panelinha.membros.find(m => m.id === formJogo.atleta3Id);
                            return atleta ? (
                              <div className="flex items-center gap-2">
                                {atleta.fotoUrl ? (
                                  <img src={atleta.fotoUrl} alt={atleta.nome} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-semibold">
                                    {atleta.nome.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm font-medium">{atleta.nome}</span>
                              </div>
                            ) : null;
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">Jogador 2 (opcional)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                    <h3 className="text-sm font-semibold text-red-800 mb-3">Time 2</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 min-h-[40px]">
                        {formJogo.atleta2Id ? (
                          (() => {
                            const atleta = panelinha.membros.find(m => m.id === formJogo.atleta2Id);
                            return atleta ? (
                              <div className="flex items-center gap-2">
                                {atleta.fotoUrl ? (
                                  <img src={atleta.fotoUrl} alt={atleta.nome} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-semibold">
                                    {atleta.nome.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm font-medium">{atleta.nome}</span>
                              </div>
                            ) : null;
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">Jogador 1</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 min-h-[40px]">
                        {formJogo.atleta4Id ? (
                          (() => {
                            const atleta = panelinha.membros.find(m => m.id === formJogo.atleta4Id);
                            return atleta ? (
                              <div className="flex items-center gap-2">
                                {atleta.fotoUrl ? (
                                  <img src={atleta.fotoUrl} alt={atleta.nome} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-semibold">
                                    {atleta.nome.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm font-medium">{atleta.nome}</span>
                              </div>
                            ) : null;
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">Jogador 2 (opcional)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seleção de atletas clicando nas fotos */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Clique nos atletas para formar as duplas (ordem: Time 1 completo, depois Time 2)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {panelinha.membros.map((membro) => {
                    const posicao = getPosicaoAtleta(membro.id);
                    const estaSelecionado = posicao !== null;
                    const isTime1 = posicao?.includes('Time 1');
                    const isTime2 = posicao?.includes('Time 2');
                    
                    return (
                      <button
                        key={membro.id}
                        type="button"
                        onClick={() => handleSelecionarAtleta(membro.id)}
                        disabled={salvando}
                        className={`
                          flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                          ${estaSelecionado 
                            ? isTime1 
                              ? 'border-emerald-500 bg-emerald-100' 
                              : 'border-red-500 bg-red-100'
                            : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                          }
                          ${salvando ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {membro.fotoUrl ? (
                          <img
                            src={membro.fotoUrl}
                            alt={membro.nome}
                            className={`w-12 h-12 rounded-full object-cover border-2 ${
                              estaSelecionado 
                                ? isTime1 ? 'border-emerald-500' : 'border-red-500'
                                : 'border-gray-300'
                            }`}
                          />
                        ) : (
                          <div className={`
                            w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold border-2
                            ${estaSelecionado 
                              ? isTime1 ? 'border-emerald-500 bg-emerald-200' : 'border-red-500 bg-red-200'
                              : 'border-gray-300'
                            }
                          `}>
                            {membro.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`text-xs font-medium text-center ${estaSelecionado ? 'font-semibold' : ''}`}>
                          {membro.nome}
                        </span>
                        {posicao && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isTime1 ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                          }`}>
                            {posicao}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data e Hora *
                  </label>
                  <input
                    type="datetime-local"
                    value={formJogo.data}
                    onChange={(e) => setFormJogo({ ...formJogo, data: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arena *
                  </label>
                  <select
                    value={formJogo.pointId}
                    onChange={(e) => setFormJogo({ ...formJogo, pointId: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  >
                    <option value="">Selecione a arena</option>
                    {usuario?.pointIdGestor && (
                      <option value={usuario.pointIdGestor}>Arena</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local *
                </label>
                <input
                  type="text"
                  value={formJogo.local}
                  onChange={(e) => setFormJogo({ ...formJogo, local: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Local do jogo (ex: Quadra 1, Quadra Central)"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Placar (Opcional - pode ser informado depois)</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Games Time 1
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJogo.gamesTime1}
                      onChange={(e) => setFormJogo({ ...formJogo, gamesTime1: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Games Time 2
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJogo.gamesTime2}
                      onChange={(e) => setFormJogo({ ...formJogo, gamesTime2: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tiebreak Time 1
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJogo.tiebreakTime1}
                      onChange={(e) => setFormJogo({ ...formJogo, tiebreakTime1: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tiebreak Time 2
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJogo.tiebreakTime2}
                      onChange={(e) => setFormJogo({ ...formJogo, tiebreakTime2: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalNovoJogo(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Criar Jogo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Placar */}
      {modalEditarPlacar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Editar Placar</h2>
              <button
                onClick={() => setModalEditarPlacar(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={atualizarPlacar} className="p-6 space-y-4">
              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {erro}
                </div>
              )}

              <div>
                <div className="mb-3">
                  <div className="font-medium text-gray-700 mb-2">Time 1</div>
                  <div className="text-sm text-gray-600">
                    {modalEditarPlacar.atleta1?.nome}
                    {modalEditarPlacar.atleta3 && ` / ${modalEditarPlacar.atleta3.nome}`}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="font-medium text-gray-700 mb-2">Time 2</div>
                  <div className="text-sm text-gray-600">
                    {modalEditarPlacar.atleta2?.nome}
                    {modalEditarPlacar.atleta4 && ` / ${modalEditarPlacar.atleta4.nome}`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Games Time 1 *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formPlacar.gamesTime1}
                    onChange={(e) => setFormPlacar({ ...formPlacar, gamesTime1: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Games Time 2 *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formPlacar.gamesTime2}
                    onChange={(e) => setFormPlacar({ ...formPlacar, gamesTime2: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiebreak Time 1 (Opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formPlacar.tiebreakTime1}
                    onChange={(e) => setFormPlacar({ ...formPlacar, tiebreakTime1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiebreak Time 2 (Opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formPlacar.tiebreakTime2}
                    onChange={(e) => setFormPlacar({ ...formPlacar, tiebreakTime2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalEditarPlacar(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Placar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Card */}
      {cardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Card do Jogo</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    // Download do card
                    const link = document.createElement('a');
                    link.href = cardModal.imageUrl;
                    link.download = `card-partida-${cardModal.jogoId}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    if (cardModal.imageUrl) {
                      URL.revokeObjectURL(cardModal.imageUrl);
                    }
                    setCardModal(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-gray-50">
              {carregandoCard ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                  <p className="text-gray-600">Gerando card...</p>
                </div>
              ) : (
                <img
                  src={cardModal.imageUrl}
                  alt="Card do Jogo"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

