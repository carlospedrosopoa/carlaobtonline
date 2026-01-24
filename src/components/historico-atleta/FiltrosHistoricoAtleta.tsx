'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import type { AtletaHistoricoArena } from '@/services/gestaoArenaService';

export default function FiltrosHistoricoAtleta({
  pointId,
  atletaSelecionado,
  onSelecionarAtleta,
  buscarAtletas,
  dataDe,
  setDataDe,
  dataAte,
  setDataAte,
  onLimpar,
  onAplicar,
}: {
  pointId: string;
  atletaSelecionado: AtletaHistoricoArena | null;
  onSelecionarAtleta: (atleta: AtletaHistoricoArena) => void;
  buscarAtletas: (q: string) => Promise<AtletaHistoricoArena[]>;
  dataDe: string;
  setDataDe: (v: string) => void;
  dataAte: string;
  setDataAte: (v: string) => void;
  onLimpar: () => void;
  onAplicar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<AtletaHistoricoArena[]>([]);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const buscaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (atletaSelecionado?.nome) {
      setBusca(atletaSelecionado.nome);
      setDropdownAberto(false);
    }
  }, [atletaSelecionado?.id]);

  useEffect(() => {
    if (!dropdownAberto) return;
    if (!pointId) return;

    const termo = busca.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        setCarregandoSugestoes(true);
        const lista = await buscarAtletas(termo);
        setSugestoes(lista);
      } finally {
        setCarregandoSugestoes(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [busca, dropdownAberto, pointId, buscarAtletas]);

  const limparBusca = () => {
    setBusca('');
    setSugestoes([]);
    setDropdownAberto(false);
    buscaInputRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Buscar atleta</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={buscaInputRef}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setDropdownAberto(true);
              }}
              onFocus={() => setDropdownAberto(true)}
              placeholder="Nome, email ou telefone"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {busca && (
              <button
                type="button"
                onClick={limparBusca}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {dropdownAberto && (
              <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {carregandoSugestoes ? (
                    <div className="p-3 text-sm text-gray-600">Carregando...</div>
                  ) : sugestoes.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">
                      {busca.trim().length < 2 ? 'Digite ao menos 2 caracteres' : 'Nenhum atleta encontrado'}
                    </div>
                  ) : (
                    sugestoes.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onSelecionarAtleta(a);
                          setBusca(a.nome);
                          setDropdownAberto(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="text-sm font-medium text-gray-900">{a.nome}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{a.email || a.telefone || '—'}</div>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-gray-100 p-2 flex justify-end">
                  <button type="button" onClick={() => setDropdownAberto(false)} className="text-xs text-gray-600 hover:text-gray-900">
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">De</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Até</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="lg:col-span-12 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-600">
            {atletaSelecionado ? (
              <span>
                Selecionado: <span className="font-semibold text-gray-900">{atletaSelecionado.nome}</span>
              </span>
            ) : (
              <span>Selecione um atleta para visualizar o histórico</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                limparBusca();
                onLimpar();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={onAplicar}
              disabled={!atletaSelecionado}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

