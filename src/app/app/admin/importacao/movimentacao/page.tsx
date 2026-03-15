'use client';

import { useEffect, useMemo, useState } from 'react';
import { pointService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Point } from '@/types/agendamento';

type Operador = { id: string; name: string; email: string };
type ComandaResumo = {
  id: string;
  numeroCard: number;
  status: string;
  createdAt: string;
  valorTotal: string;
  totalPagoFiltrado: string;
  pagamentosCountFiltrado: number;
  itensCount: number;
  clienteNome: string;
  usuarioId: string | null;
};

function toYYYYMMDD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AdminImportacaoMovimentacaoPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [sourcePointId, setSourcePointId] = useState('');
  const [targetPointId, setTargetPointId] = useState('');
  const [dataInicio, setDataInicio] = useState(() => toYYYYMMDD(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [dataFim, setDataFim] = useState(() => toYYYYMMDD(new Date()));
  const [operadorId, setOperadorId] = useState('');

  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [comandas, setComandas] = useState<ComandaResumo[]>([]);
  const [carregandoComandas, setCarregandoComandas] = useState(false);
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

  const totalSelecionado = useMemo(() => {
    const map = new Map(comandas.map((c) => [c.id, c]));
    const sum = idsSelecionados.reduce((acc, id) => {
      const c = map.get(id);
      if (!c) return acc;
      const v = Number(c.totalPagoFiltrado || 0);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
    return sum;
  }, [comandas, idsSelecionados]);

  useEffect(() => {
    const carregarOperadores = async () => {
      setOperadores([]);
      setOperadorId('');
      if (!sourcePointId) return;
      try {
        const res = await api.get('/admin/points/movimentacao/operadores', {
          params: { sourcePointId, dataInicio, dataFim },
        });
        setOperadores(res.data || []);
      } catch (e) {
        setOperadores([]);
      }
    };
    carregarOperadores();
  }, [sourcePointId, dataInicio, dataFim]);

  const buscarComandas = async () => {
    setErro('');
    setResultado(null);
    setComandas([]);
    setSelecionadas({});

    if (!sourcePointId) {
      setErro('Selecione a arena de origem');
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro('Selecione data início e data fim');
      return;
    }

    try {
      setCarregandoComandas(true);
      const res = await api.get('/admin/points/movimentacao/comandas', {
        params: { sourcePointId, dataInicio, dataFim, operadorId: operadorId || undefined },
      });
      setComandas(res.data || []);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao buscar comandas');
    } finally {
      setCarregandoComandas(false);
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
      setErro('Selecione ao menos uma comanda');
      return;
    }

    try {
      setImportando(true);
      const res = await api.post('/admin/points/movimentacao/importar', {
        sourcePointId,
        targetPointId,
        cardIds: idsSelecionados,
      });
      setResultado(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao importar movimentação');
    } finally {
      setImportando(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Importação: movimentação (comandas)</h1>
          <p className="text-gray-600 mt-1">
            Importa comandas selecionadas com itens e pagamentos. Os pagamentos passam a aparecer no fluxo de caixa da arena destino.
          </p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              value={operadorId}
              onChange={(e) => setOperadorId(e.target.value)}
              disabled={!sourcePointId}
            >
              <option value="">Todos</option>
              {operadores.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={buscarComandas}
            disabled={carregandoComandas}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregandoComandas ? 'Buscando...' : 'Buscar comandas'}
          </button>

          <button
            type="button"
            onClick={importarSelecionadas}
            disabled={importando || idsSelecionados.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importando ? 'Importando...' : `Importar selecionadas (${idsSelecionados.length})`}
          </button>

          <div className="text-sm text-gray-700">
            Total (pagamentos filtrados): <span className="font-semibold">R$ {totalSelecionado.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="font-semibold text-gray-900">Comandas encontradas ({comandas.length})</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const allOn = comandas.length > 0 && comandas.every((c) => selecionadas[c.id]);
                const next: Record<string, boolean> = {};
                for (const c of comandas) next[c.id] = !allOn;
                setSelecionadas(next);
              }}
              className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
              disabled={comandas.length === 0}
            >
              Marcar/Desmarcar todas
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sel.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Comanda</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Itens</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Pagamentos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Pago</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comandas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!selecionadas[c.id]}
                      onChange={(e) => setSelecionadas((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-semibold text-gray-900">#{c.numeroCard}</div>
                    <div className="text-xs text-gray-500">{c.status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{c.clienteNome}</div>
                    {c.usuarioId && <div className="text-xs text-gray-500">{c.usuarioId}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {String(c.createdAt).includes('T') ? String(c.createdAt).split('T')[0] : String(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{c.itensCount}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{c.pagamentosCountFiltrado}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                    R$ {Number(c.totalPagoFiltrado || 0).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))}
              {comandas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {carregandoComandas ? 'Buscando...' : 'Nenhuma comanda encontrada para os filtros'}
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
            <div>Selecionadas: {resultado.cardsSelecionados}</div>
            <div>Importadas: {resultado.cardsImportados}</div>
            <div>Itens importados: {resultado.itensImportados}</div>
            <div>Pagamentos importados: {resultado.pagamentosImportados}</div>
            <div>Vínculos pagamento-itens: {resultado.pagamentoItensImportados}</div>
            {resultado.aberturaCaixaIdDestino && <div>Caixa destino (aberto): {resultado.aberturaCaixaIdDestino}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
