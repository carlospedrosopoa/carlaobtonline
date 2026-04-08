'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { centroCustoService, contaPagarService, fornecedorService, formaPagamentoService, tipoDespesaService } from '@/services/gestaoArenaService';
import type { CentroCusto, ContaPagarDespesaResponse, Fornecedor, FormaPagamento, TipoDespesa } from '@/types/gestaoArena';
import { ArrowLeft, Save, Trash2, Wallet } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

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

export default function DespesaContaPagarPage() {
  const params = useParams<{ parcelaId: string }>();
  const router = useRouter();
  const parcelaId = params?.parcelaId;
  const [dados, setDados] = useState<ContaPagarDespesaResponse | null>(null);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [liquidando, setLiquidando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  const [descricao, setDescricao] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [tipoDespesaId, setTipoDespesaId] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');
  const [codigoExterno, setCodigoExterno] = useState('');

  const [vencimento, setVencimento] = useState('');
  const [valor, setValor] = useState<number | null>(null);
  const [observacoes, setObservacoes] = useState('');

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const [dataLiquidacao, setDataLiquidacao] = useState(hojeStr);
  const [valorLiquidacao, setValorLiquidacao] = useState<number | null>(null);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [observacaoLiquidacao, setObservacaoLiquidacao] = useState('');

  const carregar = async () => {
    if (!parcelaId) return;
    try {
      setLoading(true);
      setErro('');
      const response = await contaPagarService.obterDespesa(parcelaId);
      setDados(response);
      setVencimento(response.despesa.vencimento?.slice(0, 10));
      setValor(Number(response.despesa.valor));
      setObservacoes(response.despesa.observacoes || '');
      setDescricao(response.despesa.descricao || '');
      setFornecedorId(response.despesa.fornecedorId || '');
      setTipoDespesaId(response.despesa.tipoDespesaId || '');
      setCentroCustoId(response.despesa.centroCustoId || '');
      setCodigoExterno(response.despesa.codigoExterno || '');

      const saldo = Number(response.despesa.valor) - Number(response.despesa.valorLiquidado || 0);
      setValorLiquidacao(saldo > 0 ? saldo : 0);

      const [formas, fornecs, tipos, centros] = await Promise.all([
        formaPagamentoService.listar(response.despesa.pointId, true),
        fornecedorService.listar(response.despesa.pointId, true),
        tipoDespesaService.listar(response.despesa.pointId, true),
        centroCustoService.listar(response.despesa.pointId, true),
      ]);
      setFormasPagamento(formas);
      setFornecedores(fornecs);
      setTiposDespesa(tipos);
      setCentrosCusto(centros);
      if (!formaPagamentoId && formas.length > 0) {
        setFormaPagamentoId(formas[0].id);
      }
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar despesa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [parcelaId]);

  const resumo = useMemo(() => {
    const valorDespesa = Number(dados?.despesa?.valor || 0);
    const liquidado = Number(dados?.despesa?.valorLiquidado || 0);
    return {
      valor: valorDespesa,
      liquidado,
      saldo: Math.max(0, valorDespesa - liquidado),
    };
  }, [dados]);

  const salvarDespesa = async () => {
    if (!parcelaId || !vencimento || !valor || valor <= 0) {
      setErro('Informe vencimento e valor válidos');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      setOk('');
      await contaPagarService.atualizarDespesa(parcelaId, {
        vencimento,
        valor,
        descricao,
        fornecedorId,
        tipoDespesaId,
        centroCustoId,
        codigoExterno,
        observacoes,
      });
      setOk('Despesa atualizada com sucesso');
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar despesa');
    } finally {
      setSalvando(false);
    }
  };

  const liquidar = async () => {
    if (!parcelaId || !dataLiquidacao || !formaPagamentoId || !valorLiquidacao || valorLiquidacao <= 0) {
      setErro('Preencha data, valor e forma de pagamento');
      return;
    }
    try {
      setLiquidando(true);
      setErro('');
      setOk('');
      await contaPagarService.liquidarParcela({
        parcelaId,
        data: dataLiquidacao,
        valor: valorLiquidacao,
        formaPagamentoId,
        observacoes: observacaoLiquidacao,
      });
      setOk('Liquidação registrada com sucesso');
      setObservacaoLiquidacao('');
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao liquidar parcela');
    } finally {
      setLiquidando(false);
    }
  };

  const excluirDespesa = async () => {
    if (!parcelaId) return;
    const okConfirm = window.confirm('Excluir esta despesa? Não é permitido excluir se houver pagamentos.');
    if (!okConfirm) return;
    try {
      setErro('');
      setOk('');
      await contaPagarService.excluirDespesa(parcelaId);
      router.push('/app/arena/contas-pagar');
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir despesa');
    }
  };

  const excluirLiquidacao = async (liquidacaoId: string) => {
    if (!liquidacaoId) return;
    const okConfirm = window.confirm('Excluir este pagamento? Esta ação irá estornar o lançamento no caixa/conta bancária.');
    if (!okConfirm) return;
    try {
      setErro('');
      setOk('');
      await contaPagarService.excluirLiquidacao(liquidacaoId);
      setOk('Pagamento excluído com sucesso');
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir pagamento');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!dados) {
    return <div className="text-gray-600">Despesa não encontrada.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => router.push('/app/arena/contas-pagar')} className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Despesa #{dados.despesa.numero}</h1>
          <p className="text-gray-600 mt-1">{dados.despesa.descricao}</p>
        </div>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {ok && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{ok}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Valor</div>
          <div className="text-2xl font-bold text-gray-900">R$ {resumo.valor.toFixed(2).replace('.', ',')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Liquidado</div>
          <div className="text-2xl font-bold text-green-700">R$ {resumo.liquidado.toFixed(2).replace('.', ',')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Saldo</div>
          <div className="text-2xl font-bold text-amber-700">R$ {resumo.saldo.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Dados da despesa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Código externo</label>
            <input
              value={codigoExterno}
              onChange={(e) => setCodigoExterno(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Fornecedor</label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
            >
              <option value="">Selecione</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Tipo de despesa</label>
            <select
              value={tipoDespesaId}
              onChange={(e) => setTipoDespesaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
            >
              <option value="">Selecione</option>
              {tiposDespesa.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Centro de custo</label>
            <select
              value={centroCustoId}
              onChange={(e) => setCentroCustoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
            >
              <option value="">Selecione</option>
              {centrosCusto.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Vencimento</label>
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Valor</label>
            <InputMonetario value={valor} onChange={setValor} placeholder="0,00" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <div className="mt-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-sm">{dados.despesa.statusParcela}</div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" rows={3} />
        </div>
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={excluirDespesa}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
            <button onClick={salvarDespesa} disabled={salvando} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Nova liquidação</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Data</label>
            <input type="date" value={dataLiquidacao} onChange={(e) => setDataLiquidacao(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Valor</label>
            <InputMonetario value={valorLiquidacao} onChange={setValorLiquidacao} placeholder="0,00" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
            <select value={formaPagamentoId} onChange={(e) => setFormaPagamentoId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
              <option value="">Selecione</option>
              {formasPagamento.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={liquidar} disabled={liquidando || resumo.saldo <= 0} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {liquidando ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </div>
        {formaPagamentoId && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Destino financeiro pela forma de pagamento: {formasPagamento.find((f) => f.id === formaPagamentoId)?.origemFinanceiraPadrao === 'CONTA_BANCARIA'
              ? `Conta bancária (${formasPagamento.find((f) => f.id === formaPagamentoId)?.contaBancariaNomePadrao || '-'})`
              : 'Caixa'}
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <input value={observacaoLiquidacao} onChange={(e) => setObservacaoLiquidacao(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Origem</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Forma</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Observações</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.liquidacoes.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDataPtBr(l.data)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{l.origemFinanceira === 'CONTA_BANCARIA' ? `Conta: ${l.contaBancariaNome || '-'}` : 'Caixa'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{l.formaPagamentoNome || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">R$ {Number(l.valor).toFixed(2).replace('.', ',')}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{l.observacoes || '-'}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    type="button"
                    onClick={() => excluirLiquidacao(l.id)}
                    disabled={!l.createdById}
                    title={!l.createdById ? 'Pagamento não pode ser excluído por aqui' : 'Excluir pagamento'}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-red-700 disabled:opacity-50 disabled:hover:text-slate-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {dados.liquidacoes.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>Nenhuma liquidação registrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
