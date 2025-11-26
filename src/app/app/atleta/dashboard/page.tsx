// app/app/atleta/dashboard/page.tsx - Dashboard do atleta (igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import MinhasPartidasCompacta from '@/components/MinhasPartidasCompacta';
import MinhasPartidas from '@/components/MinhasPartidas';
import GraficoEvolutivo from '@/components/GraficoEvolutivo';
import ModalPlacar from '@/components/ModalPlacar';
import { api } from '@/lib/api';
import type { Atleta, Partida } from '@/types/domain';

type Periodo = 'all' | '30' | '90' | '365';

export default function AtletaDashboardPage() {
  const [atleta, setAtleta] = useState<Atleta | null>(null);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [mostrarPartidas, setMostrarPartidas] = useState(false);
  const [mostrarGrafico, setMostrarGrafico] = useState(false);
  const [modalPlacar, setModalPlacar] = useState(false);
  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);

  // período do gráfico e peso do TB
  const [periodo, setPeriodo] = useState<Periodo>('all');
  const [tbWeight, setTbWeight] = useState<number>(0.1);

  useEffect(() => {
    buscarAtleta();
  }, []);

  useEffect(() => {
    if (atleta?.id) {
      carregarPartidas();
    }
  }, [atleta?.id]);

  const buscarAtleta = async () => {
    try {
      const res = await api.get('/atleta/me/atleta');
      if (res.status === 200 && res.data) {
        setAtleta(res.data as Atleta | null);
      }
    } catch (error) {
      console.error('Erro ao buscar atleta', error);
    }
  };

  const carregarPartidas = async () => {
    if (!atleta?.id) return;
    try {
      const res = await api.get('/partida/listarPartidas');
      const todas = Array.isArray(res.data) ? res.data : [];
      const doAtleta = todas
        .filter((p: Partida) =>
          [p.atleta1?.id, p.atleta2?.id, p.atleta3?.id, p.atleta4?.id].includes(atleta.id)
        )
        .sort((a: Partida, b: Partida) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setPartidas(doAtleta);
    } catch (err) {
      console.error('Erro ao carregar partidas', err);
    }
  };

  // filtra por período para o gráfico
  const partidasPeriodo = useMemo(() => {
    if (periodo === 'all') return partidas;
    const days = Number(periodo);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return partidas.filter((p) => new Date(p.data).getTime() >= cutoff);
  }, [partidas, periodo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Acompanhe seu desempenho e partidas</p>
        </div>

      {atleta && (
        <>
          <MinhasPartidasCompacta
            partidas={partidas}
            atletaId={atleta.id}
            onAbrirTodas={() => setMostrarPartidas(true)}
            onAtualizarPlacar={(p) => {
              setPartidaSelecionada(p);
              setModalPlacar(true);
            }}
            onNovaPartida={carregarPartidas}
            pageSize={5}
          />

          {/* Controles do gráfico */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <button
                onClick={() => setMostrarGrafico((v) => !v)}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                {mostrarGrafico ? 'Ocultar Desempenho' : 'Ver Desempenho'}
              </button>

              {mostrarGrafico && (
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">Período:</span>
                    <select
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value as Periodo)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="all">Todos</option>
                      <option value="30">30 dias</option>
                      <option value="90">90 dias</option>
                      <option value="365">365 dias</option>
                    </select>
                  </label>

                  <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">Peso do TB:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={0.25}
                        step={0.05}
                        value={tbWeight}
                        onChange={(e) => setTbWeight(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-600 w-12 text-right font-semibold">
                        {tbWeight.toFixed(2)}
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {mostrarGrafico && partidasPeriodo.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <GraficoEvolutivo
                partidas={partidasPeriodo}
                atletaId={atleta.id}
                tbWeight={tbWeight}
                title={
                  periodo === 'all'
                    ? 'Evolução do Atleta — Todas as partidas'
                    : `Evolução do Atleta — Últimos ${periodo} dias`
                }
              />
            </div>
          )}

          {mostrarPartidas && (
            <MinhasPartidas
              partidas={partidas}
              atletaId={atleta.id}
              onAbrirTodas={() => setMostrarPartidas(false)}
              onNovaPartida={carregarPartidas}
              onAtualizarPlacar={(p) => {
                setPartidaSelecionada(p);
                setModalPlacar(true);
              }}
            />
          )}

        </>
      )}

      {!atleta && (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600">Carregando informações do atleta...</p>
        </div>
      )}

      {/* Modal de atualizar placar */}
      <ModalPlacar
        isOpen={modalPlacar}
        partida={partidaSelecionada}
        onClose={() => {
          setModalPlacar(false);
          setPartidaSelecionada(null);
        }}
        onSuccess={() => {
          carregarPartidas();
        }}
      />
      </div>
    </div>
  );
}

