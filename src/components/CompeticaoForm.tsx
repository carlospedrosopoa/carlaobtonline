// components/CompeticaoForm.tsx - Formulário de criação/edição de competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { competicaoService } from '@/services/competicaoService';
import { pointService, quadraService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Competicao, FormatoCompeticao } from '@/types/competicao';
import { Trophy, ArrowLeft, Save, Plus, X, Users, User } from 'lucide-react';

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

  useEffect(() => {
    carregarDados();
  }, [competicaoId]);

  useEffect(() => {
    if (buscaAtleta.trim()) {
      buscarAtletas();
    }
  }, [buscaAtleta]);

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
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao carregar dados');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const buscarAtletas = async () => {
    try {
      setBuscandoAtletas(true);
      const { data } = await api.get(`/atleta/para-selecao?busca=${encodeURIComponent(buscaAtleta)}`);
      setAtletasDisponiveis(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar atletas:', error);
    } finally {
      setBuscandoAtletas(false);
    }
  };

  const adicionarAtleta = async () => {
    if (!competicaoId) {
      alert('Salve a competição primeiro antes de adicionar atletas');
      return;
    }

    try {
      if (formato === 'DUPLAS') {
        if (!atletaSelecionado || !parceiroSelecionado) {
          alert('Selecione ambos os atletas para formar a dupla');
          return;
        }
        if (atletaSelecionado === parceiroSelecionado) {
          alert('Um atleta não pode ser parceiro de si mesmo');
          return;
        }

        await competicaoService.adicionarAtleta(competicaoId, {
          atletaId: atletaSelecionado,
          parceiroAtletaId: parceiroSelecionado,
        });
      } else {
        if (!atletaSelecionado) {
          alert('Selecione um atleta');
          return;
        }

        await competicaoService.adicionarAtleta(competicaoId, {
          atletaId: atletaSelecionado,
        });
      }

      // Recarregar competição
      const competicaoData = await competicaoService.obter(competicaoId);
      setCompeticao(competicaoData);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);

      // Limpar seleções
      setAtletaSelecionado('');
      setParceiroSelecionado('');
      setBuscaAtleta('');
      setMostrarBuscaAtleta(false);
      setAtletasDisponiveis([]);

      alert('Atleta adicionado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar atleta:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao adicionar atleta');
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
              </h2>
              <button
                onClick={() => setMostrarBuscaAtleta(!mostrarBuscaAtleta)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Adicionar Atleta
              </button>
            </div>

            {mostrarBuscaAtleta && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Atleta</label>
                  <input
                    type="text"
                    value={buscaAtleta}
                    onChange={(e) => setBuscaAtleta(e.target.value)}
                    placeholder="Digite o nome do atleta..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                {atletasDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {formato === 'DUPLAS' ? 'Selecione o primeiro atleta:' : 'Selecione o atleta:'}
                      </label>
                      <select
                        value={atletaSelecionado}
                        onChange={(e) => setAtletaSelecionado(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        <option value="">Selecione...</option>
                        {atletasDisponiveis
                          .filter(a => !atletasParticipantes.some(ap => ap.atletaId === a.id))
                          .map((atleta) => (
                            <option key={atleta.id} value={atleta.id}>{atleta.nome}</option>
                          ))}
                      </select>
                    </div>

                    {formato === 'DUPLAS' && atletaSelecionado && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o parceiro:</label>
                        <select
                          value={parceiroSelecionado}
                          onChange={(e) => setParceiroSelecionado(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                          <option value="">Selecione...</option>
                          {atletasDisponiveis
                            .filter(a => 
                              a.id !== atletaSelecionado && 
                              !atletasParticipantes.some(ap => ap.atletaId === a.id)
                            )
                            .map((atleta) => (
                              <option key={atleta.id} value={atleta.id}>{atleta.nome}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={adicionarAtleta}
                      disabled={!atletaSelecionado || (formato === 'DUPLAS' && !parceiroSelecionado)}
                      className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {formato === 'DUPLAS' ? 'Adicionar Dupla' : 'Adicionar Atleta'}
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

