'use client';

import { useEffect, useMemo, useState } from 'react';
import { pointService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Point } from '@/types/agendamento';

type TabelaBasica = 'FORNECEDORES' | 'PRODUTOS' | 'TIPO_DESPESA' | 'CENTRO_CUSTO' | 'FORMA_PAGAMENTO';

const tabelasDisponiveis: Array<{ key: TabelaBasica; label: string }> = [
  { key: 'FORNECEDORES', label: 'Fornecedores' },
  { key: 'PRODUTOS', label: 'Produtos' },
  { key: 'TIPO_DESPESA', label: 'Tipo de Despesa' },
  { key: 'CENTRO_CUSTO', label: 'Centro de Custo' },
  { key: 'FORMA_PAGAMENTO', label: 'Forma de Pagamento' },
];

export default function AdminImportacaoTabelasBasicasPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [sourcePointId, setSourcePointId] = useState('');
  const [targetPointId, setTargetPointId] = useState('');
  const [tabelas, setTabelas] = useState<Record<TabelaBasica, boolean>>({
    FORNECEDORES: true,
    PRODUTOS: true,
    TIPO_DESPESA: true,
    CENTRO_CUSTO: true,
    FORMA_PAGAMENTO: true,
  });

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

  const tabelasSelecionadas = useMemo(() => {
    return tabelasDisponiveis.filter((t) => tabelas[t.key]).map((t) => t.key);
  }, [tabelas]);

  const importar = async () => {
    setErro('');
    setResultado(null);

    if (!sourcePointId || !targetPointId) {
      setErro('Selecione a arena de origem e a arena de destino');
      return;
    }
    if (sourcePointId === targetPointId) {
      setErro('Origem e destino devem ser diferentes');
      return;
    }
    if (tabelasSelecionadas.length === 0) {
      setErro('Selecione ao menos um tipo de dado para importar');
      return;
    }

    try {
      setImportando(true);
      const res = await api.post('/admin/points/importar-dados-basicos', {
        sourcePointId,
        targetPointId,
        tabelas: tabelasSelecionadas,
      });
      setResultado(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.mensagem || 'Erro ao importar dados');
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importação: tabelas básicas</h1>
            <p className="text-gray-600 mt-1">
              Copia cadastros básicos de uma arena (origem) para outra (destino), evitando duplicatas por nome.
            </p>
          </div>
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

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-sm font-semibold text-gray-800">Dados para importar</h2>
            <button
              type="button"
              onClick={() => {
                const allOn = tabelasDisponiveis.every((t) => tabelas[t.key]);
                const next = Object.fromEntries(tabelasDisponiveis.map((t) => [t.key, !allOn])) as Record<TabelaBasica, boolean>;
                setTabelas(next);
              }}
              className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              Marcar/Desmarcar todos
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {tabelasDisponiveis.map((t) => (
              <label
                key={t.key}
                className="flex items-center gap-2 p-2 rounded border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={tabelas[t.key]}
                  onChange={(e) => setTabelas((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                />
                <span className="text-sm text-gray-800">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={importar}
            disabled={importando}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importando ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>

      {resultado?.tabelas && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900">Resultado</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(resultado.tabelas).map(([k, v]: any) => (
              <div key={k} className="rounded border border-gray-200 p-4">
                <div className="font-semibold text-gray-900">{tabelasDisponiveis.find((t) => t.key === k)?.label || k}</div>
                <div className="mt-2 text-sm text-gray-700">
                  <div>Origem: {v.totalOrigem}</div>
                  <div>Inseridos: {v.inseridos}</div>
                  <div>Ignorados: {v.ignorados}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

