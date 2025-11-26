// components/ModalPlacar.tsx - Modal para atualizar placar da partida
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Partida } from '@/types/domain';

interface ModalPlacarProps {
  isOpen: boolean;
  partida: Partida | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalPlacar({
  isOpen,
  partida,
  onClose,
  onSuccess,
}: ModalPlacarProps) {
  const [gamesTime1, setGamesTime1] = useState<string>('');
  const [gamesTime2, setGamesTime2] = useState<string>('');
  const [tiebreakTime1, setTiebreakTime1] = useState<string>('');
  const [tiebreakTime2, setTiebreakTime2] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (partida) {
      setGamesTime1(partida.gamesTime1?.toString() || '');
      setGamesTime2(partida.gamesTime2?.toString() || '');
      setTiebreakTime1(partida.tiebreakTime1?.toString() || '');
      setTiebreakTime2(partida.tiebreakTime2?.toString() || '');
      setErro(null);
    }
  }, [partida]);

  if (!isOpen || !partida) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const placar = {
        gamesTime1: gamesTime1 === '' ? null : parseInt(gamesTime1, 10),
        gamesTime2: gamesTime2 === '' ? null : parseInt(gamesTime2, 10),
        tiebreakTime1: tiebreakTime1 === '' ? null : parseInt(tiebreakTime1, 10),
        tiebreakTime2: tiebreakTime2 === '' ? null : parseInt(tiebreakTime2, 10),
      };

      // Validação básica
      if (placar.gamesTime1 !== null && (isNaN(placar.gamesTime1) || placar.gamesTime1 < 0)) {
        setErro('Games do Time 1 deve ser um número não negativo');
        setSalvando(false);
        return;
      }

      if (placar.gamesTime2 !== null && (isNaN(placar.gamesTime2) || placar.gamesTime2 < 0)) {
        setErro('Games do Time 2 deve ser um número não negativo');
        setSalvando(false);
        return;
      }

      if (placar.tiebreakTime1 !== null && (isNaN(placar.tiebreakTime1) || placar.tiebreakTime1 < 0)) {
        setErro('Tiebreak do Time 1 deve ser um número não negativo');
        setSalvando(false);
        return;
      }

      if (placar.tiebreakTime2 !== null && (isNaN(placar.tiebreakTime2) || placar.tiebreakTime2 < 0)) {
        setErro('Tiebreak do Time 2 deve ser um número não negativo');
        setSalvando(false);
        return;
      }

      await api.put(`/partida/${partida.id}`, placar);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao atualizar placar:', error);
      setErro(
        error.response?.data?.mensagem || 
        error.message || 
        'Erro ao atualizar placar. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const formatarNomeAtletas = () => {
    const time1 = [partida.atleta1?.nome, partida.atleta2?.nome].filter(Boolean).join(' / ') || 'Time 1';
    const time2 = [partida.atleta3?.nome, partida.atleta4?.nome].filter(Boolean).join(' / ') || 'Time 2';
    return { time1, time2 };
  };

  const { time1, time2 } = formatarNomeAtletas();

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Atualizar Placar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          <p className="font-medium mb-1">{time1}</p>
          <p className="text-xs text-gray-500">vs</p>
          <p className="font-medium mt-1">{time2}</p>
          <p className="text-xs text-gray-500 mt-2">
            Data: {new Date(partida.data).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Games {time1}
              </label>
              <input
                type="number"
                min="0"
                value={gamesTime1}
                onChange={(e) => setGamesTime1(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Ex: 6"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Games {time2}
              </label>
              <input
                type="number"
                min="0"
                value={gamesTime2}
                onChange={(e) => setGamesTime2(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Ex: 4"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiebreak {time1} (opcional)
              </label>
              <input
                type="number"
                min="0"
                value={tiebreakTime1}
                onChange={(e) => setTiebreakTime1(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Ex: 7"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiebreak {time2} (opcional)
              </label>
              <input
                type="number"
                min="0"
                value={tiebreakTime2}
                onChange={(e) => setTiebreakTime2(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Ex: 5"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Salvar Placar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

