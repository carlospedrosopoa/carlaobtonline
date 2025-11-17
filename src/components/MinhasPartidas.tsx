// components/MinhasPartidas.tsx - Lista completa de partidas (100% igual ao cursor)
'use client';

import { useState, useEffect } from 'react';
import type { Partida } from '@/types/domain';
import { api } from '@/lib/api';

interface Props {
  atletaId: string;
  partidas: Partida[];
  onAbrirTodas: () => void;
  onNovaPartida: () => void;
  onAtualizarPlacar: (partida: Partida) => void;
}

export default function MinhasPartidas({
  atletaId,
  partidas,
  onAbrirTodas,
  onNovaPartida,
  onAtualizarPlacar,
}: Props) {
  const [showCardId, setShowCardId] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [agendarAberta, setAgendarAberta] = useState(false);
  const [partidaParaAgendar, setPartidaParaAgendar] = useState<Partida | null>(null);

  // Limpa o blob URL quando o componente desmonta ou o card fecha
  useEffect(() => {
    return () => {
      if (cardImageUrl) {
        URL.revokeObjectURL(cardImageUrl);
      }
    };
  }, [cardImageUrl]);

  const formatarPlacar = (p: Partida) => {
    if (p.gamesTime1 == null || p.gamesTime2 == null) return 'Ainda não informado';
    let base = `${p.gamesTime1} x ${p.gamesTime2}`;
    if (
      (p.gamesTime1 === 6 && p.gamesTime2 === 6) ||
      (p.gamesTime1 === 7 && p.gamesTime2 === 6) ||
      (p.gamesTime1 === 6 && p.gamesTime2 === 7)
    ) {
      if (p.tiebreakTime1 != null && p.tiebreakTime2 != null) {
        base += ` (${p.tiebreakTime1} x ${p.tiebreakTime2})`;
      }
    }
    return base;
  };

  const resultadoEmoji = (p: Partida): string => {
    const time1 = [p.atleta1?.id, p.atleta2?.id];
    const time2 = [p.atleta3?.id, p.atleta4?.id];
    const atletaNoTime1 = time1.includes(atletaId);
    const atletaNoTime2 = time2.includes(atletaId);

    if (p.gamesTime1 == null || p.gamesTime2 == null) return '⚪';

    if ((p.gamesTime1 === 7 && p.gamesTime2 === 6) || (p.gamesTime1 === 6 && p.gamesTime2 === 7)) {
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

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Minhas Partidas</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setModalNovaAberto(true)}
            className="text-sm text-green-600 hover:underline"
          >
            + Nova Partida
          </button>
          <button onClick={onAbrirTodas} className="text-sm text-blue-600 hover:underline">
            Fechar
          </button>
        </div>
      </div>

      {partidas.length === 0 ? (
        <p className="text-sm text-gray-500">Você ainda não participou de nenhuma partida.</p>
      ) : (
        <ul className="space-y-3">
          {partidas.map((p) => (
            <li key={p.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between items-center mb-1">
                <span>{resultadoEmoji(p)}</span>
                <span className="text-gray-600">
                  {new Date(p.data).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {p.local}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {p.atleta1?.nome || '—'} / {p.atleta2?.nome || '—'} × {p.atleta3?.nome || '—'} /{' '}
                  {p.atleta4?.nome || '—'}
                </p>
                <p>Placar: {formatarPlacar(p)}</p>
              </div>
              <div className="mt-2 flex justify-end gap-3 flex-wrap">
                <button
                  onClick={() => onAtualizarPlacar(p)}
                  className="text-blue-600 hover:underline text-xs"
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
                      const response = await api.get(`/card/partida/${p.id}`, {
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
                  className="text-green-600 hover:underline text-xs"
                >
                  Ver Card
                </button>
                <button
                  onClick={() => {
                    setPartidaParaAgendar(p);
                    setAgendarAberta(true);
                  }}
                  className="text-purple-600 hover:underline text-xs"
                >
                  Agendar novo Jogo
                </button>
              </div>
            </li>
          ))}
        </ul>
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
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
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
                          <svg
                            className="w-8 h-8 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
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
                      <svg
                        className="w-10 h-10 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-800 font-semibold text-lg mb-2">Erro ao carregar o card</p>
                    <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                      O backend pode estar tendo problemas para carregar as imagens dos atletas. Verifique
                      se todas as fotos estão configuradas corretamente.
                    </p>
                    <button
                      onClick={async () => {
                        if (!showCardId) return;
                        setCardError(false);
                        setCardLoading(true);
                        setCardImageUrl(null);

                        try {
                          const response = await api.get(`/card/partida/${showCardId}`, {
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
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg hover:shadow-xl"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Abrir em Nova Aba
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais serão implementados quando necessário */}
    </div>
  );
}


