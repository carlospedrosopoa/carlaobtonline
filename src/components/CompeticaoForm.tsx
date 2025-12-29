// components/CompeticaoForm.tsx - Formulário de criação/edição de competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { competicaoService } from '@/services/competicaoService';
import { pointService, quadraService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Competicao, FormatoCompeticao, TipoCompeticao } from '@/types/competicao';
import { Trophy, ArrowLeft, Save, Plus, X, Users, User, PlayCircle, RotateCcw } from 'lucide-react';

interface Atleta {
  id: string;
  nome: string;
  fotoUrl?: string | null;
  fone?: string;
}

interface CompeticaoFormProps {
  competicaoId?: string;
}

export default function CompeticaoForm({ competicaoId }: CompeticaoFormProps) {
  const { usuario } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(!!competicaoId);
  const [saving, setSaving] = useState(false);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);

  // Dados do formulário
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCompeticao>('SUPER_8');
  // Formato sempre será 'DUPLAS' para Super 8 (round-robin de duplas)
  const [formato] = useState<FormatoCompeticao>('DUPLAS');
  // quadraId removido - agora será gerenciado via agendamentos
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorInscricao, setValorInscricao] = useState<string>('');
  const [premio, setPremio] = useState('');
  const [regras, setRegras] = useState('');
  const [criterioClassificacao, setCriterioClassificacao] = useState<'VITORIAS' | 'SALDO_GAMES'>('VITORIAS');
  
  // Imagens
  const [cardDivulgacaoUrl, setCardDivulgacaoUrl] = useState<string | null>(null);
  const [cardDivulgacaoPreview, setCardDivulgacaoPreview] = useState<string | null>(null);
  const [fotoCompeticaoUrl, setFotoCompeticaoUrl] = useState<string | null>(null);
  const [fotoCompeticaoPreview, setFotoCompeticaoPreview] = useState<string | null>(null);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Atletas
  const [atletasDisponiveis, setAtletasDisponiveis] = useState<Atleta[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);
  const [buscandoAtletas, setBuscandoAtletas] = useState(false);
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [mostrarBuscaAtleta, setMostrarBuscaAtleta] = useState(false);

  // Para duplas
  const [atletaSelecionado, setAtletaSelecionado] = useState<string>('');
  const [parceiroSelecionado, setParceiroSelecionado] = useState<string>('');

  // Quadras (removido - não mais necessário no formulário, será usado apenas no modal de agendamento)

  // Jogos
  const [jogos, setJogos] = useState<any[]>([]);
  const [jogoEditando, setJogoEditando] = useState<any | null>(null);
  const [mostrarModalResultado, setMostrarModalResultado] = useState(false);
  const [gamesAtleta1, setGamesAtleta1] = useState<string>('');
  const [gamesAtleta2, setGamesAtleta2] = useState<string>('');

  useEffect(() => {
    carregarDados();
  }, [competicaoId]);

  useEffect(() => {
    if (mostrarBuscaAtleta) {
      if (buscaAtleta.trim()) {
        // Debounce simples - busca após 300ms sem digitar
        const timeoutId = setTimeout(() => {
          buscarAtletas();
        }, 300);
        
        return () => clearTimeout(timeoutId);
      } else if (atletasDisponiveis.length === 0 && !buscandoAtletas) {
        // Se campo vazio e não há resultados, buscar todos
        buscarAtletas('');
      }
    } else {
      // Se fechar a busca, limpar resultados
      setAtletasDisponiveis([]);
    }
  }, [buscaAtleta, mostrarBuscaAtleta]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const pointId = usuario?.pointIdGestor;
      if (!pointId) {
        alert('Erro: Arena não encontrada');
        router.back();
        return;
      }

      // Quadras serão carregadas no modal de agendamento
      // Não precisamos mais carregar aqui

      // Se estiver editando, carregar competição
      if (competicaoId) {
        const competicaoData = await competicaoService.obter(competicaoId);
        setCompeticao(competicaoData);
        setNome(competicaoData.nome);
        setTipo(competicaoData.tipo);
        // Formato sempre será DUPLAS para Super 8
        // quadraId removido - agora será gerenciado via agendamentos
        setDataInicio(competicaoData.dataInicio ? competicaoData.dataInicio.split('T')[0] : '');
        setDataFim(competicaoData.dataFim ? competicaoData.dataFim.split('T')[0] : '');
        setDescricao(competicaoData.descricao || '');
        setValorInscricao(competicaoData.valorInscricao?.toString() || '');
        setPremio(competicaoData.premio || '');
        setRegras(competicaoData.regras || '');
        setCriterioClassificacao(competicaoData.configSuper8?.criterioClassificacao || 'VITORIAS');
        setAtletasParticipantes(competicaoData.atletasParticipantes || []);
        
        // Carregar jogos se existirem
        try {
          const jogosData = await competicaoService.listarJogos(competicaoId);
          setJogos(jogosData || []);
        } catch (err) {
          // Ignorar erro se não houver jogos
          setJogos([]);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao carregar dados');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const buscarAtletas = async (busca: string = buscaAtleta) => {
    try {
      setBuscandoAtletas(true);
      const buscaTerm = busca.trim() || '';
      const { data } = await api.get(`/atleta/para-selecao?busca=${encodeURIComponent(buscaTerm)}`);
      setAtletasDisponiveis(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar atletas:', error);
      setAtletasDisponiveis([]);
    } finally {
      setBuscandoAtletas(false);
    }
  };

  const adicionarAtletaDireto = async (atletaId: string) => {
    if (!competicaoId) {
      alert('Salve a competição primeiro antes de adicionar atletas');
      return;
    }

    // Verificar se há jogos gerados
    if (jogos.length > 0) {
      alert('Não é possível adicionar atletas após os jogos serem gerados. Desfaça o sorteio primeiro.');
      return;
    }

    // Verificar se atleta já está adicionado
    if (atletasParticipantes.some(ap => ap.atletaId === atletaId)) {
      alert('Este atleta já está na competição');
      return;
    }

    // Para Super 8, limitar a 8 participantes
    if (tipo === 'SUPER_8' && atletasParticipantes.length >= 8) {
      alert('Super 8 permite no máximo 8 participantes');
      return;
    }

    try {
      await competicaoService.adicionarAtleta(competicaoId, {
        atletaId: atletaId,
      });

      // Recarregar competição
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);

      // Manter busca aberta para adicionar mais atletas
      setBuscaAtleta('');
      setAtletasDisponiveis([]);

      // Não mostrar alerta para não interromper o fluxo
    } catch (error: any) {
      console.error('Erro ao adicionar atleta:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao adicionar atleta');
    }
  };

  const adicionarDupla = async () => {
    if (!competicaoId) {
      alert('Salve a competição primeiro antes de adicionar atletas');
      return;
    }

    // Verificar se há jogos gerados
    if (jogos.length > 0) {
      alert('Não é possível adicionar atletas após os jogos serem gerados. Desfaça o sorteio primeiro.');
      return;
    }

    if (!atletaSelecionado || !parceiroSelecionado) {
      alert('Selecione ambos os atletas para formar a dupla');
      return;
    }

    if (atletaSelecionado === parceiroSelecionado) {
      alert('Um atleta não pode ser parceiro de si mesmo');
      return;
    }

    // Para Super 8, verificar se adicionando 2 atletas ultrapassa o limite de 8
    if (tipo === 'SUPER_8') {
      const atletasNovos = [atletaSelecionado, parceiroSelecionado].filter(
        id => !atletasParticipantes.some(ap => ap.atletaId === id)
      );
      if (atletasParticipantes.length + atletasNovos.length > 8) {
        alert('Super 8 permite no máximo 8 participantes. Não é possível adicionar esta dupla.');
        return;
      }
    }

    try {
      await competicaoService.adicionarAtleta(competicaoId, {
        atletaId: atletaSelecionado,
        parceiroAtletaId: parceiroSelecionado,
      });

      // Recarregar competição
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);

      // Limpar seleções
      setAtletaSelecionado('');
      setParceiroSelecionado('');
      setBuscaAtleta('');
      setAtletasDisponiveis([]);

      alert('Dupla adicionada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar dupla:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao adicionar dupla');
    }
  };

  // Função para selecionar atleta para dupla (toggle)
  const selecionarAtletaParaDupla = (atletaId: string) => {
    if (!atletaSelecionado) {
      setAtletaSelecionado(atletaId);
    } else if (atletaSelecionado === atletaId) {
      // Desselecionar se clicar no mesmo
      setAtletaSelecionado('');
    } else if (!parceiroSelecionado) {
      setParceiroSelecionado(atletaId);
    } else if (parceiroSelecionado === atletaId) {
      // Desselecionar parceiro se clicar no mesmo
      setParceiroSelecionado('');
    } else {
      // Substituir parceiro
      setParceiroSelecionado(atletaId);
    }
  };

  const removerAtleta = async (atletaId: string) => {
    if (!competicaoId) return;
    
    // Verificar se há jogos gerados
    if (jogos.length > 0) {
      alert('Não é possível remover atletas após os jogos serem gerados. Desfaça o sorteio primeiro.');
      return;
    }
    
    if (!confirm('Tem certeza que deseja remover este atleta da competição?')) return;

    try {
      await competicaoService.removerAtleta(competicaoId, atletaId);
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);
      alert('Atleta removido com sucesso!');
    } catch (error: any) {
      console.error('Erro ao remover atleta:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao remover atleta');
    }
  };

  const handleGerarJogos = async () => {
    if (!competicaoId) return;
    
    if (!confirm('Tem certeza que deseja gerar o sorteio dos jogos de duplas? Serão gerados 14 jogos (7 rodadas) onde cada atleta joga com parceiros diferentes. Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setSaving(true);
      const resultado = await competicaoService.gerarJogos(competicaoId);
      alert(resultado.mensagem || 'Jogos gerados com sucesso!');
      
      // Recarregar competição
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);
      
      // Recarregar jogos
      try {
        const jogosData = await competicaoService.listarJogos(competicaoId);
        setJogos(jogosData || []);
      } catch (err) {
        setJogos([]);
      }
    } catch (error: any) {
      console.error('Erro ao gerar jogos:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao gerar jogos');
    } finally {
      setSaving(false);
    }
  };

  const handleDesfazerSorteio = async () => {
    if (!competicaoId) return;
    
    if (!confirm('Tem certeza que deseja desfazer o sorteio? Todos os jogos serão excluídos e o status da competição voltará para "Criada". Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setSaving(true);
      const resultado = await competicaoService.excluirJogos(competicaoId);
      alert(resultado.mensagem || 'Sorteio desfeito com sucesso!');
      
      // Recarregar competição
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);
      
      // Limpar jogos
      setJogos([]);
    } catch (error: any) {
      console.error('Erro ao desfazer sorteio:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao desfazer sorteio');
    } finally {
      setSaving(false);
    }
  };

  const abrirModalResultado = (jogo: any) => {
    setJogoEditando(jogo);
    setGamesAtleta1(jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined ? jogo.gamesAtleta1.toString() : '');
    setGamesAtleta2(jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined ? jogo.gamesAtleta2.toString() : '');
    setMostrarModalResultado(true);
  };

  const fecharModalResultado = () => {
    setMostrarModalResultado(false);
    setJogoEditando(null);
    setGamesAtleta1('');
    setGamesAtleta2('');
  };

  const salvarResultado = async () => {
    if (!competicaoId || !jogoEditando) return;

    try {
      setSaving(true);
      await competicaoService.atualizarResultadoJogo(competicaoId, jogoEditando.id, {
        gamesAtleta1: gamesAtleta1 ? parseInt(gamesAtleta1) : null,
        gamesAtleta2: gamesAtleta2 ? parseInt(gamesAtleta2) : null,
      });
      
      // Recarregar jogos
      const jogosData = await competicaoService.listarJogos(competicaoId);
      setJogos(jogosData || []);
      
      fecharModalResultado();
    } catch (error: any) {
      console.error('Erro ao salvar resultado:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao salvar resultado');
    } finally {
      setSaving(false);
    }
  };

  // Calcular classificação (vitórias e saldo de games)
  const calcularClassificacao = () => {
    if (!jogos || jogos.length === 0) return [];

    // Mapear atletas e suas estatísticas
    const estatisticas = new Map<string, {
      atletaId: string;
      nome: string;
      vitorias: number;
      derrotas: number;
      gamesFeitos: number;
      gamesSofridos: number;
      saldoGames: number;
    }>();

    // Inicializar estatísticas de todos os atletas
    atletasParticipantes.forEach((participante: any) => {
      if (participante.atletaId) {
        estatisticas.set(participante.atletaId, {
          atletaId: participante.atletaId,
          nome: participante.atleta?.nome || 'Atleta',
          vitorias: 0,
          derrotas: 0,
          gamesFeitos: 0,
          gamesSofridos: 0,
          saldoGames: 0,
        });
      }
    });

    // Processar cada jogo concluído
    jogos.forEach((jogo: any) => {
      if (jogo.status === 'CONCLUIDO' && jogo.gamesAtleta1 !== null && jogo.gamesAtleta2 !== null) {
        const games1 = jogo.gamesAtleta1 || 0;
        const games2 = jogo.gamesAtleta2 || 0;

        // Para duplas, precisamos dos atletas de cada parceria
        if (jogo.participante1?.dupla && jogo.participante2?.dupla) {
          const dupla1 = jogo.participante1.dupla;
          const dupla2 = jogo.participante2.dupla;

          // Atletas da dupla 1
          [dupla1.atleta1.id, dupla1.atleta2.id].forEach((atletaId: string) => {
            const stats = estatisticas.get(atletaId);
            if (stats) {
              stats.gamesFeitos += games1;
              stats.gamesSofridos += games2;
              if (games1 > games2) {
                stats.vitorias++;
              } else if (games2 > games1) {
                stats.derrotas++;
              }
            }
          });

          // Atletas da dupla 2
          [dupla2.atleta1.id, dupla2.atleta2.id].forEach((atletaId: string) => {
            const stats = estatisticas.get(atletaId);
            if (stats) {
              stats.gamesFeitos += games2;
              stats.gamesSofridos += games1;
              if (games2 > games1) {
                stats.vitorias++;
              } else if (games1 > games2) {
                stats.derrotas++;
              }
            }
          });
        }
      }
    });

    // Calcular saldo de games e ordenar
    const classificacao = Array.from(estatisticas.values()).map(stats => ({
      ...stats,
      saldoGames: stats.gamesFeitos - stats.gamesSofridos,
    })).sort((a, b) => {
      // Ordenar por: vitórias (desc), saldo de games (desc)
      if (b.vitorias !== a.vitorias) {
        return b.vitorias - a.vitorias;
      }
      return b.saldoGames - a.saldoGames;
    });

    return classificacao;
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      alert('Informe o nome da competição');
      return;
    }

    if (!usuario?.pointIdGestor) {
      alert('Erro: Arena não encontrada');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        pointId: usuario.pointIdGestor,
        nome: nome.trim(),
        tipo,
        formato: 'DUPLAS' as const, // Super 8 sempre usa formato duplas (round-robin)
        // quadraId removido - agora será gerenciado via agendamentos
        dataInicio: dataInicio ? new Date(dataInicio).toISOString() : null,
        dataFim: dataFim ? new Date(dataFim).toISOString() : null,
        descricao: descricao.trim() || null,
        valorInscricao: valorInscricao ? parseFloat(valorInscricao) : null,
        premio: premio.trim() || null,
        regras: regras.trim() || null,
        cardDivulgacaoUrl: cardDivulgacaoUrl || null,
        fotoCompeticaoUrl: fotoCompeticaoUrl || null,
        configSuper8: {
          criterioClassificacao: criterioClassificacao,
        },
      };

      if (competicaoId) {
        await competicaoService.atualizar(competicaoId, payload);
        alert('Competição atualizada com sucesso!');
        router.push('/app/arena/competicoes');
        return;
      } else {
        const novaCompeticao = await competicaoService.criar(payload);
        alert('Competição criada com sucesso!');
        router.push('/app/arena/competicoes');
        return;
      }
    } catch (error: any) {
      console.error('Erro ao salvar competição:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao salvar competição');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não agrupar mais em duplas - atletas são sempre individuais
  // As duplas só existem nos jogos, não na lista de participantes
  const duplasAgrupadas = {};

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          {competicaoId ? 'Editar Competição' : 'Nova Competição Super 8'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        {/* Informações Básicas */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações Básicas</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Competição *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Super 8 de Beach Tennis - Dezembro 2025"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Competição *</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoCompeticao)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              >
                <option value="SUPER_8">Super 8</option>
                <option value="SUPER_12" disabled>Super 12 (Em breve)</option>
                <option value="REI_DA_QUADRA" disabled>Rei da Quadra (Em breve)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Por enquanto, apenas Super 8 está disponível
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Critério de Classificação
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="VITORIAS"
                    checked={criterioClassificacao === 'VITORIAS'}
                    onChange={(e) => setCriterioClassificacao(e.target.value as 'VITORIAS' | 'SALDO_GAMES')}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span>Por Vitórias</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="SALDO_GAMES"
                    checked={criterioClassificacao === 'SALDO_GAMES'}
                    onChange={(e) => setCriterioClassificacao(e.target.value as 'VITORIAS' | 'SALDO_GAMES')}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span>Por Saldo de Games</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {criterioClassificacao === 'VITORIAS' 
                  ? 'Classificação ordenada primeiro por vitórias, depois por saldo de games'
                  : 'Classificação ordenada primeiro por saldo de games, depois por vitórias'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quadras</label>
              <p className="text-sm text-gray-600">
                As quadras podem ser agendadas após a criação da competição através do botão "Agendar Quadras" no card da competição.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Inscrição (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valorInscricao}
                onChange={(e) => setValorInscricao(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prêmio</label>
              <textarea
                value={premio}
                onChange={(e) => setPremio(e.target.value)}
                rows={4}
                placeholder="Ex: Troféu + R$ 500,00&#10;ou&#10;1º lugar: R$ 500,00&#10;2º lugar: R$ 300,00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card de Divulgação</label>
              <div className="space-y-2">
                {cardDivulgacaoPreview && (
                  <div className="relative inline-block">
                    <img
                      src={cardDivulgacaoPreview}
                      alt="Card de divulgação"
                      className="max-w-xs max-h-48 object-contain rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCardDivulgacaoUrl(null);
                        setCardDivulgacaoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.type.startsWith('image/')) {
                        alert('Por favor, selecione apenas arquivos de imagem.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        alert('A imagem deve ter no máximo 5MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = reader.result as string;
                        setCardDivulgacaoUrl(base64String);
                        setCardDivulgacaoPreview(base64String);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto da Competição</label>
              <div className="space-y-2">
                {fotoCompeticaoPreview && (
                  <div className="relative inline-block">
                    <img
                      src={fotoCompeticaoPreview}
                      alt="Foto da competição"
                      className="max-w-xs max-h-48 object-contain rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFotoCompeticaoUrl(null);
                        setFotoCompeticaoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.type.startsWith('image/')) {
                        alert('Por favor, selecione apenas arquivos de imagem.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        alert('A imagem deve ter no máximo 5MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = reader.result as string;
                        setFotoCompeticaoUrl(base64String);
                        setFotoCompeticaoPreview(base64String);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="Descrição da competição..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regras</label>
              <textarea
                value={regras}
                onChange={(e) => setRegras(e.target.value)}
                rows={4}
                placeholder="Regras da competição..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Atletas Participantes */}
        {competicaoId && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Atletas Participantes ({atletasParticipantes.length}
                {tipo === 'SUPER_8' && '/8'}
                )
                {tipo === 'SUPER_8' && atletasParticipantes.length === 8 && jogos.length === 0 && (
                  <span className="ml-2 text-sm font-normal text-green-600">✓ Pronto para gerar jogos</span>
                )}
                {jogos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-orange-600">⚠ Não é possível editar atletas após os jogos serem gerados</span>
                )}
              </h2>
              <div className="flex gap-2">
                {atletasParticipantes.length === 8 && competicao?.status === 'CRIADA' && (
                  <button
                    onClick={handleGerarJogos}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                    title="Gerar jogos de duplas em formato round-robin (cada atleta joga 7 jogos com parceiros diferentes)"
                  >
                    <Trophy className="w-5 h-5" />
                    Gerar Sorteio dos Jogos (Duplas)
                  </button>
                )}
                {jogos.length > 0 && (competicao?.status === 'EM_ANDAMENTO' || competicao?.status === 'CRIADA') && (
                  <button
                    onClick={handleDesfazerSorteio}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Desfazer Sorteio
                  </button>
                )}
                <button
                  onClick={() => {
                    // Verificar se há jogos gerados
                    if (jogos.length > 0) {
                      alert('Não é possível adicionar atletas após os jogos serem gerados. Desfaça o sorteio primeiro.');
                      return;
                    }
                    // Verificar limite antes de abrir
                    if (tipo === 'SUPER_8' && atletasParticipantes.length >= 8) {
                      alert('Super 8 permite no máximo 8 participantes');
                      return;
                    }
                    setMostrarBuscaAtleta(!mostrarBuscaAtleta);
                    if (!mostrarBuscaAtleta) {
                      // Quando abrir, fazer busca inicial vazia para mostrar todos os atletas
                      setBuscaAtleta('');
                      buscarAtletas();
                    } else {
                      // Quando fechar, limpar
                      setBuscaAtleta('');
                      setAtletasDisponiveis([]);
                      setAtletaSelecionado('');
                      setParceiroSelecionado('');
                    }
                  }}
                  disabled={(tipo === 'SUPER_8' && atletasParticipantes.length >= 8) || jogos.length > 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    (tipo === 'SUPER_8' && atletasParticipantes.length >= 8) || jogos.length > 0
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Atleta
                  {tipo === 'SUPER_8' && (
                    <span className="text-xs ml-1">
                      ({atletasParticipantes.length}/8)
                    </span>
                  )}
                </button>
              </div>
            </div>

            {mostrarBuscaAtleta && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Atleta
                  </label>
                  <input
                    type="text"
                    value={buscaAtleta}
                    onChange={(e) => setBuscaAtleta(e.target.value)}
                    placeholder="Digite o nome do atleta..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    autoFocus
                  />
                </div>

                {buscandoAtletas && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Buscando...</p>
                  </div>
                )}

                {!buscandoAtletas && atletasDisponiveis.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    {buscaAtleta.trim() 
                      ? 'Nenhum atleta encontrado' 
                      : 'Digite o nome do atleta para buscar'}
                  </div>
                )}

                {!buscandoAtletas && atletasDisponiveis.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Clique no atleta para adicionar individualmente:
                    </div>
                    {atletasDisponiveis
                      .filter(a => {
                        // Filtrar atletas já adicionados
                        if (atletasParticipantes.some(ap => ap.atletaId === a.id)) {
                          return false;
                        }
                        return true;
                      })
                      .map((atleta) => {
                        const jaAdicionado = atletasParticipantes.some(ap => ap.atletaId === atleta.id);

                        return (
                          <div
                            key={atleta.id}
                            className={`p-3 border rounded-lg transition-all cursor-pointer ${
                              'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                            } ${jaAdicionado ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (jaAdicionado) return;
                              adicionarAtletaDireto(atleta.id);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {atleta.nome}
                                  </div>
                                  {atleta.fone && (
                                    <div className="text-xs text-gray-500">{atleta.fone}</div>
                                  )}
                                </div>
                              </div>
                              {!jaAdicionado && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adicionarAtletaDireto(atleta.id);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                  Adicionar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Sempre mostrar atletas individuais - as duplas só existem nos jogos */}
            <div className="space-y-2">
              {atletasParticipantes.length > 0 ? (
                atletasParticipantes.map((participante) => (
                  <div key={participante.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-emerald-600" />
                      <div>
                        <div className="font-semibold text-gray-900">{participante.atleta?.nome}</div>
                        {participante.atleta?.fone && (
                          <div className="text-sm text-gray-500">{participante.atleta.fone}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removerAtleta(participante.atletaId)}
                      disabled={jogos.length > 0}
                      className={`p-2 rounded-lg transition-colors ${
                        jogos.length > 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title={jogos.length > 0 ? 'Não é possível remover atletas após os jogos serem gerados' : 'Remover atleta'}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhum atleta adicionado ainda</p>
              )}
            </div>
          </div>
        )}

        {/* Jogos da Competição */}
        {competicaoId && jogos.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PlayCircle className="w-6 h-6" />
              Jogos da Competição
            </h2>
            <div className="space-y-4">
              {(() => {
                // Agrupar jogos por rodada
                const rodadasMap = new Map<string, typeof jogos>();
                jogos.forEach(jogo => {
                  if (!rodadasMap.has(jogo.rodada)) {
                    rodadasMap.set(jogo.rodada, []);
                  }
                  rodadasMap.get(jogo.rodada)!.push(jogo);
                });

                // Ordenar rodadas
                const ordemRodadas = [
                  'RODADA_1', 'RODADA_2', 'RODADA_3', 'RODADA_4', 'RODADA_5', 'RODADA_6', 'RODADA_7',
                  'QUARTAS_FINAL', 'SEMIFINAL', 'FINAL'
                ];
                const rodadasOrdenadas = ordemRodadas.filter(r => rodadasMap.has(r));

                return rodadasOrdenadas.map((rodada) => {
                  const jogosRodada = rodadasMap.get(rodada)!;
                  if (jogosRodada.length === 0) return null;

                  const rodadaLabel: Record<string, string> = {
                    RODADA_1: 'Rodada 1',
                    RODADA_2: 'Rodada 2',
                    RODADA_3: 'Rodada 3',
                    RODADA_4: 'Rodada 4',
                    RODADA_5: 'Rodada 5',
                    RODADA_6: 'Rodada 6',
                    RODADA_7: 'Rodada 7',
                    QUARTAS_FINAL: 'Quartas de Final',
                    SEMIFINAL: 'Semifinais',
                    FINAL: 'Final',
                  };

                return (
                  <div key={rodada} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">{rodadaLabel[rodada]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {jogosRodada.map((jogo) => (
                        <div 
                          key={jogo.id} 
                          onClick={() => abrirModalResultado(jogo)}
                          className="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600">Jogo {jogo.numeroJogo}</span>
                            {jogo.status && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                jogo.status === 'CONCLUIDO' ? 'bg-green-100 text-green-800' :
                                jogo.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {jogo.status === 'CONCLUIDO' ? 'Concluído' :
                                 jogo.status === 'EM_ANDAMENTO' ? 'Em Andamento' :
                                 'Agendado'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{jogo.participante1?.nome || 'TBD'}</span>
                            {jogo.gamesAtleta1 !== null && jogo.gamesAtleta2 !== null ? (
                              <span className="font-bold text-blue-600">
                                {jogo.gamesAtleta1} - {jogo.gamesAtleta2}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Clique para inserir resultado</span>
                            )}
                            <span className="text-gray-400">VS</span>
                            <span className="font-medium">{jogo.participante2?.nome || 'TBD'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          </div>
        )}

        {/* Classificação */}
        {jogos.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Classificação
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atleta</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vitórias</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Derrotas</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games Feitos</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games Sofridos</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {calcularClassificacao().map((atleta, index) => (
                    <tr key={atleta.atletaId} className={index === 0 ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {index + 1}º
                        {index === 0 && <span className="ml-2">🏆</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{atleta.nome}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{atleta.vitorias}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.derrotas}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.gamesFeitos}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.gamesSofridos}</td>
                      <td className={`px-4 py-3 text-sm text-center font-semibold ${
                        atleta.saldoGames > 0 ? 'text-green-600' : 
                        atleta.saldoGames < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {atleta.saldoGames > 0 ? '+' : ''}{atleta.saldoGames}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal de Resultado */}
        {mostrarModalResultado && jogoEditando && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Inserir Resultado</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {jogoEditando.participante1?.nome || 'Participante 1'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gamesAtleta1}
                    onChange={(e) => setGamesAtleta1(e.target.value)}
                    placeholder="Games"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="text-center text-gray-400 font-bold">VS</div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {jogoEditando.participante2?.nome || 'Participante 2'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gamesAtleta2}
                    onChange={(e) => setGamesAtleta2(e.target.value)}
                    placeholder="Games"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Digite o placar de games (ex: 5x4, 3x3, 6x5). O vencedor será calculado automaticamente.
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={fecharModalResultado}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarResultado}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-4 justify-end pt-4 border-t">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : competicaoId ? 'Salvar Alterações' : 'Criar Competição'}
          </button>
        </div>
      </div>
    </div>
  );
}

