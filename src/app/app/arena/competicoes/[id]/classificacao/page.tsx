// app/app/arena/competicoes/[id]/classificacao/page.tsx - Página de classificação da competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import type { Competicao } from '@/types/competicao';
import { BarChart3, ArrowLeft, Trophy, CheckCircle, Users, AlertCircle, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';

export default function ClassificacaoCompeticaoPage() {
  const router = useRouter();
  const params = useParams();
  const competicaoId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [jogos, setJogos] = useState<any[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);
  const [mostrarHeadToHead, setMostrarHeadToHead] = useState(false);
  const [atleta1Selecionado, setAtleta1Selecionado] = useState<string>('');
  const [atleta2Selecionado, setAtleta2Selecionado] = useState<string>('');
  const [classificacaoAjustada, setClassificacaoAjustada] = useState<any[] | null>(null);

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

  // Calcular classificação (vitórias e saldo de games)
  const calcularClassificacao = () => {
    if (!jogos || jogos.length === 0) {
      console.log('[CLASSIFICACAO] Nenhum jogo encontrado');
      return [];
    }

    console.log('[CLASSIFICACAO] Total de jogos:', jogos.length);
    console.log('[CLASSIFICACAO] Total de atletas participantes:', atletasParticipantes.length);

    // Mapear atletas e suas estatísticas
    const estatisticas = new Map<string, {
      atletaId: string;
      nome: string;
      vitorias: number;
      empates: number;
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
          empates: 0,
          derrotas: 0,
          gamesFeitos: 0,
          gamesSofridos: 0,
          saldoGames: 0,
        });
      }
    });

    console.log('[CLASSIFICACAO] Estatísticas inicializadas para', estatisticas.size, 'atletas');

    // Processar cada jogo concluído
    jogos.forEach((jogo: any) => {
      if (jogo.status === 'CONCLUIDO' && 
          jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined &&
          jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined) {
        const games1 = jogo.gamesAtleta1;
        const games2 = jogo.gamesAtleta2;

        // Para duplas, precisamos dos atletas de cada parceria
        if (jogo.participante1?.dupla && jogo.participante2?.dupla) {
          const dupla1 = jogo.participante1.dupla;
          const dupla2 = jogo.participante2.dupla;

          // Verificar se a estrutura da dupla está correta
          if (dupla1.atleta1?.id && dupla1.atleta2?.id && dupla2.atleta1?.id && dupla2.atleta2?.id) {
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
                } else {
                  stats.empates++;
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
                } else {
                  stats.empates++;
                }
              }
            });
          } else {
            console.warn('[CLASSIFICACAO] Estrutura de dupla inválida no jogo:', {
              jogoId: jogo.id,
              participante1: jogo.participante1,
              participante2: jogo.participante2,
            });
          }
        } else {
          console.warn('[CLASSIFICACAO] Jogo sem duplas válidas:', {
            jogoId: jogo.id,
            status: jogo.status,
            gamesAtleta1: jogo.gamesAtleta1,
            gamesAtleta2: jogo.gamesAtleta2,
            participante1: jogo.participante1,
            participante2: jogo.participante2,
          });
        }
      }
    });

    // Calcular saldo de games e ordenar
    const criterio = competicao?.configSuper8?.criterioClassificacao || 'VITORIAS';
    const classificacao = Array.from(estatisticas.values()).map(stats => ({
      ...stats,
      saldoGames: stats.gamesFeitos - stats.gamesSofridos,
    })).sort((a, b) => {
      if (criterio === 'SALDO_GAMES') {
        // Ordenar por: saldo de games (desc), vitórias (desc)
        if (b.saldoGames !== a.saldoGames) {
          return b.saldoGames - a.saldoGames;
        }
        return b.vitorias - a.vitorias;
      } else {
        // Ordenar por: vitórias (desc), saldo de games (desc)
        if (b.vitorias !== a.vitorias) {
          return b.vitorias - a.vitorias;
        }
        return b.saldoGames - a.saldoGames;
      }
    });

    return classificacao;
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
        const atleta1NaDupla1 = dupla1Ids.includes(atleta1Id);
        
        if (atleta1NaDupla1) {
          gamesAtleta1 += jogo.gamesAtleta1 || 0;
          gamesAtleta2 += jogo.gamesAtleta2 || 0;
          if (jogo.gamesAtleta1 > jogo.gamesAtleta2) {
            vitoriasAtleta1++;
          } else if (jogo.gamesAtleta2 > jogo.gamesAtleta1) {
            vitoriasAtleta2++;
          }
        } else {
          gamesAtleta1 += jogo.gamesAtleta2 || 0;
          gamesAtleta2 += jogo.gamesAtleta1 || 0;
          if (jogo.gamesAtleta2 > jogo.gamesAtleta1) {
            vitoriasAtleta1++;
          } else if (jogo.gamesAtleta1 > jogo.gamesAtleta2) {
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

  const handleFinalizarCompeticao = async () => {
    if (!competicao) return;

    const classificacaoFinal = classificacaoAjustada || calcularClassificacao();
    const campeao = classificacaoFinal[0];

    if (!confirm(`Finalizar competição "${competicao.nome}"?\n\n🏆 Campeão: ${campeao.nome}\n📊 ${campeao.vitorias} vitória(s)\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setSaving(true);
      await competicaoService.finalizarCompeticao(competicaoId, classificacaoFinal);
      alert('Competição finalizada com sucesso!');
      await carregarDados();
      router.push('/app/arena/competicoes');
    } catch (error: any) {
      console.error('Erro ao finalizar competição:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao finalizar competição');
    } finally {
      setSaving(false);
    }
  };

  const handleReabrirCompeticao = async () => {
    if (!competicao) return;

    if (!confirm(`Reabrir competição "${competicao.nome}"?\n\nIsso permitirá alterar resultados dos jogos novamente.`)) {
      return;
    }

    try {
      setSaving(true);
      await competicaoService.reabrirCompeticao(competicaoId);
      alert('Competição reaberta com sucesso!');
      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao reabrir competição:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao reabrir competição');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando classificação...</p>
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

  // Carregar classificação final se a competição estiver concluída
  const carregarClassificacaoFinal = () => {
    if (competicao?.status !== 'CONCLUIDA') {
      return null;
    }

    // Criar um mapa com as posições finais salvas
    const classificacaoPorPosicao = new Map<number, any>();
    
    atletasParticipantes.forEach((participante: any) => {
      if (participante.posicaoFinal && participante.atletaId) {
        // Calcular estatísticas do atleta para exibição
        const stats = calcularEstatisticasAtleta(participante.atletaId);
        classificacaoPorPosicao.set(participante.posicaoFinal, {
          atletaId: participante.atletaId,
          nome: participante.atleta?.nome || 'Atleta',
          vitorias: stats.vitorias,
          empates: stats.empates,
          derrotas: stats.derrotas,
          gamesFeitos: stats.gamesFeitos,
          gamesSofridos: stats.gamesSofridos,
          saldoGames: stats.saldoGames,
        });
      }
    });

    // Converter para array ordenado por posição
    const classificacao = Array.from(classificacaoPorPosicao.entries())
      .sort(([posA], [posB]) => posA - posB)
      .map(([, atleta]) => atleta);

    return classificacao.length > 0 ? classificacao : null;
  };

  // Calcular estatísticas de um atleta específico
  const calcularEstatisticasAtleta = (atletaId: string) => {
    let vitorias = 0;
    let empates = 0;
    let derrotas = 0;
    let gamesFeitos = 0;
    let gamesSofridos = 0;

    jogos.forEach((jogo: any) => {
      if (jogo.status === 'CONCLUIDO' && 
          jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined &&
          jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined) {
        const games1 = jogo.gamesAtleta1;
        const games2 = jogo.gamesAtleta2;

        if (jogo.participante1?.dupla && jogo.participante2?.dupla) {
          const dupla1 = jogo.participante1.dupla;
          const dupla2 = jogo.participante2.dupla;

          if (dupla1.atleta1?.id && dupla1.atleta2?.id && dupla2.atleta1?.id && dupla2.atleta2?.id) {
            const dupla1Ids = [dupla1.atleta1.id, dupla1.atleta2.id];
            const dupla2Ids = [dupla2.atleta1.id, dupla2.atleta2.id];

            if (dupla1Ids.includes(atletaId)) {
              gamesFeitos += games1;
              gamesSofridos += games2;
              if (games1 > games2) vitorias++;
              else if (games2 > games1) derrotas++;
              else empates++;
            } else if (dupla2Ids.includes(atletaId)) {
              gamesFeitos += games2;
              gamesSofridos += games1;
              if (games2 > games1) vitorias++;
              else if (games1 > games2) derrotas++;
              else empates++;
            }
          }
        }
      }
    });

    return {
      vitorias,
      empates,
      derrotas,
      gamesFeitos,
      gamesSofridos,
      saldoGames: gamesFeitos - gamesSofridos,
    };
  };

  const classificacaoCalculada = calcularClassificacao();
  const classificacaoFinalSalva = carregarClassificacaoFinal();
  
  // Verificar se há empate total nos primeiros colocados
  const verificarEmpateTotal = (classif: any[]) => {
    if (classif.length < 2) return null;
    
    const primeiro = classif[0];
    const segundo = classif[1];
    
    // Verificar se empataram em tudo
    if (
      primeiro.vitorias === segundo.vitorias &&
      primeiro.saldoGames === segundo.saldoGames &&
      primeiro.derrotas === segundo.derrotas &&
      primeiro.gamesFeitos === segundo.gamesFeitos &&
      primeiro.gamesSofridos === segundo.gamesSofridos
    ) {
      // Verificar se há mais atletas empatados
      const empatados = classif.filter((atleta) => 
        atleta.vitorias === primeiro.vitorias &&
        atleta.saldoGames === primeiro.saldoGames &&
        atleta.derrotas === primeiro.derrotas &&
        atleta.gamesFeitos === primeiro.gamesFeitos &&
        atleta.gamesSofridos === primeiro.gamesSofridos
      );
      
      return empatados;
    }
    
    return null;
  };

  const atletasEmpatados = verificarEmpateTotal(classificacaoCalculada);
  // Se a competição estiver concluída, usar a classificação final salva; caso contrário, usar a calculada ou ajustada
  const classificacao = competicao?.status === 'CONCLUIDA' 
    ? (classificacaoFinalSalva || classificacaoCalculada)
    : (classificacaoAjustada || classificacaoCalculada);
  const campeao = classificacao[0];

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
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-yellow-500" />
          Classificação - {competicao.nome}
        </h1>
      </div>

      {competicao.status === 'EM_ANDAMENTO' && atletasEmpatados && atletasEmpatados.length > 1 && !classificacaoAjustada && (
        <div className="mb-6 bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">
                ⚠️ Empate Total Detectado
              </h3>
              <p className="text-sm text-orange-800 mb-3">
                {atletasEmpatados.length} atleta(s) empataram em todos os critérios (vitórias, saldo de games, etc.). 
                Defina manualmente a ordem para resolver o empate.
              </p>
              <button
                onClick={() => {
                  // Inicializar com a classificação atual
                  setClassificacaoAjustada([...classificacaoCalculada]);
                }}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                Definir Ordem do Empate
              </button>
            </div>
          </div>
        </div>
      )}

      {classificacaoAjustada && atletasEmpatados && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">
                Ajustando Ordem do Empate
              </h3>
              <p className="text-sm text-blue-700">
                Reordene os atletas empatados. Use as setas para mover para cima ou para baixo.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setClassificacaoAjustada(null);
                }}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Confirmar a ordem ajustada - já está confirmada quando o usuário ajusta
                  alert('Ordem do empate definida com sucesso! Agora você pode finalizar a competição.');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Confirmar Ordem
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            {atletasEmpatados.map((atletaEmpatado) => {
              const indexNaClassificacao = classificacaoAjustada.findIndex((a: any) => a.atletaId === atletaEmpatado.atletaId);
              const atletaAjustado = classificacaoAjustada[indexNaClassificacao];
              
              return (
                <div
                  key={atletaEmpatado.atletaId}
                  className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-600 w-8">
                      {indexNaClassificacao + 1}º
                    </span>
                    <span className="font-medium text-gray-900">{atletaAjustado.nome}</span>
                    <span className="text-sm text-gray-500">
                      {atletaAjustado.vitorias}V • {atletaAjustado.saldoGames > 0 ? '+' : ''}{atletaAjustado.saldoGames} games
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const indicesEmpatados = atletasEmpatados.map((a: any) => 
                          classificacaoAjustada.findIndex((c: any) => c.atletaId === a.atletaId)
                        ).sort((a, b) => a - b);
                        const indiceAnterior = indicesEmpatados.findLast((idx: number) => idx < indexNaClassificacao);
                        
                        if (indiceAnterior !== undefined) {
                          const novaClassificacao = [...classificacaoAjustada];
                          // Mover para cima (trocar com o anterior empatado)
                          [novaClassificacao[indiceAnterior], novaClassificacao[indexNaClassificacao]] = 
                            [novaClassificacao[indexNaClassificacao], novaClassificacao[indiceAnterior]];
                          setClassificacaoAjustada(novaClassificacao);
                        }
                      }}
                      disabled={!atletasEmpatados.some((a: any) => {
                        const idx = classificacaoAjustada.findIndex((c: any) => c.atletaId === a.atletaId);
                        return idx < indexNaClassificacao;
                      })}
                      className="p-2 border border-blue-300 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const indicesEmpatados = atletasEmpatados.map((a: any) => 
                          classificacaoAjustada.findIndex((c: any) => c.atletaId === a.atletaId)
                        ).sort((a, b) => a - b);
                        const ultimoEmpatadoIndex = Math.max(...indicesEmpatados);
                        const proximoIndice = indicesEmpatados.find((idx: number) => idx > indexNaClassificacao);
                        
                        if (proximoIndice !== undefined) {
                          const novaClassificacao = [...classificacaoAjustada];
                          // Mover para baixo (trocar com o próximo empatado)
                          [novaClassificacao[indexNaClassificacao], novaClassificacao[proximoIndice]] = 
                            [novaClassificacao[proximoIndice], novaClassificacao[indexNaClassificacao]];
                          setClassificacaoAjustada(novaClassificacao);
                        }
                      }}
                      disabled={!atletasEmpatados.some((a: any) => {
                        const idx = classificacaoAjustada.findIndex((c: any) => c.atletaId === a.atletaId);
                        return idx > indexNaClassificacao;
                      })}
                      className="p-2 border border-blue-300 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-between items-start gap-4">
        {competicao.status === 'CONCLUIDA' && campeao && (
          <div className="flex-1 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-600" />
              <div>
                <h3 className="text-lg font-bold text-yellow-900">🏆 Campeão</h3>
                <p className="text-yellow-800 font-semibold">{campeao.nome}</p>
                <p className="text-sm text-yellow-700">
                  {competicao.configSuper8?.criterioClassificacao === 'SALDO_GAMES'
                    ? `Saldo: +${campeao.saldoGames} games • ${campeao.vitorias} vitória(s)`
                    : `${campeao.vitorias} vitória(s) • Saldo: +${campeao.saldoGames} games`}
                </p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setMostrarHeadToHead(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Users className="w-5 h-5" />
          Head to Head
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atleta</th>
              {competicao?.configSuper8?.criterioClassificacao === 'SALDO_GAMES' ? (
                <>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saldo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vitórias</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vitórias</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saldo</th>
                </>
              )}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Empates</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Derrotas</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games Feitos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games Sofridos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {classificacao.map((atleta, index) => (
              <tr key={atleta.atletaId} className={index === 0 && competicao.status !== 'CONCLUIDA' ? 'bg-yellow-50' : index === 0 ? 'bg-yellow-100' : ''}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {index + 1}º
                  {index === 0 && <span className="ml-2">🏆</span>}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{atleta.nome}</td>
                {competicao?.configSuper8?.criterioClassificacao === 'SALDO_GAMES' ? (
                  <>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${
                      atleta.saldoGames > 0 ? 'text-green-600' : 
                      atleta.saldoGames < 0 ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {atleta.saldoGames > 0 ? '+' : ''}{atleta.saldoGames}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{atleta.vitorias}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{atleta.vitorias}</td>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${
                      atleta.saldoGames > 0 ? 'text-green-600' : 
                      atleta.saldoGames < 0 ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {atleta.saldoGames > 0 ? '+' : ''}{atleta.saldoGames}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.empates || 0}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.derrotas}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.gamesFeitos}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{atleta.gamesSofridos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {competicao.status === 'EM_ANDAMENTO' && classificacao.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleFinalizarCompeticao}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            {saving ? 'Finalizando...' : 'Finalizar Competição'}
          </button>
        </div>
      )}

      {competicao.status === 'CONCLUIDA' && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleReabrirCompeticao}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
          >
            <RotateCcw className="w-5 h-5" />
            {saving ? 'Reabrindo...' : 'Reabrir Competição'}
          </button>
        </div>
      )}

      {/* Modal Head to Head */}
      {mostrarHeadToHead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Head to Head</h2>
              <button
                onClick={() => {
                  setMostrarHeadToHead(false);
                  setAtleta1Selecionado('');
                  setAtleta2Selecionado('');
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Atleta 1
                </label>
                <select
                  value={atleta1Selecionado}
                  onChange={(e) => setAtleta1Selecionado(e.target.value)}
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
                                      {atleta1NaDupla1 ? `${games1} x ${games2}` : `${games2} x ${games1}`}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Não jogado</span>
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
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhum jogo encontrado entre estes atletas.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

