'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaPagarService, fornecedorService, tipoDespesaService, centroCustoService } from '@/services/gestaoArenaService';
import type { ContaPagarItem, CriarContaPagarPayload, Fornecedor, TipoDespesa, CentroCusto } from '@/types/gestaoArena';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Wallet, Calendar, FileText } from 'lucide-react';
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

export default function ContasPagarPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [itens, setItens] = useState<ContaPagarItem[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const [status, setStatus] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [vencimentoInicio, setVencimentoInicio] = useState('');
  const [vencimentoFim, setVencimentoFim] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [statusParcela, setStatusParcela] = useState('');
  const [tipoDespesaId, setTipoDespesaId] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');
  const [valorMin, setValorMin] = useState<number | null>(null);
  const [valorMax, setValorMax] = useState<number | null>(null);

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
          status,
          pessoa,
          vencimentoInicio,
          vencimentoFim,
          fornecedorId,
          statusParcela,
          tipoDespesaId,
          centroCustoId,
          valorMin: valorMin !== null ? String(valorMin) : '',
          valorMax: valorMax !== null ? String(valorMax) : '',
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
  }, [usuario?.pointIdGestor, status, fornecedorId, statusParcela, tipoDespesaId, centroCustoId]);

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
              value={pessoa}
              onChange={(e) => setPessoa(e.target.value)}
              placeholder="Buscar por descrição ou fornecedor"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2"
            />
          </div>
          <button
            onClick={() => carregarTudo()}
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
            <input type="date" value={vencimentoInicio} onChange={(e) => setVencimentoInicio(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
            <input type="date" value={vencimentoFim} onChange={(e) => setVencimentoFim(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
            <select value={statusParcela} onChange={(e) => setStatusParcela(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Status parcela</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="LIQUIDADA">Liquidada</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Status conta</option>
              <option value="ABERTA">Aberta</option>
              <option value="PARCIAL">Parcial</option>
              <option value="LIQUIDADA">Liquidada</option>
            </select>
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Fornecedor</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select value={tipoDespesaId} onChange={(e) => setTipoDespesaId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Tipo de despesa</option>
              {tiposDespesa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Centro de custo</option>
              {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <InputMonetario value={valorMin} onChange={setValorMin} placeholder="Valor mínimo" />
            <InputMonetario value={valorMax} onChange={setValorMax} placeholder="Valor máximo" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[1050px]">
          <thead className="bg-gray-50 border-b">
            <tr>
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
                  <button
                    onClick={() => router.push(`/app/arena/contas-pagar/despesas/${item.parcelaId}`)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={8}>Nenhuma despesa encontrada</td>
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
