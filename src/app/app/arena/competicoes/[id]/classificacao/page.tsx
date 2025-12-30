// app/app/arena/competicoes/[id]/classificacao/page.tsx - Página de classificação da competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import type { Competicao } from '@/types/competicao';
import { BarChart3, ArrowLeft, Trophy, CheckCircle } from 'lucide-react';

export default function ClassificacaoCompeticaoPage() {
  const router = useRouter();
  const params = useParams();
  const competicaoId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [jogos, setJogos] = useState<any[]>([]);
  const [atletasParticipantes, setAtletasParticipantes] = useState<any[]>([]);

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
      if (jogo.status === 'CONCLUIDO' && 
          jogo.gamesAtleta1 !== null && jogo.gamesAtleta1 !== undefined &&
          jogo.gamesAtleta2 !== null && jogo.gamesAtleta2 !== undefined) {
        const games1 = jogo.gamesAtleta1;
        const games2 = jogo.gamesAtleta2;

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

  const handleFinalizarCompeticao = async () => {
    if (!competicao) return;

    const classificacao = calcularClassificacao();
    const campeao = classificacao[0];

    if (!confirm(`Finalizar competição "${competicao.nome}"?\n\n🏆 Campeão: ${campeao.nome}\n📊 ${campeao.vitorias} vitória(s)\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setSaving(true);
      await competicaoService.finalizarCompeticao(competicaoId, classificacao);
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

  const classificacao = calcularClassificacao();
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

      {competicao.status === 'CONCLUIDA' && campeao && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
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
    </div>
  );
}

