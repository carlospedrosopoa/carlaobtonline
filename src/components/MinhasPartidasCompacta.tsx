// components/MinhasPartidasCompacta.tsx - Componente de partidas compactas (100% igual ao original)
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
  const [novaAberta, setNovaAberta] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((partidas?.length || 0) / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [partidas.length, totalPages, page]);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const partidasPagina = useMemo(() => partidas.slice(start, end), [partidas, start, end]);

  const formatarPlacar = (p: Partida) => {
    if (p.gamesTime1 == null || p.gamesTime2 == null) return "Ainda não informado";
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

    if (p.gamesTime1 == null || p.gamesTime2 == null) return "⚪";

    if (
      (p.gamesTime1 === 7 && p.gamesTime2 === 6) ||
      (p.gamesTime1 === 6 && p.gamesTime2 === 7)
    ) {
      if (p.tiebreakTime1 != null && p.tiebreakTime2 != null) {
        if (p.tiebreakTime1 > p.tiebreakTime2 && atletaNoTime1) return "🟢";
        if (p.tiebreakTime2 > p.tiebreakTime1 && atletaNoTime2) return "🟢";
        if (p.tiebreakTime1 < p.tiebreakTime2 && atletaNoTime1) return "🔴";
        if (p.tiebreakTime2 < p.tiebreakTime1 && atletaNoTime2) return "🔴";
      }
      return "⚪";
    }

    if (p.gamesTime1 > p.gamesTime2 && atletaNoTime1) return "🟢";
    if (p.gamesTime2 > p.gamesTime1 && atletaNoTime2) return "🟢";
    if (p.gamesTime1 < p.gamesTime2 && atletaNoTime1) return "🔴";
    if (p.gamesTime2 < p.gamesTime1 && atletaNoTime2) return "🔴";
    return "⚪";
  };

  const podeAnterior = page > 1;
  const podeProxima = page < totalPages;

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Minhas Últimas Partidas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setNovaAberta(true)}
            className="text-sm text-green-600 hover:underline"
          >
            + Nova Partida
          </button>
          <button
            onClick={onAbrirTodas}
            className="text-sm text-blue-600 hover:underline"
          >
            Ver todas
          </button>
        </div>
      </div>

      {partidas.length === 0 ? (
        <p className="text-sm text-gray-500">Você ainda não participou de nenhuma partida.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {partidasPagina.map((p) => (
              <li key={p.id} className="border rounded p-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span>{resultadoEmoji(p)}</span>
                  <span className="text-gray-600">
                    {new Date(p.data).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}{p.local}
                  </span>
                </div>
                <div>
                  <p className="font-medium">
                    {p.atleta1?.nome || "—"} / {p.atleta2?.nome || "—"} × {p.atleta3?.nome || "—"} / {p.atleta4?.nome || "—"}
                  </p>
                  <p>Placar: {formatarPlacar(p)}</p>
                </div>
                <div className="mt-2 flex justify-end space-x-3">
                  <button
                    onClick={() => onAtualizarPlacar(p)}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Atualizar placar
                  </button>
                  <button
                    onClick={() => setShowCardId(p.id)}
                    className="text-green-600 hover:underline text-xs"
                  >
                    Ver Card
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Paginação */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Página <span className="font-medium">{page}</span> de{" "}
              <span className="font-medium">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!podeAnterior}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!podeProxima}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}

      {showCardId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 relative max-w-[90vw] max-h-[90vh] overflow-auto">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => setShowCardId(null)}
            >
              ✕
            </button>
            <img
              src={`${BASE_URL}/card/partida/${showCardId}`}
              alt="Card da Partida"
              className="max-w-full max-h-[70vh] rounded mb-4"
            />
            <div className="text-center">
              <a
                href={`${BASE_URL}/card/partida/${showCardId}`}
                download={`card_partida_${showCardId}.png`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded"
              >
                📥 Baixar Card
              </a>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

