'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

type ApiResponse = {
  arena: { id: string; nome: string; logoUrl: string | null };
  periodo: { dataInicio: string; dataFim: string };
  clientes: Array<{
    id: string;
    nome: string;
    telefone: string | null;
    origem: 'ATLETA' | 'USUARIO' | 'AVULSO';
    agendamentos: Array<{
      id: string;
      dataHora: string;
      duracao: number;
      status: string;
      observacoes: string | null;
      quadraNome: string | null;
      ehAula: boolean | null;
      professorNome: string | null;
    }>;
  }>;
};

function toYMDLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRangeLocal(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function formatTime(dt: Date) {
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function formatDateTime(dateIso: string) {
  const dt = new Date(dateIso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy} ${formatTime(dt)}`;
}

function formatDateTimeRange(dateIso: string, duracaoMinutos: number) {
  const start = new Date(dateIso);
  const end = new Date(start.getTime() + (Number(duracaoMinutos || 0) || 0) * 60 * 1000);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${formatDateTime(dateIso)} - ${formatTime(end)}`;
  }

  return `${formatDateTime(dateIso)} - ${formatDateTime(end.toISOString())}`;
}

export default function ArenaLocacoesCardsAgendamentoPage() {
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [incluirCancelados, setIncluirCancelados] = useState(false);
  const [filtroAtleta, setFiltroAtleta] = useState('');
  const [copiando, setCopiando] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [dataInicio, setDataInicio] = useState(() => toYMDLocal(new Date()));
  const [dataFim, setDataFim] = useState(() => toYMDLocal(new Date()));

  const [response, setResponse] = useState<ApiResponse | null>(null);

  const carregar = async () => {
    setErro('');
    setResponse(null);

    if (!dataInicio || !dataFim) {
      setErro('Selecione data início e data fim');
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/gestao-arena/cards-agendamento', {
        params: {
          dataInicio,
          dataFim,
          incluirCancelados: incluirCancelados ? '1' : '0',
        },
      });
      setResponse(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao carregar cards de agendamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientes = response?.clientes || [];
  const arena = response?.arena;
  const arenaLogoUrl = arena?.logoUrl ? `/api/proxy/image?url=${encodeURIComponent(arena.logoUrl)}` : null;

  const clientesFiltrados = useMemo(() => {
    const v = filtroAtleta.trim().toLowerCase();
    if (!v) return clientes;
    return clientes.filter((c) => c.origem === 'ATLETA' && c.nome.toLowerCase().includes(v));
  }, [clientes, filtroAtleta]);

  const copiarCard = async (clienteId: string) => {
    if (!arena) return;

    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) return;

    const cardNode = cardRefs.current[clienteId];

    try {
      setCopiando((prev) => ({ ...prev, [clienteId]: true }));
      setCopiado((prev) => ({ ...prev, [clienteId]: false }));

      const canWriteImage =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof (navigator.clipboard as any).write === 'function' &&
        typeof (window as any).ClipboardItem !== 'undefined';

      if (canWriteImage && cardNode) {
        const { toBlob } = await import('html-to-image');
        const blob = await (toBlob as any)(cardNode, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          filter: (node: any) => {
            try {
              return !(node?.dataset?.noImage === '1');
            } catch {
              return true;
            }
          },
        });

        if (!blob) {
          throw new Error('Não foi possível gerar a imagem do card');
        }

        const item = new (window as any).ClipboardItem({
          'image/png': blob,
        });
        await (navigator.clipboard as any).write([item]);

        setCopiado((prev) => ({ ...prev, [clienteId]: true }));
        setTimeout(() => {
          setCopiado((prev) => ({ ...prev, [clienteId]: false }));
        }, 1500);
        return;
      }

      const linhas = [
        arena.nome,
        `${cliente.nome}${cliente.telefone ? ` • ${cliente.telefone}` : ''}`,
        `Período: ${response?.periodo.dataInicio} até ${response?.periodo.dataFim}`,
        '',
        ...(cliente.agendamentos || []).map((ag) => {
          const base = `${formatDateTimeRange(ag.dataHora, ag.duracao)} • ${ag.quadraNome || 'Quadra'} • ${ag.duracao} min • ${ag.status}`;
          const aula = ag.ehAula ? ` • Aula${ag.professorNome ? ` (${ag.professorNome})` : ''}` : '';
          const obs = ag.observacoes ? ` • Obs: ${ag.observacoes}` : '';
          return `${base}${aula}${obs}`;
        }),
      ].filter(Boolean);

      const textPlain = linhas.join('\n');

      const htmlRows = (cliente.agendamentos || [])
        .map((ag) => {
          const linha1 = `${formatDateTimeRange(ag.dataHora, ag.duracao)} • ${ag.quadraNome || 'Quadra'} • ${ag.duracao} min`;
          const linha2Parts = [ag.status];
          if (ag.ehAula) linha2Parts.push(`Aula${ag.professorNome ? ` (${ag.professorNome})` : ''}`);
          if (ag.observacoes) linha2Parts.push(`Obs: ${ag.observacoes}`);
          return `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">
                <div style="font-weight:700;color:#111827;">${linha1}</div>
                <div style="margin-top:2px;color:#374151;">${linha2Parts.join(' • ')}</div>
              </td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;max-width:700px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            ${
              arenaLogoUrl
                ? `<img src="${arenaLogoUrl}" alt="${arena.nome}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid #e5e7eb;" />`
                : `<div style="width:28px;height:28px;border-radius:6px;border:1px solid #e5e7eb;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-weight:700;color:#374151;">${(arena.nome || 'A')
                    .slice(0, 1)
                    .toUpperCase()}</div>`
            }
            <div style="font-size:14px;color:#111827;font-weight:700;">${arena.nome}</div>
          </div>
          <div style="font-size:20px;font-weight:800;color:#111827;">${cliente.nome}</div>
          <div style="margin-top:2px;color:#6b7280;font-size:12px;">
            ${cliente.telefone ? cliente.telefone : 'Sem telefone'} • ${cliente.origem} • Período: ${response?.periodo.dataInicio} até ${response?.periodo.dataFim}
          </div>
          <table style="border-collapse:collapse;width:100%;margin-top:12px;">
            <tbody>
              ${htmlRows || `<tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Sem agendamentos no período.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;

      const canWriteRich =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof (navigator.clipboard as any).write === 'function' &&
        typeof (window as any).ClipboardItem !== 'undefined';

      if (canWriteRich) {
        const item = new (window as any).ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([textPlain], { type: 'text/plain' }),
        });
        await (navigator.clipboard as any).write([item]);
      } else {
        await navigator.clipboard.writeText(textPlain);
      }

      setCopiado((prev) => ({ ...prev, [clienteId]: true }));
      setTimeout(() => {
        setCopiado((prev) => ({ ...prev, [clienteId]: false }));
      }, 1500);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível copiar o card');
    } finally {
      setCopiando((prev) => ({ ...prev, [clienteId]: false }));
    }
  };

  const totais = useMemo(() => {
    const totalAgendamentos = clientesFiltrados.reduce((acc, c) => acc + (c.agendamentos?.length || 0), 0);
    const totalHoras = clientesFiltrados.reduce((acc, c) => {
      const minutos = (c.agendamentos || []).reduce((a, ag) => a + (ag.duracao || 0), 0);
      return acc + minutos / 60;
    }, 0);
    return { totalAgendamentos, totalHoras };
  }, [clientesFiltrados]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cards de Agendamento</h1>
            <p className="text-gray-600 mt-1">
              Um card por cliente, listando os agendamentos do período selecionado (padrão: semana atual).
            </p>
          </div>
        </div>

        {erro && (
          <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {erro}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={incluirCancelados}
                onChange={(e) => setIncluirCancelados(e.target.checked)}
              />
              Incluir cancelados
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={carregar}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar atleta</label>
            <input
              value={filtroAtleta}
              onChange={(e) => setFiltroAtleta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              placeholder="Digite parte do nome do atleta..."
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFiltroAtleta('')}
              className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 font-medium hover:bg-gray-200"
              disabled={!filtroAtleta}
            >
              Limpar filtro
            </button>
          </div>
        </div>

        {response?.periodo && (
          <div className="mt-4 text-sm text-gray-700 flex flex-wrap gap-4">
            <div>
              Período: <span className="font-semibold">{response.periodo.dataInicio}</span> até{' '}
              <span className="font-semibold">{response.periodo.dataFim}</span>
            </div>
            <div>
              Clientes: <span className="font-semibold">{clientesFiltrados.length}</span>
            </div>
            <div>
              Agendamentos: <span className="font-semibold">{totais.totalAgendamentos}</span>
            </div>
            <div>
              Horas: <span className="font-semibold">{totais.totalHoras.toFixed(1).replace('.', ',')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {clientesFiltrados.map((cliente) => {
          const totalMinutos = (cliente.agendamentos || []).reduce((acc, a) => acc + (a.duracao || 0), 0);
          const totalHoras = totalMinutos / 60;
          return (
            <div
              key={cliente.id}
              className="bg-white rounded-lg shadow border border-gray-200"
              ref={(el) => {
                cardRefs.current[cliente.id] = el;
              }}
            >
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {arena && (
                      <div className="flex items-center gap-2 mb-1">
                        {arenaLogoUrl ? (
                          <img
                            src={arenaLogoUrl}
                            alt={arena.nome}
                            crossOrigin="anonymous"
                            className="w-6 h-6 rounded object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                            {(arena.nome || 'A').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="text-xs text-gray-600">{arena.nome}</div>
                      </div>
                    )}
                    <div className="text-lg font-bold text-gray-900">{cliente.nome}</div>
                    <div className="text-sm text-gray-600">
                      {cliente.telefone ? cliente.telefone : 'Sem telefone'} • {cliente.origem}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-700">
                    <button
                      type="button"
                      onClick={() => copiarCard(cliente.id)}
                      disabled={copiando[cliente.id]}
                      className="mb-2 text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copia o conteúdo do card para colar em outras ferramentas"
                      data-no-image="1"
                    >
                      {copiado[cliente.id] ? 'Copiado' : copiando[cliente.id] ? 'Copiando...' : 'Copiar imagem'}
                    </button>
                    <div>
                      <span className="font-semibold">{cliente.agendamentos.length}</span> agend.
                    </div>
                    <div>
                      <span className="font-semibold">{totalHoras.toFixed(1).replace('.', ',')}</span> h
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="space-y-2">
                  {cliente.agendamentos.map((ag) => (
                    <div key={ag.id} className="rounded border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900">
                            {formatDateTimeRange(ag.dataHora, ag.duracao)}
                          </div>
                          <div className="text-gray-700">
                            {ag.quadraNome ? ag.quadraNome : 'Quadra'} • {ag.duracao} min
                            {ag.ehAula ? ` • Aula${ag.professorNome ? ` (${ag.professorNome})` : ''}` : ''}
                          </div>
                          {ag.observacoes && (
                            <div className="mt-1 text-gray-600">
                              <span className="font-semibold">Obs:</span> {ag.observacoes}
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            ag.status === 'CONFIRMADO'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ag.status === 'CONCLUIDO'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ag.status}
                        </div>
                      </div>
                    </div>
                  ))}

                  {cliente.agendamentos.length === 0 && (
                    <div className="text-sm text-gray-500">Sem agendamentos no período.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && clientesFiltrados.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 lg:col-span-2">
            Nenhum agendamento encontrado para o período.
          </div>
        )}
      </div>
    </div>
  );
}
