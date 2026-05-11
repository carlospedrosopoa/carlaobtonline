'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaPagarService, fornecedorService, tipoDespesaService, centroCustoService } from '@/services/gestaoArenaService';
import type { ContaPagarItem, CriarContaPagarPayload, Fornecedor, TipoDespesa, CentroCusto } from '@/types/gestaoArena';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, Wallet, Calendar, FileText, Trash2 } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

function somarDias(base: string, dias: number) {
  const [ano, mes, dia] = base.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatarDataPtBr(value: string) {
  const v = String(value || '');
  const ymd = v.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(v);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString('pt-BR');
  return v;
}

function statusColor(status: string) {
  if (status === 'LIQUIDADA') return 'bg-green-100 text-green-700';
  if (status === 'PARCIAL') return 'bg-amber-100 text-amber-700';
  if (status === 'CANCELADA') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-700';
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const CONTAS_PAGAR_SCROLL_KEY = 'contas-pagar:scroll-y';
const CONTAS_PAGAR_RESTORE_SCROLL_KEY = 'contas-pagar:restore-scroll';

function parseValorFiltro(value: string | null): number | null {
  if (!value) return null;
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
}

type FiltrosContaPagar = {
  status: string;
  pessoa: string;
  vencimentoInicio: string;
  vencimentoFim: string;
  fornecedorId: string;
  statusParcela: string;
  tipoDespesaId: string;
  centroCustoId: string;
  valorMin: number | null;
  valorMax: number | null;
};

function construirQueryStringFiltros(filtros: FiltrosContaPagar): string {
  const params = new URLSearchParams();

  if (filtros.status) params.set('status', filtros.status);
  if (filtros.pessoa) params.set('pessoa', filtros.pessoa);
  if (filtros.vencimentoInicio) params.set('vencimentoInicio', filtros.vencimentoInicio);
  if (filtros.vencimentoFim) params.set('vencimentoFim', filtros.vencimentoFim);
  if (filtros.fornecedorId) params.set('fornecedorId', filtros.fornecedorId);
  if (filtros.statusParcela) params.set('statusParcela', filtros.statusParcela);
  if (filtros.tipoDespesaId) params.set('tipoDespesaId', filtros.tipoDespesaId);
  if (filtros.centroCustoId) params.set('centroCustoId', filtros.centroCustoId);
  if (filtros.valorMin !== null) params.set('valorMin', String(filtros.valorMin));
  if (filtros.valorMax !== null) params.set('valorMax', String(filtros.valorMax));

  return params.toString();
}

function podeExcluirParcela(item: ContaPagarItem) {
  return item.statusParcela === 'PENDENTE';
}

export default function ContasPagarPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [itens, setItens] = useState<ContaPagarItem[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoIds, setExcluindoIds] = useState<string[]>([]);
  const [excluindoEmLote, setExcluindoEmLote] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(() =>
    Boolean(
      searchParams.get('vencimentoInicio') ||
      searchParams.get('vencimentoFim') ||
      searchParams.get('fornecedorId') ||
      searchParams.get('statusParcela') ||
      searchParams.get('tipoDespesaId') ||
      searchParams.get('centroCustoId') ||
      searchParams.get('valorMin') ||
      searchParams.get('valorMax')
    )
  );
  const [modalAberto, setModalAberto] = useState(false);

  const [filtros, setFiltros] = useState<FiltrosContaPagar>(() => ({
    status: searchParams.get('status') || '',
    pessoa: searchParams.get('pessoa') || '',
    vencimentoInicio: searchParams.get('vencimentoInicio') || '',
    vencimentoFim: searchParams.get('vencimentoFim') || '',
    fornecedorId: searchParams.get('fornecedorId') || '',
    statusParcela: searchParams.get('statusParcela') || '',
    tipoDespesaId: searchParams.get('tipoDespesaId') || '',
    centroCustoId: searchParams.get('centroCustoId') || '',
    valorMin: parseValorFiltro(searchParams.get('valorMin')),
    valorMax: parseValorFiltro(searchParams.get('valorMax')),
  }));
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosContaPagar>(() => ({
    status: searchParams.get('status') || '',
    pessoa: searchParams.get('pessoa') || '',
    vencimentoInicio: searchParams.get('vencimentoInicio') || '',
    vencimentoFim: searchParams.get('vencimentoFim') || '',
    fornecedorId: searchParams.get('fornecedorId') || '',
    statusParcela: searchParams.get('statusParcela') || '',
    tipoDespesaId: searchParams.get('tipoDespesaId') || '',
    centroCustoId: searchParams.get('centroCustoId') || '',
    valorMin: parseValorFiltro(searchParams.get('valorMin')),
    valorMax: parseValorFiltro(searchParams.get('valorMax')),
  }));

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const [form, setForm] = useState({
    descricao: '',
    fornecedorId: '',
    tipoDespesaId: '',
    centroCustoId: '',
    codigoExterno: '',
    observacoes: '',
    vencimentoInicial: hojeStr,
    quantidadeParcelas: 1,
    intervaloDias: 30,
    valorParcela: null as number | null,
  });

  const carregarTudo = async () => {
    if (!usuario?.pointIdGestor) return;
    try {
      setLoading(true);
      const [lista, forn, tipos, centros] = await Promise.all([
        contaPagarService.listar({
          pointId: usuario.pointIdGestor,
          status: filtrosAplicados.status,
          pessoa: filtrosAplicados.pessoa,
          vencimentoInicio: filtrosAplicados.vencimentoInicio,
          vencimentoFim: filtrosAplicados.vencimentoFim,
          fornecedorId: filtrosAplicados.fornecedorId,
          statusParcela: filtrosAplicados.statusParcela,
          tipoDespesaId: filtrosAplicados.tipoDespesaId,
          centroCustoId: filtrosAplicados.centroCustoId,
          valorMin: filtrosAplicados.valorMin !== null ? String(filtrosAplicados.valorMin) : '',
          valorMax: filtrosAplicados.valorMax !== null ? String(filtrosAplicados.valorMax) : '',
        }),
        fornecedorService.listar(usuario.pointIdGestor, true),
        tipoDespesaService.listar(usuario.pointIdGestor, true),
        centroCustoService.listar(usuario.pointIdGestor, true),
      ]);
      setItens(lista);
      setFornecedores(forn);
      setTiposDespesa(tipos);
      setCentrosCusto(centros);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar contas a pagar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, [usuario?.pointIdGestor, filtrosAplicados]);

  useEffect(() => {
    const queryString = construirQueryStringFiltros(filtrosAplicados);
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, filtrosAplicados]);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const deveRestaurar = window.sessionStorage.getItem(CONTAS_PAGAR_RESTORE_SCROLL_KEY);
    const scrollSalvo = window.sessionStorage.getItem(CONTAS_PAGAR_SCROLL_KEY);
    if (deveRestaurar !== '1' || !scrollSalvo) return;

    const scrollY = Number(scrollSalvo);
    window.sessionStorage.removeItem(CONTAS_PAGAR_RESTORE_SCROLL_KEY);
    window.sessionStorage.removeItem(CONTAS_PAGAR_SCROLL_KEY);

    if (Number.isFinite(scrollY)) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'auto' });
      });
    }
  }, [loading]);

  const montarUrlConsultaAtual = () => {
    const queryString = construirQueryStringFiltros(filtrosAplicados);
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const aplicarFiltros = () => {
    setFiltrosAplicados({ ...filtros });
  };

  const abrirDetalhes = (parcelaId: string) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CONTAS_PAGAR_SCROLL_KEY, String(window.scrollY));
      window.sessionStorage.setItem(CONTAS_PAGAR_RESTORE_SCROLL_KEY, '1');
    }

    const voltarPara = encodeURIComponent(montarUrlConsultaAtual());
    router.push(`/app/arena/contas-pagar/despesas/${parcelaId}?voltarPara=${voltarPara}`);
  };

  const itensSelecionaveis = useMemo(
    () => itens.filter((item) => podeExcluirParcela(item)),
    [itens]
  );
  const todosSelecionaveisMarcados =
    itensSelecionaveis.length > 0 &&
    itensSelecionaveis.every((item) => selecionados.includes(item.parcelaId));

  useEffect(() => {
    setSelecionados((atual) =>
      atual.filter((parcelaId) => itens.some((item) => item.parcelaId === parcelaId && podeExcluirParcela(item)))
    );
  }, [itens]);

  const alternarSelecao = (parcelaId: string) => {
    setSelecionados((atual) =>
      atual.includes(parcelaId)
        ? atual.filter((id) => id !== parcelaId)
        : [...atual, parcelaId]
    );
  };

  const alternarSelecaoTodos = () => {
    setSelecionados((atual) =>
      todosSelecionaveisMarcados ? [] : itensSelecionaveis.map((item) => item.parcelaId)
    );
  };

  const excluirParcelas = async (parcelaIds: string[]) => {
    if (parcelaIds.length === 0) return;

    const mensagemConfirmacao =
      parcelaIds.length === 1
        ? 'Excluir esta conta a pagar pendente?'
        : `Excluir as ${parcelaIds.length} contas a pagar pendentes selecionadas?`;

    if (!window.confirm(mensagemConfirmacao)) {
      return;
    }

    try {
      setErro('');

      if (parcelaIds.length === 1) {
        setExcluindoIds(parcelaIds);
      } else {
        setExcluindoEmLote(true);
      }

      for (const parcelaId of parcelaIds) {
        await contaPagarService.excluirDespesa(parcelaId);
      }

      setSelecionados((atual) => atual.filter((id) => !parcelaIds.includes(id)));
      await carregarTudo();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir conta(s) a pagar');
    } finally {
      setExcluindoIds([]);
      setExcluindoEmLote(false);
    }
  };

  const totais = useMemo(() => {
    return itens.reduce(
      (acc, item) => {
        acc.valor += Number(item.valor);
        acc.liquidado += Number(item.valorLiquidado);
        return acc;
      },
      { valor: 0, liquidado: 0 }
    );
  }, [itens]);

  const salvarConta = async () => {
    if (!usuario?.pointIdGestor) return;
    if (!form.descricao.trim() || !form.vencimentoInicial || !form.valorParcela || form.valorParcela <= 0) {
      setErro('Preencha descrição, vencimento inicial e valor da parcela');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      const payload: CriarContaPagarPayload = {
        pointId: usuario.pointIdGestor,
        descricao: form.descricao.trim(),
        fornecedorId: form.fornecedorId || null,
        tipoDespesaId: form.tipoDespesaId || null,
        centroCustoId: form.centroCustoId || null,
        codigoExterno: form.codigoExterno.trim() || undefined,
        observacoes: form.observacoes.trim() || undefined,
        parcelas: Array.from({ length: Math.max(1, form.quantidadeParcelas) }).map((_, idx) => ({
          numero: idx + 1,
          vencimento: somarDias(form.vencimentoInicial, idx * Math.max(1, form.intervaloDias)),
          valor: form.valorParcela!,
        })),
      };
      await contaPagarService.criar(payload);
      setModalAberto(false);
      setForm({
        descricao: '',
        fornecedorId: '',
        tipoDespesaId: '',
        centroCustoId: '',
        codigoExterno: '',
        observacoes: '',
        vencimentoInicial: hojeStr,
        quantidadeParcelas: 1,
        intervaloDias: 30,
        valorParcela: null,
      });
      await carregarTudo();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao criar conta a pagar');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="text-gray-600 mt-1">Provisionamento e liquidação de despesas</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Provisionado</div>
          <div className="text-2xl font-bold text-gray-900">{formatarMoeda(totais.valor)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Liquidado</div>
          <div className="text-2xl font-bold text-green-700">{formatarMoeda(totais.liquidado)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pendente</div>
          <div className="text-2xl font-bold text-amber-700">{formatarMoeda(totais.valor - totais.liquidado)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filtros.pessoa}
              onChange={(e) => setFiltros((atual) => ({ ...atual, pessoa: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  aplicarFiltros();
                }
              }}
              placeholder="Buscar por descrição ou fornecedor"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2"
            />
          </div>
          <button
            onClick={aplicarFiltros}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            Buscar
          </button>
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {filtrosAbertos && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="date" value={filtros.vencimentoInicio} onChange={(e) => setFiltros((atual) => ({ ...atual, vencimentoInicio: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2" />
            <input type="date" value={filtros.vencimentoFim} onChange={(e) => setFiltros((atual) => ({ ...atual, vencimentoFim: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2" />
            <select value={filtros.statusParcela} onChange={(e) => setFiltros((atual) => ({ ...atual, statusParcela: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Status parcela</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="LIQUIDADA">Liquidada</option>
            </select>
            <select value={filtros.status} onChange={(e) => setFiltros((atual) => ({ ...atual, status: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Status conta</option>
              <option value="ABERTA">Aberta</option>
              <option value="PARCIAL">Parcial</option>
              <option value="LIQUIDADA">Liquidada</option>
            </select>
            <select value={filtros.fornecedorId} onChange={(e) => setFiltros((atual) => ({ ...atual, fornecedorId: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Fornecedor</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select value={filtros.tipoDespesaId} onChange={(e) => setFiltros((atual) => ({ ...atual, tipoDespesaId: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Tipo de despesa</option>
              {tiposDespesa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={filtros.centroCustoId} onChange={(e) => setFiltros((atual) => ({ ...atual, centroCustoId: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Centro de custo</option>
              {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <InputMonetario value={filtros.valorMin} onChange={(value) => setFiltros((atual) => ({ ...atual, valorMin: value }))} placeholder="Valor mínimo" />
            <InputMonetario value={filtros.valorMax} onChange={(value) => setFiltros((atual) => ({ ...atual, valorMax: value }))} placeholder="Valor máximo" />
          </div>
        )}

        {itensSelecionaveis.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={todosSelecionaveisMarcados}
                  onChange={alternarSelecaoTodos}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Selecionar parcelas pendentes visíveis
              </label>
              {selecionados.length > 0 && (
                <span className="text-sm text-slate-600">
                  {selecionados.length} selecionada{selecionados.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setSelecionados([])}
                disabled={selecionados.length === 0 || excluindoEmLote}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={() => excluirParcelas(selecionados)}
                disabled={selecionados.length === 0 || excluindoEmLote}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {excluindoEmLote ? 'Excluindo selecionadas...' : `Excluir selecionadas${selecionados.length > 0 ? ` (${selecionados.length})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[1050px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700 w-12">
                <input
                  type="checkbox"
                  checked={todosSelecionaveisMarcados}
                  onChange={alternarSelecaoTodos}
                  disabled={itensSelecionaveis.length === 0}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                  aria-label="Selecionar parcelas pendentes visíveis"
                />
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Vencimento</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Descrição</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Fornecedor</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Parcela</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Valor</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Liquidado</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Ação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.parcelaId} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  {podeExcluirParcela(item) ? (
                    <input
                      type="checkbox"
                      checked={selecionados.includes(item.parcelaId)}
                      onChange={() => alternarSelecao(item.parcelaId)}
                      disabled={excluindoEmLote || excluindoIds.includes(item.parcelaId)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                      aria-label={`Selecionar despesa ${item.descricao}`}
                    />
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDataPtBr(item.vencimento)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.fornecedorNome || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.numero}/{item.totalParcelas}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatarMoeda(Number(item.valor))}</td>
                <td className="px-4 py-3 text-sm text-green-700 text-right">{formatarMoeda(Number(item.valorLiquidado))}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(item.statusParcela)}`}>{item.statusParcela}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {podeExcluirParcela(item) && (
                      <button
                        type="button"
                        onClick={() => excluirParcelas([item.parcelaId])}
                        disabled={excluindoEmLote || excluindoIds.includes(item.parcelaId)}
                        title="Excluir parcela pendente"
                        aria-label={`Excluir despesa ${item.descricao}`}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => abrirDetalhes(item.parcelaId)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                    >
                      Detalhes
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={9}>Nenhuma despesa encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">Nova Conta a Pagar</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <input value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Fornecedor</label>
                <select value={form.fornecedorId} onChange={(e) => setForm((p) => ({ ...p, fornecedorId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="">Selecione</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo de despesa</label>
                <select value={form.tipoDespesaId} onChange={(e) => setForm((p) => ({ ...p, tipoDespesaId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="">Selecione</option>
                  {tiposDespesa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Centro de custo</label>
                <select value={form.centroCustoId} onChange={(e) => setForm((p) => ({ ...p, centroCustoId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="">Selecione</option>
                  {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Código externo</label>
                <input value={form.codigoExterno} onChange={(e) => setForm((p) => ({ ...p, codigoExterno: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" rows={2} />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Parcelamento</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">1º vencimento</label>
                  <input type="date" value={form.vencimentoInicial} onChange={(e) => setForm((p) => ({ ...p, vencimentoInicial: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Quantidade</label>
                  <input type="number" min={1} max={60} value={form.quantidadeParcelas} onChange={(e) => setForm((p) => ({ ...p, quantidadeParcelas: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Intervalo (dias)</label>
                  <input type="number" min={1} max={365} value={form.intervaloDias} onChange={(e) => setForm((p) => ({ ...p, intervaloDias: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor da parcela</label>
                  <InputMonetario value={form.valorParcela} onChange={(v) => setForm((p) => ({ ...p, valorParcela: v }))} placeholder="0,00" />
                </div>
              </div>
              <div className="text-xs text-gray-600">
                {form.valorParcela ? `Total provisionado: ${formatarMoeda(form.valorParcela * Math.max(1, form.quantidadeParcelas))}` : 'Informe o valor da parcela'}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarConta} disabled={salvando} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {salvando ? 'Salvando...' : 'Salvar conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
