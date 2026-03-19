'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Download, Search, ExternalLink } from 'lucide-react';
import { dashboardOperacionalService } from '@/services/gestaoArenaService';
import type { DashboardOperacionalComandaConsiderada } from '@/types/gestaoArena';
import { formatarMoeda } from './DashboardOperacionalWidgets';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function escapeCsv(value: any) {
  const s = String(value ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadText(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function ModalComandasConsideradas({
  isOpen,
  onClose,
  pointId,
  dataInicio,
  dataFim,
  onAbrirCard,
}: {
  isOpen: boolean;
  onClose: () => void;
  pointId: string;
  dataInicio: string;
  dataFim: string;
  onAbrirCard: (cardId: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [q, setQ] = useState('');
  const [qAplicada, setQAplicada] = useState('');
  const [total, setTotal] = useState(0);
  const [itens, setItens] = useState<DashboardOperacionalComandaConsiderada[]>([]);

  const carregar = async (query: string) => {
    if (!pointId || !dataInicio || !dataFim) return;
    try {
      setCarregando(true);
      setErro('');
      const res = await dashboardOperacionalService.listarComandasConsideradas(pointId, dataInicio, dataFim, {
        q: query,
        limit: 500,
        offset: 0,
      });
      setTotal(res.total || 0);
      setItens(res.itens || []);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao carregar comandas');
      setTotal(0);
      setItens([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setQ('');
    setQAplicada('');
    carregar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totalMostrado = useMemo(() => {
    return itens.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  }, [itens]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="text-xl font-bold text-gray-900">Comandas consideradas</div>
            <div className="text-sm text-gray-600">
              {formatarDataHora(dataInicio)} até {formatarDataHora(dataFim)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por número ou cliente..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const v = q.trim();
                  setQAplicada(v);
                  carregar(v);
                }}
                disabled={carregando}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Filtrar
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-700">
                {total ? (
                  <>
                    {itens.length} de {total} comandas
                  </>
                ) : (
                  <>0 comandas</>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const header = [
                    'cardId',
                    'numeroCard',
                    'status',
                    'cliente',
                    'totalItens',
                    'total',
                    'primeiroItemAt',
                    'ultimoItemAt',
                    'dataInicioFiltro',
                    'dataFimFiltro',
                    'q',
                  ].join(';');

                  const lines = itens.map((r) =>
                    [
                      escapeCsv(r.id),
                      escapeCsv(r.numeroCard),
                      escapeCsv(r.status),
                      escapeCsv(r.clienteNome),
                      escapeCsv(r.totalItens),
                      escapeCsv(r.total),
                      escapeCsv(r.primeiroItemAt),
                      escapeCsv(r.ultimoItemAt),
                      escapeCsv(dataInicio),
                      escapeCsv(dataFim),
                      escapeCsv(qAplicada),
                    ].join(';')
                  );

                  downloadText(
                    `comandas-consideradas-${new Date().toISOString().slice(0, 10)}.csv`,
                    [header, ...lines].join('\n'),
                    'text/csv;charset=utf-8'
                  );
                }}
                disabled={itens.length === 0}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2"
                title="Exportar CSV"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {!!itens.length && (
            <div className="mt-2 text-xs text-gray-600">
              Total (mostrado): <span className="font-semibold text-gray-900">{formatarMoeda(totalMostrado)}</span>
              {total > itens.length ? <span className="ml-2">(lista limitada a 500 resultados)</span> : null}
            </div>
          )}

          {erro && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {erro}
            </div>
          )}
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {carregando ? (
            <div className="p-6 text-sm text-gray-600">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">Nenhuma comanda encontrada.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-3 px-6">Comanda</th>
                  <th className="py-3 px-6">Cliente</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Itens</th>
                  <th className="py-3 px-6 text-right">Total</th>
                  <th className="py-3 px-6">Último item</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-3 px-6 font-semibold text-gray-900">#{r.numeroCard}</td>
                    <td className="py-3 px-6 text-gray-900">{r.clienteNome}</td>
                    <td className="py-3 px-6 text-gray-700">{r.status}</td>
                    <td className="py-3 px-6 text-right text-gray-900">{r.totalItens}</td>
                    <td className="py-3 px-6 text-right text-gray-900">{formatarMoeda(r.total)}</td>
                    <td className="py-3 px-6 text-gray-700">{formatarDataHora(r.ultimoItemAt)}</td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onAbrirCard(r.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                        title="Abrir comanda"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
