// components/MinhasPartidasCompacta.tsx - Componente de partidas compactas (100% igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Partida } from '@/types/domain';
import { api } from '@/lib/api';

interface Props {
  partidas: Partida[];
  onAbrirTodas: () => void;
  onAtualizarPlacar: (partida: Partida) => void;
  atletaId: string;
  onNovaPartida: () => void;
  pageSize?: number;
}

export default function MinhasPartidasCompacta({
  partidas,
  onAbrirTodas,
  onAtualizarPlacar,
  atletaId,
  onNovaPartida,
  pageSize = 5,
}: Props) {
  const [showCardId, setShowCardId] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [agendarAberta, setAgendarAberta] = useState(false);
  const [partidaParaAgendar, setPartidaParaAgendar] = useState<Partida | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((partidas?.length || 0) / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [partidas.length, totalPages, page]);

  // Limpa o blob URL quando o componente desmonta ou o card fecha
  useEffect(() => {
    return () => {
      if (cardImageUrl) {
        URL.revokeObjectURL(cardImageUrl);
      }
    };
  }, [cardImageUrl]);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const partidasPagina = useMemo(() => partidas.slice(start, end), [partidas, start, end]);

  const formatarPlacar = (p: Partida) => {
    if (p.gamesTime1 == null || p.gamesTime2 == null) return 'Ainda não informado';
    let base = `${p.gamesTime1} x ${p.gamesTime2}`;
    const teveTB =
      (p.gamesTime1 === 7 && p.gamesTime2 === 6) ||
      (p.gamesTime1 === 6 && p.gamesTime2 === 7);
    if (teveTB && p.tiebreakTime1 != null && p.tiebreakTime2 != null) {
      base += ` (${p.tiebreakTime1} x ${p.tiebreakTime2})`;
    }
    return base;
  };

  const resultadoEmoji = (p: Partida): string => {
    const time1 = [p.atleta1?.id, p.atleta2?.id];
    const time2 = [p.atleta3?.id, p.atleta4?.id];
    const atletaNoTime1 = time1.includes(atletaId);
    const atletaNoTime2 = time2.includes(atletaId);

    if (p.gamesTime1 == null || p.gamesTime2 == null) return '⚪';

    if (
      (p.gamesTime1 === 7 && p.gamesTime2 === 6) ||
      (p.gamesTime1 === 6 && p.gamesTime2 === 7)
    ) {
      if (p.tiebreakTime1 != null && p.tiebreakTime2 != null) {
        if (p.tiebreakTime1 > p.tiebreakTime2 && atletaNoTime1) return '🟢';
        if (p.tiebreakTime2 > p.tiebreakTime1 && atletaNoTime2) return '🟢';
        if (p.tiebreakTime1 < p.tiebreakTime2 && atletaNoTime1) return '🔴';
        if (p.tiebreakTime2 < p.tiebreakTime1 && atletaNoTime2) return '🔴';
      }
      return '⚪';
    }

    if (p.gamesTime1 > p.gamesTime2 && atletaNoTime1) return '🟢';
    if (p.gamesTime2 > p.gamesTime1 && atletaNoTime2) return '🟢';
    if (p.gamesTime1 < p.gamesTime2 && atletaNoTime1) return '🔴';
    if (p.gamesTime2 < p.gamesTime1 && atletaNoTime2) return '🔴';
    return '⚪';
  };

  const podeAnterior = page > 1;
  const podeProxima = page < totalPages;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Minhas Últimas Partidas</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setNovaAberta(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
          >
            + Nova Partida
          </button>
          <button
            onClick={onAbrirTodas}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            Ver todas
          </button>
        </div>
      </div>

      {partidas.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600">Você ainda não participou de nenhuma partida.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {partidasPagina.map((p) => (
              <li key={p.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{resultadoEmoji(p)}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">
                        {p.atleta1?.nome || '—'} / {p.atleta2?.nome || '—'} × {p.atleta3?.nome || '—'} / {p.atleta4?.nome || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">
                    <p className="font-medium">
                      {new Date(p.data).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p>{p.local}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">
                    Placar: <span className="text-gray-900">{formatarPlacar(p)}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onAtualizarPlacar(p)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                    >
                      Atualizar placar
                    </button>
                    <button
                      onClick={async () => {
                        setShowCardId(p.id);
                        setCardLoading(true);
                        setCardError(false);
                        setCardImageUrl(null);
                        
                        // Carrega a imagem com autenticação
                        try {
                          const response = await api.get(`/card/partida/${p.id}?refresh=true`, {
                            responseType: 'blob',
                          });
                          const blob = new Blob([response.data], { type: 'image/png' });
                          const imageUrl = URL.createObjectURL(blob);
                          setCardImageUrl(imageUrl);
                          setCardLoading(false);
                        } catch (error) {
                          console.error('Erro ao carregar card:', error);
                          setCardError(true);
                          setCardLoading(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                    >
                      Ver Card
                    </button>
                    <button
                      onClick={() => {
                        setPartidaParaAgendar(p);
                        setAgendarAberta(true);
                      }}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium"
                    >
                      Agendar novo Jogo
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Página <span className="font-semibold text-gray-900">{page}</span> de{' '}
                <span className="font-semibold text-gray-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!podeAnterior}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!podeProxima}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showCardId && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCardId(null);
              setCardError(false);
              setCardLoading(false);
              // Limpa o blob URL para liberar memória
              if (cardImageUrl) {
                URL.revokeObjectURL(cardImageUrl);
                setCardImageUrl(null);
              }
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 relative max-w-[95vw] max-h-[95vh] overflow-auto animate-in zoom-in-95 duration-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all z-10"
              onClick={() => {
                setShowCardId(null);
                setCardError(false);
                setCardLoading(false);
                // Limpa o blob URL para liberar memória
                if (cardImageUrl) {
                  URL.revokeObjectURL(cardImageUrl);
                  setCardImageUrl(null);
                }
              }}
              aria-label="Fechar"
            >
              ×
            </button>
            
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Card da Partida</h3>
                  <p className="text-sm text-gray-500">Compartilhe nas redes sociais</p>
                </div>
              </div>
              
              <div className="relative min-h-[400px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-200">
                {cardLoading && !cardError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                    <div className="text-center">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-gray-700 font-medium">Gerando card...</p>
                      <p className="text-sm text-gray-500 mt-1">Aguarde um momento</p>
                    </div>
                  </div>
                )}
                {cardImageUrl && (
                  <img
                    src={cardImageUrl}
                    alt="Card da Partida"
                    className="max-w-full max-h-[65vh] rounded-xl shadow-2xl mx-auto border-4 border-white opacity-100 scale-100 transition-all duration-300"
                    onLoad={() => {
                      setCardLoading(false);
                      setCardError(false);
                    }}
                    onError={(e) => {
                      setCardLoading(false);
                      setCardError(true);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                {cardError && (
                  <div className="text-center py-12 w-full">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                      <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-800 font-semibold text-lg mb-2">Erro ao carregar o card</p>
                    <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                      O backend pode estar tendo problemas para carregar as imagens dos atletas. Verifique se todas as fotos estão configuradas corretamente.
                    </p>
                    <button
                      onClick={async () => {
                        if (!showCardId) return;
                        setCardError(false);
                        setCardLoading(true);
                        setCardImageUrl(null);
                        
                        try {
                          const response = await api.get(`/card/partida/${showCardId}?refresh=true`, {
                            responseType: 'blob',
                          });
                          
                          // response.data já é um Blob quando responseType é 'blob'
                          const blob = response.data instanceof Blob 
                            ? response.data 
                            : new Blob([response.data], { type: 'image/png' });
                          
                          const imageUrl = URL.createObjectURL(blob);
                          setCardImageUrl(imageUrl);
                          setCardLoading(false);
                        } catch (error: any) {
                          console.error('Erro ao carregar card:', error);
                          console.error('Detalhes do erro:', {
                            message: error.message,
                            status: error.status,
                            data: error.data,
                          });
                          setCardError(true);
                          setCardLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-gray-200">
              <a
                href={cardImageUrl || undefined}
                download={`card_partida_${showCardId}.png`}
                className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  !cardImageUrl ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!cardImageUrl) {
                    e.preventDefault();
                  }
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar Card
              </a>
              <button
                onClick={() => {
                  if (cardImageUrl) {
                    const link = document.createElement('a');
                    link.href = cardImageUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.click();
                  }
                }}
                disabled={!cardImageUrl}
                className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  !cardImageUrl ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir em Nova Aba
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais serão implementados quando necessário */}
      {novaAberta && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => setNovaAberta(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">Nova Partida</h3>
            <p className="text-gray-600 mb-4">Funcionalidade em desenvolvimento...</p>
            <button
              onClick={() => setNovaAberta(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {agendarAberta && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => {
                setAgendarAberta(false);
                setPartidaParaAgendar(null);
              }}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">Agendar novo Jogo</h3>
            <p className="text-gray-600 mb-4">Funcionalidade em desenvolvimento...</p>
            <button
              onClick={() => {
                setAgendarAberta(false);
                setPartidaParaAgendar(null);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
