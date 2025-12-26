// app/app/arena/competicoes/[id]/jogos/page.tsx - Página de jogos da competição
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import type { Competicao } from '@/types/competicao';
import { PlayCircle, ArrowLeft, Trophy } from 'lucide-react';

export default function JogosCompeticaoPage() {
  const router = useRouter();
  const params = useParams();
  const competicaoId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [jogos, setJogos] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [jogoEditando, setJogoEditando] = useState<any | null>(null);
  const [mostrarModalResultado, setMostrarModalResultado] = useState(false);
  const [gamesAtleta1, setGamesAtleta1] = useState<string>('');
  const [gamesAtleta2, setGamesAtleta2] = useState<string>('');

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

  const salvarResultado = async () => {
    if (!competicaoId || !jogoEditando) return;

    try {
      setSaving(true);
      await competicaoService.atualizarResultadoJogo(competicaoId, jogoEditando.id, {
        gamesAtleta1: gamesAtleta1 ? parseInt(gamesAtleta1) : null,
        gamesAtleta2: gamesAtleta2 ? parseInt(gamesAtleta2) : null,
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
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <PlayCircle className="w-8 h-8 text-blue-500" />
          Jogos - {competicao.nome}
        </h1>
      </div>

      <div className="space-y-6">
        {rodadasOrdenadas.map((rodada) => {
          const jogosRodada = rodadasMap.get(rodada)!;
          if (jogosRodada.length === 0) return null;

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
        })}
      </div>

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
    </div>
  );
}

