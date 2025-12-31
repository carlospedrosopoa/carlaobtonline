// app/app/arena/competicoes/[id]/jogos/page.tsx - Página de jogos da competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import type { Competicao } from '@/types/competicao';
import { PlayCircle, ArrowLeft, Trophy, Users, Settings } from 'lucide-react';

export default function JogosCompeticaoPage() {
  const router = useRouter();
  const params = useParams();
  const competicaoId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [jogos, setJogos] = useState<any[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [jogoEditando, setJogoEditando] = useState<any | null>(null);
  const [mostrarModalResultado, setMostrarModalResultado] = useState(false);
  const [gamesAtleta1, setGamesAtleta1] = useState<string>('');
  const [gamesAtleta2, setGamesAtleta2] = useState<string>('');
  const [atleta1Selecionado, setAtleta1Selecionado] = useState<string>('');
  const [atleta2Selecionado, setAtleta2Selecionado] = useState<string>('');

  useEffect(() => {
    if (competicaoId) {
      carregarDados();
    }
  }, [competicaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [competicaoData, jogosData] = await Promise.all([
        competicaoService.obter(competicaoId),
        competicaoService.listarJogos(competicaoId),
      ]);
      setCompeticao(competicaoData);
      setJogos(jogosData || []);
      setAtletasParticipantes(competicaoData.atletasParticipantes || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
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

  // Calcular head to head entre dois atletas
  const calcularHeadToHead = (atleta1Id: string, atleta2Id: string) => {
    if (!jogos || jogos.length === 0) return { jogos: [], vitoriasAtleta1: 0, vitoriasAtleta2: 0, gamesAtleta1: 0, gamesAtleta2: 0 };

    // Filtrar jogos onde ambos os atletas participaram em lados opostos
    const jogosHeadToHead = jogos.filter((jogo: any) => {
      if (!jogo.participante1?.dupla || !jogo.participante2?.dupla) return false;
      
      const dupla1Ids = [jogo.participante1.dupla.atleta1.id, jogo.participante1.dupla.atleta2.id];
      const dupla2Ids = [jogo.participante2.dupla.atleta1.id, jogo.participante2.dupla.atleta2.id];
      
      // Verificar se atleta1 está em uma dupla e atleta2 está na outra
      const atleta1NaDupla1 = dupla1Ids.includes(atleta1Id);
      const atleta1NaDupla2 = dupla2Ids.includes(atleta1Id);
      const atleta2NaDupla1 = dupla1Ids.includes(atleta2Id);
      const atleta2NaDupla2 = dupla2Ids.includes(atleta2Id);
      
      return (atleta1NaDupla1 && atleta2NaDupla2) || (atleta1NaDupla2 && atleta2NaDupla1);
    });

    // Calcular estatísticas
    let vitoriasAtleta1 = 0;
    let vitoriasAtleta2 = 0;
    let gamesAtleta1 = 0;
    let gamesAtleta2 = 0;

    jogosHeadToHead.forEach((jogo: any) => {
      if (jogo.status === 'CONCLUIDO' && 
          jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined &&
          jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined) {
        const dupla1Ids = [jogo.participante1.dupla.atleta1.id, jogo.participante1.dupla.atleta2.id];
        const dupla2Ids = [jogo.participante2.dupla.atleta1.id, jogo.participante2.dupla.atleta2.id];
        
        // Determinar em qual dupla cada atleta está
        const atleta1NaDupla1 = dupla1Ids.includes(atleta1Id);
        const atleta1NaDupla2 = dupla2Ids.includes(atleta1Id);
        const atleta2NaDupla1 = dupla1Ids.includes(atleta2Id);
        const atleta2NaDupla2 = dupla2Ids.includes(atleta2Id);
        
        // Obter os games de cada dupla
        const gamesDupla1 = jogo.gamesAtleta1 || 0;
        const gamesDupla2 = jogo.gamesAtleta2 || 0;
        
        // Atribuir games ao atleta1 baseado em qual dupla ele está
        if (atleta1NaDupla1) {
          gamesAtleta1 += gamesDupla1;
        } else if (atleta1NaDupla2) {
          gamesAtleta1 += gamesDupla2;
        }
        
        // Atribuir games ao atleta2 baseado em qual dupla ele está
        if (atleta2NaDupla1) {
          gamesAtleta2 += gamesDupla1;
        } else if (atleta2NaDupla2) {
          gamesAtleta2 += gamesDupla2;
        }
        
        // Calcular vitórias: verificar qual dupla ganhou e atribuir ao atleta correto
        if (gamesDupla1 > gamesDupla2) {
          // Dupla1 ganhou
          if (atleta1NaDupla1) {
            vitoriasAtleta1++;
          } else if (atleta2NaDupla1) {
            vitoriasAtleta2++;
          }
        } else if (gamesDupla2 > gamesDupla1) {
          // Dupla2 ganhou
          if (atleta1NaDupla2) {
            vitoriasAtleta1++;
          } else if (atleta2NaDupla2) {
            vitoriasAtleta2++;
          }
        }
      }
    });

    return {
      jogos: jogosHeadToHead,
      vitoriasAtleta1,
      vitoriasAtleta2,
      gamesAtleta1,
      gamesAtleta2,
    };
  };

  const salvarResultado = async () => {
    if (!competicaoId || !jogoEditando) return;

    try {
      setSaving(true);
      
      // Converter strings para números, tratando strings vazias e valores inválidos
      const converterParaNumero = (valor: string): number | null => {
        if (!valor || valor.trim() === '') {
          return null;
        }
        const num = parseInt(valor, 10);
        return isNaN(num) ? null : num;
      };

      await competicaoService.atualizarResultadoJogo(competicaoId, jogoEditando.id, {
        gamesAtleta1: converterParaNumero(gamesAtleta1),
        gamesAtleta2: converterParaNumero(gamesAtleta2),
      });
      
      await carregarDados();
      fecharModalResultado();
    } catch (error: any) {
      console.error('Erro ao salvar resultado:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao salvar resultado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando jogos...</p>
        </div>
      </div>
    );
  }

  if (!competicao) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Competição não encontrada</p>
        </div>
      </div>
    );
  }

  // Agrupar jogos por rodada
  const rodadasMap = new Map<string, typeof jogos>();
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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <PlayCircle className="w-8 h-8 text-blue-500" />
            Jogos - {competicao.nome}
          </h1>
          <button
            onClick={() => router.push(`/app/arena/competicoes/${competicaoId}/jogos/manutencao`)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            title="Manutenção de jogos - Editar atletas rodada por rodada"
          >
            <Settings className="w-4 h-4" />
            Manutenção
          </button>
        </div>
      </div>

      {/* Seção Head to Head */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Head to Head</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Atleta 1
            </label>
            <select
              value={atleta1Selecionado}
              onChange={(e) => {
                setAtleta1Selecionado(e.target.value);
                if (e.target.value === atleta2Selecionado) {
                  setAtleta2Selecionado('');
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Selecione um atleta</option>
              {atletasParticipantes.map((participante: any) => (
                <option key={participante.atletaId} value={participante.atletaId}>
                  {participante.atleta?.nome || 'Atleta'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Atleta 2
            </label>
            <select
              value={atleta2Selecionado}
              onChange={(e) => setAtleta2Selecionado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={atleta1Selecionado === ''}
            >
              <option value="">Selecione um atleta</option>
              {atletasParticipantes
                .filter((participante: any) => participante.atletaId !== atleta1Selecionado)
                .map((participante: any) => (
                  <option key={participante.atletaId} value={participante.atletaId}>
                    {participante.atleta?.nome || 'Atleta'}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {atleta1Selecionado && atleta2Selecionado && (() => {
          const atleta1 = atletasParticipantes.find((p: any) => p.atletaId === atleta1Selecionado);
          const atleta2 = atletasParticipantes.find((p: any) => p.atletaId === atleta2Selecionado);
          const headToHead = calcularHeadToHead(atleta1Selecionado, atleta2Selecionado);

          return (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {atleta1?.atleta?.nome || 'Atleta 1'} vs {atleta2?.atleta?.nome || 'Atleta 2'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Vitórias</p>
                    <p className="text-2xl font-bold text-blue-600">{headToHead.vitoriasAtleta1}</p>
                    <p className="text-xs text-gray-500">{atleta1?.atleta?.nome}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Vitórias</p>
                    <p className="text-2xl font-bold text-blue-600">{headToHead.vitoriasAtleta2}</p>
                    <p className="text-xs text-gray-500">{atleta2?.atleta?.nome}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Games Feitos</p>
                    <p className="text-xl font-semibold text-gray-900">{headToHead.gamesAtleta1}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Games Feitos</p>
                    <p className="text-xl font-semibold text-gray-900">{headToHead.gamesAtleta2}</p>
                  </div>
                </div>
              </div>

              {headToHead.jogos.length > 0 ? (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">
                    Jogos ({headToHead.jogos.length})
                  </h4>
                  <div className="space-y-2">
                    {headToHead.jogos.map((jogo: any) => {
                      const dupla1Ids = [jogo.participante1.dupla.atleta1.id, jogo.participante1.dupla.atleta2.id];
                      const atleta1NaDupla1 = dupla1Ids.includes(atleta1Selecionado);
                      const games1 = jogo.gamesAtleta1;
                      const games2 = jogo.gamesAtleta2;
                      
                      return (
                        <div
                          key={jogo.id}
                          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {jogo.participante1?.nome || 'TBD'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {jogo.rodada.replace('_', ' ')} - Jogo {jogo.numeroJogo}
                              </p>
                            </div>
                            {jogo.status === 'CONCLUIDO' && games1 !== null && games2 !== null ? (
                              <div className="text-center">
                                <p className={`text-lg font-bold ${
                                  atleta1NaDupla1
                                    ? (games1 > games2 ? 'text-green-600' : games2 > games1 ? 'text-red-600' : 'text-gray-600')
                                    : (games2 > games1 ? 'text-green-600' : games1 > games2 ? 'text-red-600' : 'text-gray-600')
                                }`}>
                                  {games1} x {games2}
                                </p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <p className="text-sm text-gray-400">Aguardando resultado</p>
                              </div>
                            )}
                            <div className="flex-1 text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {jogo.participante2?.nome || 'TBD'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>Nenhum jogo encontrado entre estes atletas.</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="space-y-6">
        {rodadasOrdenadas.map((rodada) => {
          const jogosRodada = rodadasMap.get(rodada)!;
          if (jogosRodada.length === 0) return null;

          return (
            <div key={rodada} className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{rodadaLabel[rodada]}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jogosRodada.map((jogo) => {
                  const competicaoConcluida = competicao?.status === 'CONCLUIDA';
                  return (
                  <div 
                    key={jogo.id} 
                    onClick={() => !competicaoConcluida && abrirModalResultado(jogo)}
                    className={`bg-white rounded-lg p-3 border border-gray-200 transition-all ${
                      competicaoConcluida 
                        ? 'cursor-not-allowed opacity-75' 
                        : 'cursor-pointer hover:border-blue-300 hover:shadow-md'
                    }`}
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
                      {jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined && 
                       jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined ? (
                        <span className="font-bold text-blue-600">
                          {jogo.gamesAtleta1} - {jogo.gamesAtleta2}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          {competicaoConcluida ? 'Resultado não disponível' : 'Clique para inserir resultado'}
                        </span>
                      )}
                      <span className="text-gray-400">VS</span>
                      <span className="font-medium">{jogo.participante2?.nome || 'TBD'}</span>
                    </div>
                    {competicaoConcluida && (
                      <div className="mt-2 text-xs text-gray-500 italic text-center">
                        Competição concluída - resultados não podem ser alterados
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Resultado */}
      {mostrarModalResultado && jogoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Inserir Resultado</h3>
            {competicao?.status === 'CONCLUIDA' && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Esta competição está concluída. Os resultados não podem ser alterados.
                </p>
              </div>
            )}
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
                  disabled={competicao?.status === 'CONCLUIDA'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  disabled={competicao?.status === 'CONCLUIDA'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                disabled={saving || competicao?.status === 'CONCLUIDA'}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

