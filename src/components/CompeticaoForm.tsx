// components/CompeticaoForm.tsx - Formulário de criação/edição de competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { competicaoService } from '@/services/competicaoService';
import { pointService, quadraService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Competicao, FormatoCompeticao } from '@/types/competicao';
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
  const [formato, setFormato] = useState<FormatoCompeticao>('INDIVIDUAL');
  const [quadraId, setQuadraId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorInscricao, setValorInscricao] = useState<string>('');
  const [premio, setPremio] = useState('');
  const [regras, setRegras] = useState('');

  // Atletas
  const [atletasDisponiveis, setAtletasDisponiveis] = useState<Atleta[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);
  const [buscandoAtletas, setBuscandoAtletas] = useState(false);
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [mostrarBuscaAtleta, setMostrarBuscaAtleta] = useState(false);

  // Para duplas
  const [atletaSelecionado, setAtletaSelecionado] = useState<string>('');
  const [parceiroSelecionado, setParceiroSelecionado] = useState<string>('');

  // Quadras
  const [quadras, setQuadras] = useState<any[]>([]);

  // Jogos
  const [jogos, setJogos] = useState<any[]>([]);

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

      // Carregar quadras
      const quadrasData = await quadraService.listar(pointId);
      setQuadras(quadrasData);

      // Se estiver editando, carregar competição
      if (competicaoId) {
        const competicaoData = await competicaoService.obter(competicaoId);
        setCompeticao(competicaoData);
        setNome(competicaoData.nome);
        setFormato(competicaoData.formato);
        setQuadraId(competicaoData.quadraId || '');
        setDataInicio(competicaoData.dataInicio ? competicaoData.dataInicio.split('T')[0] : '');
        setDataFim(competicaoData.dataFim ? competicaoData.dataFim.split('T')[0] : '');
        setDescricao(competicaoData.descricao || '');
        setValorInscricao(competicaoData.valorInscricao?.toString() || '');
        setPremio(competicaoData.premio || '');
        setRegras(competicaoData.regras || '');
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

    // Verificar se atleta já está adicionado
    if (atletasParticipantes.some(ap => ap.atletaId === atletaId)) {
      alert('Este atleta já está na competição');
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

    if (!atletaSelecionado || !parceiroSelecionado) {
      alert('Selecione ambos os atletas para formar a dupla');
      return;
    }

    if (atletaSelecionado === parceiroSelecionado) {
      alert('Um atleta não pode ser parceiro de si mesmo');
      return;
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
    
    if (!confirm('Tem certeza que deseja gerar o sorteio dos jogos? Esta ação não pode ser desfeita.')) {
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
        tipo: 'SUPER_8' as const,
        formato,
        quadraId: quadraId || null,
        dataInicio: dataInicio ? new Date(dataInicio).toISOString() : null,
        dataFim: dataFim ? new Date(dataFim).toISOString() : null,
        descricao: descricao.trim() || null,
        valorInscricao: valorInscricao ? parseFloat(valorInscricao) : null,
        premio: premio.trim() || null,
        regras: regras.trim() || null,
        configSuper8: null,
      };

      if (competicaoId) {
        await competicaoService.atualizar(competicaoId, payload);
        alert('Competição atualizada com sucesso!');
      } else {
        const novaCompeticao = await competicaoService.criar(payload);
        alert('Competição criada com sucesso!');
        router.push(`/app/arena/competicoes/${novaCompeticao.id}`);
        return;
      }

      // Recarregar competição
      if (competicaoId) {
        const competicaoData = await competicaoService.obter(competicaoId);
        setCompeticao(competicaoData);
        setAtletasParticipantes(competicaoData.atletasParticipantes || []);
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

  // Agrupar duplas
  const duplasAgrupadas = formato === 'DUPLAS' && atletasParticipantes.length > 0
    ? atletasParticipantes.reduce((acc: any, item: any) => {
        if (item.parceriaId) {
          if (!acc[item.parceriaId]) {
            acc[item.parceriaId] = [];
          }
          acc[item.parceriaId].push(item);
        }
        return acc;
      }, {})
    : {};

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Formato *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="INDIVIDUAL"
                    checked={formato === 'INDIVIDUAL'}
                    onChange={(e) => setFormato(e.target.value as FormatoCompeticao)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <User className="w-5 h-5" />
                  <span>Individual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="DUPLAS"
                    checked={formato === 'DUPLAS'}
                    onChange={(e) => setFormato(e.target.value as FormatoCompeticao)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <Users className="w-5 h-5" />
                  <span>Duplas</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quadra</label>
              <select
                value={quadraId}
                onChange={(e) => setQuadraId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Selecione uma quadra (opcional)</option>
                {quadras.map((q) => (
                  <option key={q.id} value={q.id}>{q.nome}</option>
                ))}
              </select>
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
              <input
                type="text"
                value={premio}
                onChange={(e) => setPremio(e.target.value)}
                placeholder="Ex: Troféu + R$ 500,00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
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
                Atletas Participantes ({atletasParticipantes.length})
                {atletasParticipantes.length === 8 && (
                  <span className="ml-2 text-sm font-normal text-green-600">✓ Pronto para gerar jogos</span>
                )}
              </h2>
              <div className="flex gap-2">
                {atletasParticipantes.length === 8 && competicao?.status === 'CRIADA' && (
                  <button
                    onClick={handleGerarJogos}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    <Trophy className="w-5 h-5" />
                    Gerar Sorteio dos Jogos
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
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Atleta
                </button>
              </div>
            </div>

            {mostrarBuscaAtleta && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Atleta {formato === 'DUPLAS' && (atletaSelecionado || parceiroSelecionado) && (
                      <span className="ml-2 text-xs text-blue-600">
                        ({atletaSelecionado ? '1º selecionado' : ''} {parceiroSelecionado ? '2º selecionado' : ''})
                      </span>
                    )}
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
                      {formato === 'DUPLAS' 
                        ? 'Clique nos atletas para selecionar a dupla (2 atletas):' 
                        : 'Clique no atleta para adicionar diretamente:'}
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
                        const selecionado1 = atletaSelecionado === atleta.id;
                        const selecionado2 = parceiroSelecionado === atleta.id;
                        const selecionado = selecionado1 || selecionado2;

                        return (
                          <div
                            key={atleta.id}
                            className={`p-3 border rounded-lg transition-all cursor-pointer ${
                              selecionado
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                            } ${jaAdicionado ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (jaAdicionado) return;
                              if (formato === 'INDIVIDUAL') {
                                adicionarAtletaDireto(atleta.id);
                              } else {
                                selecionarAtletaParaDupla(atleta.id);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <User className={`w-5 h-5 ${selecionado ? 'text-blue-600' : 'text-gray-400'}`} />
                                <div>
                                  <div className={`font-medium ${selecionado ? 'text-blue-900' : 'text-gray-900'}`}>
                                    {atleta.nome}
                                    {selecionado1 && <span className="ml-2 text-xs text-blue-600">(1º selecionado)</span>}
                                    {selecionado2 && <span className="ml-2 text-xs text-blue-600">(2º selecionado)</span>}
                                  </div>
                                  {atleta.fone && (
                                    <div className="text-xs text-gray-500">{atleta.fone}</div>
                                  )}
                                </div>
                              </div>
                              {formato === 'INDIVIDUAL' && !jaAdicionado && (
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

                {formato === 'DUPLAS' && atletaSelecionado && parceiroSelecionado && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-blue-900">Dupla selecionada:</div>
                        <div className="text-sm text-blue-700 mt-1">
                          {atletasDisponiveis.find(a => a.id === atletaSelecionado)?.nome} & {' '}
                          {atletasDisponiveis.find(a => a.id === parceiroSelecionado)?.nome}
                        </div>
                      </div>
                      <button
                        onClick={adicionarDupla}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                      >
                        Adicionar Dupla
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setAtletaSelecionado('');
                        setParceiroSelecionado('');
                      }}
                      className="mt-2 text-xs text-gray-600 hover:text-gray-800 underline"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>
            )}

            {formato === 'DUPLAS' ? (
              <div className="space-y-4">
                {Object.keys(duplasAgrupadas).length > 0 ? (
                  Object.entries(duplasAgrupadas).map(([parceriaId, dupla]: [string, any]) => (
                    <div key={parceriaId} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-emerald-600" />
                          <div>
                            <div className="font-semibold text-gray-900">
                              {dupla[0]?.atleta?.nome} & {dupla[1]?.atleta?.nome}
                            </div>
                            <div className="text-sm text-gray-500">Dupla</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removerAtleta(dupla[0].atletaId)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover dupla"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhuma dupla adicionada ainda</p>
                )}
              </div>
            ) : (
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
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover atleta"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum atleta adicionado ainda</p>
                )}
              </div>
            )}
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
                        <div key={jogo.id} className="bg-white rounded-lg p-3 border border-gray-200">
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
                            {jogo.gamesAtleta1 !== null && jogo.gamesAtleta2 !== null && (
                              <span className="font-bold text-blue-600">
                                {jogo.gamesAtleta1} - {jogo.gamesAtleta2}
                              </span>
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

