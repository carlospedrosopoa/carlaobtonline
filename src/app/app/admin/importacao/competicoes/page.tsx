'use client';

import { useEffect, useMemo, useState } from 'react';
import { pointService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Point } from '@/types/agendamento';

type CompeticaoResumo = {
  id: string;
  nome: string;
  tipo: string;
  formato: string;
  status: string;
  dataInicio: string | null;
  dataFim: string | null;
  createdAt: string;
  jogosCount: number;
  jogosConcluidosCount: number;
  inscritosCount: number;
};

export default function AdminImportacaoCompeticoesPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [sourcePointId, setSourcePointId] = useState('');
  const [targetPointId, setTargetPointId] = useState('');
  const [status, setStatus] = useState('');
  const [nome, setNome] = useState('');

  const [competicoes, setCompeticoes] = useState<CompeticaoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});

  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoading(true);
        const data = await pointService.listar();
        setPoints(data);
      } catch (e) {
        setErro('Erro ao carregar arenas');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const pointsOrdenados = useMemo(() => {
    return [...points].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [points]);

  const idsSelecionados = useMemo(() => {
    return Object.entries(selecionadas)
      .filter(([_, v]) => v)
      .map(([k]) => k);
  }, [selecionadas]);

  const buscarCompeticoes = async () => {
    setErro('');
    setResultado(null);
    setCompeticoes([]);
    setSelecionadas({});

    if (!sourcePointId) {
      setErro('Selecione a arena de origem');
      return;
    }

    try {
      setCarregando(true);
      const res = await api.get('/admin/points/competicoes', {
        params: {
          sourcePointId,
          status: status || undefined,
          nome: nome || undefined,
        },
      });
      setCompeticoes(res.data || []);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao buscar competições');
    } finally {
      setCarregando(false);
    }
  };

  const importarSelecionadas = async () => {
    setErro('');
    setResultado(null);

    if (!sourcePointId || !targetPointId) {
      setErro('Selecione a arena de origem e destino');
      return;
    }
    if (sourcePointId === targetPointId) {
      setErro('Origem e destino devem ser diferentes');
      return;
    }
    if (idsSelecionados.length === 0) {
      setErro('Selecione ao menos uma competição');
      return;
    }

    try {
      setImportando(true);
      const res = await api.post('/admin/points/competicoes/importar', {
        sourcePointId,
        targetPointId,
        competicaoIds: idsSelecionados,
      });
      setResultado(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao importar competições');
    } finally {
      setImportando(false);
    }
  };

  const formatDate = (value: any) => {
    if (!value) return '-';
    const s = String(value);
    return s.includes('T') ? s.split('T')[0] : s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Carregando arenas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importação: competições</h1>
          <p className="text-gray-600 mt-1">Importa competição, tabela de jogos e resultados (placares e vencedores).</p>
        </div>

        {erro && (
          <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {erro}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arena de origem</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              value={sourcePointId}
              onChange={(e) => setSourcePointId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {pointsOrdenados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arena de destino</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              value={targetPointId}
              onChange={(e) => setTargetPointId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {pointsOrdenados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!sourcePointId}
            >
              <option value="">Todos</option>
              <option value="CRIADA">CRIADA</option>
              <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
              <option value="CONCLUIDA">CONCLUIDA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              placeholder="Buscar por nome..."
              disabled={!sourcePointId}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={buscarCompeticoes}
            disabled={carregando}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Buscando...' : 'Buscar competições'}
          </button>

          <button
            type="button"
            onClick={importarSelecionadas}
            disabled={importando || idsSelecionados.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importando ? 'Importando...' : `Importar selecionadas (${idsSelecionados.length})`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="font-semibold text-gray-900">Competições encontradas ({competicoes.length})</div>
          <button
            type="button"
            onClick={() => {
              const allOn = competicoes.length > 0 && competicoes.every((c) => selecionadas[c.id]);
              const next: Record<string, boolean> = {};
              for (const c of competicoes) next[c.id] = !allOn;
              setSelecionadas(next);
            }}
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
            disabled={competicoes.length === 0}
          >
            Marcar/Desmarcar todas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sel.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Formato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Início</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fim</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Inscritos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Jogos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Concluídos</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {competicoes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!selecionadas[c.id]}
                      onChange={(e) => setSelecionadas((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{c.nome}</div>
                    <div className="text-xs text-gray-500">{c.id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.tipo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.formato}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(c.dataInicio)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(c.dataFim)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{c.inscritosCount}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{c.jogosCount}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">{c.jogosConcluidosCount}</td>
                </tr>
              ))}
              {competicoes.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    {carregando ? 'Buscando...' : 'Nenhuma competição encontrada para os filtros'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resultado && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900">Resultado</h2>
          <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>Selecionadas: {resultado.competicoesSelecionadas}</div>
            <div>Importadas: {resultado.competicoesImportadas}</div>
            <div>Ignoradas (já existem): {resultado.competicoesIgnoradas}</div>
            <div>Jogos importados: {resultado.jogosImportados}</div>
            <div>Inscrições importadas: {resultado.atletasCompeticaoImportados}</div>
          </div>
        </div>
      )}
    </div>
  );
}

