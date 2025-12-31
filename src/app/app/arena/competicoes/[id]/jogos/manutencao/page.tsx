// app/app/arena/competicoes/[id]/jogos/manutencao/page.tsx - Manutenção de jogos da competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import type { Competicao, JogoCompeticao } from '@/types/competicao';
import { ArrowLeft, Save, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ManutencaoJogosPage() {
  const router = useRouter();
  const params = useParams();
  const competicaoId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [jogos, setJogos] = useState<JogoCompeticao[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);
  const [jogoEditando, setJogoEditando] = useState<JogoCompeticao | null>(null);
  const [mostrarModalEdicao, setMostrarModalEdicao] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Estados para edição de atletas
  const [atleta1Id, setAtleta1Id] = useState<string>('');
  const [atleta2Id, setAtleta2Id] = useState<string>('');
  const [atleta3Id, setAtleta3Id] = useState<string>('');
  const [atleta4Id, setAtleta4Id] = useState<string>('');

  useEffect(() => {
    if (competicaoId) {
      carregarDados();
    }
  }, [competicaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro('');
      const [competicaoData, jogosData] = await Promise.all([
        competicaoService.obter(competicaoId),
        competicaoService.listarJogos(competicaoId),
      ]);
      setCompeticao(competicaoData);
      setJogos(jogosData || []);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEdicao = (jogo: JogoCompeticao) => {
    setJogoEditando(jogo);
    // Preencher com os atletas atuais
    if (jogo.participante1?.dupla) {
      setAtleta1Id(jogo.participante1.dupla.atleta1.id);
      setAtleta2Id(jogo.participante1.dupla.atleta2.id);
    } else if (jogo.participante1?.atletaId) {
      setAtleta1Id(jogo.participante1.atletaId);
      setAtleta2Id('');
    }

    if (jogo.participante2?.dupla) {
      setAtleta3Id(jogo.participante2.dupla.atleta1.id);
      setAtleta4Id(jogo.participante2.dupla.atleta2.id);
    } else if (jogo.participante2?.atletaId) {
      setAtleta3Id(jogo.participante2.atletaId);
      setAtleta4Id('');
    }

    setErro('');
    setSucesso('');
    setMostrarModalEdicao(true);
  };

  const fecharModalEdicao = () => {
    setMostrarModalEdicao(false);
    setJogoEditando(null);
    setAtleta1Id('');
    setAtleta2Id('');
    setAtleta3Id('');
    setAtleta4Id('');
    setErro('');
    setSucesso('');
  };

  const salvarEdicao = async () => {
    if (!jogoEditando) return;

    setSaving(true);
    setErro('');
    setSucesso('');

    try {
      // Validar que os atletas foram selecionados
      if (competicao?.formato === 'DUPLAS') {
        if (!atleta1Id || !atleta2Id || !atleta3Id || !atleta4Id) {
          setErro('Para competição de duplas, todos os 4 atletas são obrigatórios');
          setSaving(false);
          return;
        }
      } else {
        if (!atleta1Id || !atleta2Id) {
          setErro('Para competição individual, pelo menos 2 atletas são obrigatórios');
          setSaving(false);
          return;
        }
      }

      // Fazer requisição PATCH para atualizar atletas
      const payload: any = {
        atleta1Id,
        atleta2Id,
      };

      if (competicao?.formato === 'DUPLAS') {
        payload.atleta3Id = atleta3Id;
        payload.atleta4Id = atleta4Id;
      }

      await competicaoService.atualizarAtletasJogo(
        competicaoId,
        jogoEditando.id,
        payload
      );

      setSucesso('Atletas do jogo atualizados com sucesso!');
      
      // Recarregar dados após um breve delay
      setTimeout(() => {
        carregarDados();
        fecharModalEdicao();
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao atualizar atletas:', error);
      setErro(
        error?.response?.data?.mensagem ||
        error?.response?.data?.error ||
        'Erro ao atualizar atletas do jogo'
      );
    } finally {
      setSaving(false);
    }
  };

  // Agrupar jogos por rodada
  const rodadasMap = new Map<string, JogoCompeticao[]>();
  jogos.forEach(jogo => {
    if (!rodadasMap.has(jogo.rodada)) {
      rodadasMap.set(jogo.rodada, []);
    }
    rodadasMap.get(jogo.rodada)!.push(jogo);
  });

  const ordemRodadas = [
    'RODADA_1', 'RODADA_2', 'RODADA_3', 'RODADA_4', 'RODADA_5', 'RODADA_6', 'RODADA_7',
    'QUARTAS_FINAL', 'SEMIFINAL', 'FINAL'
  ];
  const rodadasOrdenadas = ordemRodadas.filter(r => rodadasMap.has(r));

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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando jogos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              Manutenção de Jogos - {competicao?.nome}
            </h1>
            <p className="text-gray-600 mt-2">
              Edite os atletas de cada jogo rodada por rodada. Use este recurso para importar competições antigas e manter histórico.
            </p>
          </div>
        </div>
      </div>

      {erro && !mostrarModalEdicao && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{erro}</p>
        </div>
      )}

      {sucesso && !mostrarModalEdicao && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{sucesso}</p>
        </div>
      )}

      {/* Lista de jogos por rodada */}
      <div className="space-y-6">
        {rodadasOrdenadas.map(rodada => {
          const jogosRodada = rodadasMap.get(rodada) || [];
          return (
            <div key={rodada} className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {rodadaLabel[rodada] || rodada}
              </h2>
              <div className="space-y-3">
                {jogosRodada.map(jogo => (
                  <div
                    key={jogo.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Participante 1</p>
                            <p className="text-gray-900">
                              {jogo.participante1?.nome || 'Não definido'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Participante 2</p>
                            <p className="text-gray-900">
                              {jogo.participante2?.nome || 'Não definido'}
                            </p>
                          </div>
                        </div>
                        {jogo.status === 'CONCLUIDO' && jogo.gamesAtleta1 !== null && jogo.gamesAtleta2 !== null && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600">
                              Placar: <span className="font-semibold">{jogo.gamesAtleta1} x {jogo.gamesAtleta2}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => abrirModalEdicao(jogo)}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Editar Atletas
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Edição */}
      {mostrarModalEdicao && jogoEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Editar Atletas do Jogo
                </h2>
                <button
                  onClick={fecharModalEdicao}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {erro && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800 text-sm">{erro}</p>
                </div>
              )}

              {sucesso && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-800 text-sm">{sucesso}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Rodada: <span className="font-semibold">{rodadaLabel[jogoEditando.rodada] || jogoEditando.rodada}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Jogo: <span className="font-semibold">#{jogoEditando.numeroJogo}</span>
                  </p>
                </div>

                {competicao?.formato === 'DUPLAS' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dupla 1 - Atleta 1 *
                      </label>
                      <select
                        value={atleta1Id}
                        onChange={(e) => setAtleta1Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta2Id && p.atletaId !== atleta3Id && p.atletaId !== atleta4Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dupla 1 - Atleta 2 *
                      </label>
                      <select
                        value={atleta2Id}
                        onChange={(e) => setAtleta2Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta1Id && p.atletaId !== atleta3Id && p.atletaId !== atleta4Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dupla 2 - Atleta 1 *
                      </label>
                      <select
                        value={atleta3Id}
                        onChange={(e) => setAtleta3Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta1Id && p.atletaId !== atleta2Id && p.atletaId !== atleta4Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dupla 2 - Atleta 2 *
                      </label>
                      <select
                        value={atleta4Id}
                        onChange={(e) => setAtleta4Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta1Id && p.atletaId !== atleta2Id && p.atletaId !== atleta3Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Atleta 1 *
                      </label>
                      <select
                        value={atleta1Id}
                        onChange={(e) => setAtleta1Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta2Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Atleta 2 *
                      </label>
                      <select
                        value={atleta2Id}
                        onChange={(e) => setAtleta2Id(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione um atleta</option>
                        {atletasParticipantes
                          .filter((p: any) => p.atletaId !== atleta1Id)
                          .map((participante: any) => (
                            <option key={participante.atletaId} value={participante.atletaId}>
                              {participante.atleta?.nome || 'Atleta'}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={fecharModalEdicao}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEdicao}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

