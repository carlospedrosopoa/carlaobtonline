'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaBancariaService, fornecedorService, transferenciaFinanceiraService } from '@/services/gestaoArenaService';
import type { ContaBancaria, Fornecedor, MovimentacaoContaBancaria, TransferenciaFinanceira } from '@/types/gestaoArena';
import { Plus, Landmark, ArrowDownCircle, ArrowUpCircle, Edit, Trash2, ArrowRightLeft } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const labelOrigemMovimentacao = (origem: string) => {
  if (origem === 'ESTORNO_PAGAMENTO_COMANDA') return 'Estorno Comanda';
  if (origem === 'PAGAMENTO_COMANDA') return 'Pagamento Comanda';
  if (origem === 'TRANSFERENCIA') return 'Transferência';
  if (origem === 'CONTA_PAGAR') return 'Conta a Pagar';
  return origem;
};

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

export default function ContasBancariasPage() {
  const { usuario } = useAuth();
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Record<string, MovimentacaoContaBancaria[]>>({});
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modalConta, setModalConta] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaBancaria | null>(null);
  const [modalMov, setModalMov] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [contaMov, setContaMov] = useState<ContaBancaria | null>(null);
  const [transferencias, setTransferencias] = useState<TransferenciaFinanceira[]>([]);
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const [formConta, setFormConta] = useState({
    nome: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo: 'CONTA_CORRENTE' as 'CONTA_CORRENTE' | 'CONTA_POUPANCA' | 'CARTEIRA' | 'OUTRO',
    saldoInicial: null as number | null,
    ativo: true,
  });

  const [formMov, setFormMov] = useState({
    tipo: 'ENTRADA' as 'ENTRADA' | 'SAIDA',
    valor: null as number | null,
    data: hojeStr,
    descricao: '',
    observacoes: '',
    fornecedorId: '',
  });

  const [formTransferencia, setFormTransferencia] = useState({
    data: hojeStr,
    valor: null as number | null,
    descricao: '',
    observacoes: '',
    origemTipo: 'CAIXA' as 'CAIXA' | 'CONTA_BANCARIA',
    origemContaBancariaId: '',
    destinoTipo: 'CONTA_BANCARIA' as 'CAIXA' | 'CONTA_BANCARIA',
    destinoContaBancariaId: '',
  });

  const carregar = async () => {
    if (!usuario?.pointIdGestor) return;
    try {
      setLoading(true);
      setErro('');
      const [data, transf, forn] = await Promise.all([
        contaBancariaService.listar(usuario.pointIdGestor),
        transferenciaFinanceiraService.listar({ pointId: usuario.pointIdGestor }),
        fornecedorService.listar(usuario.pointIdGestor, true),
      ]);
      setContas(data);
      setTransferencias(transf);
      setFornecedores(forn);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar contas bancárias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [usuario?.pointIdGestor]);

  const totalSaldos = useMemo(() => contas.reduce((acc, c) => acc + Number(c.saldoAtual || 0), 0), [contas]);

  const abrirNovaConta = () => {
    setContaEditando(null);
    setFormConta({
      nome: '',
      banco: '',
      agencia: '',
      conta: '',
      tipo: 'CONTA_CORRENTE',
      saldoInicial: null,
      ativo: true,
    });
    setModalConta(true);
  };

  const abrirEditarConta = (conta: ContaBancaria) => {
    setContaEditando(conta);
    setFormConta({
      nome: conta.nome,
      banco: conta.banco || '',
      agencia: conta.agencia || '',
      conta: conta.conta || '',
      tipo: conta.tipo,
      saldoInicial: Number(conta.saldoInicial || 0),
      ativo: !!conta.ativo,
    });
    setModalConta(true);
  };

  const salvarConta = async () => {
    if (!usuario?.pointIdGestor) return;
    if (!formConta.nome.trim()) {
      setErro('Informe o nome da conta bancária');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      if (contaEditando) {
        await contaBancariaService.atualizar(contaEditando.id, {
          nome: formConta.nome,
          banco: formConta.banco || undefined,
          agencia: formConta.agencia || undefined,
          conta: formConta.conta || undefined,
          tipo: formConta.tipo,
          saldoInicial: formConta.saldoInicial || 0,
          ativo: formConta.ativo,
        });
      } else {
        await contaBancariaService.criar({
          pointId: usuario.pointIdGestor,
          nome: formConta.nome,
          banco: formConta.banco || undefined,
          agencia: formConta.agencia || undefined,
          conta: formConta.conta || undefined,
          tipo: formConta.tipo,
          saldoInicial: formConta.saldoInicial || 0,
          ativo: formConta.ativo,
        });
      }
      setModalConta(false);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar conta bancária');
    } finally {
      setSalvando(false);
    }
  };

  const deletarConta = async (conta: ContaBancaria) => {
    if (!confirm(`Deseja remover a conta "${conta.nome}"?`)) return;
    try {
      await contaBancariaService.deletar(conta.id);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao remover conta bancária');
    }
  };

  const abrirMovimentacoes = async (conta: ContaBancaria) => {
    setContaMov(conta);
    setFormMov({
      tipo: 'ENTRADA',
      valor: null,
      data: hojeStr,
      descricao: '',
      observacoes: '',
      fornecedorId: '',
    });
    setModalMov(true);
    try {
      const data = await contaBancariaService.listarMovimentacoes(conta.id);
      setMovimentacoes((prev) => ({ ...prev, [conta.id]: data }));
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar movimentações');
    }
  };

  const salvarMovimentacao = async () => {
    if (!contaMov || !formMov.valor || formMov.valor <= 0 || !formMov.data || !formMov.descricao.trim()) {
      setErro('Preencha os dados da movimentação');
      return;
    }
    if (formMov.tipo === 'SAIDA' && !formMov.fornecedorId) {
      setErro('Informe o fornecedor para a saída');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      await contaBancariaService.criarMovimentacao(contaMov.id, {
        tipo: formMov.tipo,
        valor: formMov.valor,
        data: formMov.data,
        descricao: formMov.descricao.trim(),
        observacoes: formMov.observacoes.trim() || undefined,
        fornecedorId: formMov.fornecedorId || undefined,
      });
      const data = await contaBancariaService.listarMovimentacoes(contaMov.id);
      setMovimentacoes((prev) => ({ ...prev, [contaMov.id]: data }));
      await carregar();
      setFormMov((prev) => ({ ...prev, valor: null, descricao: '', observacoes: '', fornecedorId: '' }));
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao lançar movimentação');
    } finally {
      setSalvando(false);
    }
  };

  const abrirTransferencia = () => {
    setFormTransferencia({
      data: hojeStr,
      valor: null,
      descricao: '',
      observacoes: '',
      origemTipo: 'CAIXA',
      origemContaBancariaId: contas[0]?.id || '',
      destinoTipo: 'CONTA_BANCARIA',
      destinoContaBancariaId: contas[0]?.id || '',
    });
    setModalTransferencia(true);
  };

  const salvarTransferencia = async () => {
    if (!usuario?.pointIdGestor) return;
    if (!formTransferencia.data || !formTransferencia.valor || formTransferencia.valor <= 0 || !formTransferencia.descricao.trim()) {
      setErro('Preencha data, valor e descrição da transferência');
      return;
    }
    if (formTransferencia.origemTipo === 'CONTA_BANCARIA' && !formTransferencia.origemContaBancariaId) {
      setErro('Selecione conta bancária de origem');
      return;
    }
    if (formTransferencia.destinoTipo === 'CONTA_BANCARIA' && !formTransferencia.destinoContaBancariaId) {
      setErro('Selecione conta bancária de destino');
      return;
    }
    if (
      formTransferencia.origemTipo === 'CONTA_BANCARIA' &&
      formTransferencia.destinoTipo === 'CONTA_BANCARIA' &&
      formTransferencia.origemContaBancariaId === formTransferencia.destinoContaBancariaId
    ) {
      setErro('Origem e destino bancários devem ser diferentes');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      await transferenciaFinanceiraService.criar({
        pointId: usuario.pointIdGestor,
        data: formTransferencia.data,
        valor: formTransferencia.valor,
        descricao: formTransferencia.descricao.trim(),
        observacoes: formTransferencia.observacoes.trim() || undefined,
        origemTipo: formTransferencia.origemTipo,
        origemContaBancariaId: formTransferencia.origemTipo === 'CONTA_BANCARIA' ? formTransferencia.origemContaBancariaId : undefined,
        destinoTipo: formTransferencia.destinoTipo,
        destinoContaBancariaId: formTransferencia.destinoTipo === 'CONTA_BANCARIA' ? formTransferencia.destinoContaBancariaId : undefined,
      });
      const transf = await transferenciaFinanceiraService.listar({ pointId: usuario.pointIdGestor });
      setTransferencias(transf);
      await carregar();
      setModalTransferencia(false);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar transferência');
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
          <h1 className="text-3xl font-bold text-gray-900">Contas Bancárias</h1>
          <p className="text-gray-600 mt-1">Controle saldos e movimentações fora do caixa</p>
        </div>
        <div className="flex gap-2">
        <button onClick={abrirTransferencia} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50">
          <ArrowRightLeft className="w-4 h-4" />
          Transferir
        </button>
        <button onClick={abrirNovaConta} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
        </div>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Saldo consolidado em contas bancárias</div>
        <div className="text-2xl font-bold text-gray-900">{formatarMoeda(totalSaldos)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contas.map((conta) => (
          <div key={conta.id} className="bg-white rounded-lg shadow p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-gray-900 font-semibold">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  {conta.nome}
                </div>
                <div className="text-sm text-gray-500 mt-1">{conta.banco || 'Banco não informado'}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${conta.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {conta.ativo ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {conta.agencia ? `Ag ${conta.agencia}` : 'Agência -'} · {conta.conta || 'Conta -'}
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatarMoeda(Number(conta.saldoAtual || 0))}</div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => abrirMovimentacoes(conta)} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">
                Movimentações
              </button>
              <button onClick={() => abrirEditarConta(conta)} className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => deletarConta(conta)} className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {contas.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
          Nenhuma conta bancária cadastrada
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Origem</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Destino</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descrição</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transferencias.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="px-4 py-3 text-sm text-gray-700">{formatarDataPtBr(t.data)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{t.origemTipo === 'CAIXA' ? 'Caixa' : (t.origemContaBancariaNome || 'Conta bancária')}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{t.destinoTipo === 'CAIXA' ? 'Caixa' : (t.destinoContaBancariaNome || 'Conta bancária')}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{t.descricao}</td>
                <td className="px-4 py-3 text-sm text-right text-purple-700 font-medium">↔ {formatarMoeda(Number(t.valor))}</td>
              </tr>
            ))}
            {transferencias.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>Nenhuma transferência registrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalConta && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{contaEditando ? 'Editar conta bancária' : 'Nova conta bancária'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Nome</label>
                <input value={formConta.nome} onChange={(e) => setFormConta((p) => ({ ...p, nome: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Banco</label>
                <input value={formConta.banco} onChange={(e) => setFormConta((p) => ({ ...p, banco: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <select value={formConta.tipo} onChange={(e) => setFormConta((p) => ({ ...p, tipo: e.target.value as any }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="CONTA_CORRENTE">Conta Corrente</option>
                  <option value="CONTA_POUPANCA">Conta Poupança</option>
                  <option value="CARTEIRA">Carteira</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Agência</label>
                <input value={formConta.agencia} onChange={(e) => setFormConta((p) => ({ ...p, agencia: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Conta</label>
                <input value={formConta.conta} onChange={(e) => setFormConta((p) => ({ ...p, conta: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Saldo inicial</label>
                <InputMonetario value={formConta.saldoInicial} onChange={(v) => setFormConta((p) => ({ ...p, saldoInicial: v }))} placeholder="0,00" />
              </div>
              <div className="flex items-center gap-2 mt-7">
                <input type="checkbox" checked={formConta.ativo} onChange={(e) => setFormConta((p) => ({ ...p, ativo: e.target.checked }))} />
                <span className="text-sm text-gray-700">Conta ativa</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalConta(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarConta} disabled={salvando} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMov && contaMov && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Movimentações · {contaMov.nome}</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <select value={formMov.tipo} onChange={(e) => setFormMov((p) => ({ ...p, tipo: e.target.value as 'ENTRADA' | 'SAIDA' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Data</label>
                <input type="date" value={formMov.data} onChange={(e) => setFormMov((p) => ({ ...p, data: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Valor</label>
                <InputMonetario value={formMov.valor} onChange={(v) => setFormMov((p) => ({ ...p, valor: v }))} placeholder="0,00" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <input value={formMov.descricao} onChange={(e) => setFormMov((p) => ({ ...p, descricao: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Fornecedor</label>
                <select
                  value={formMov.fornecedorId}
                  onChange={(e) => setFormMov((p) => ({ ...p, fornecedorId: e.target.value }))}
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
              <div className="md:col-span-4">
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <input value={formMov.observacoes} onChange={(e) => setFormMov((p) => ({ ...p, observacoes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div className="flex items-end">
                <button onClick={salvarMovimentacao} disabled={salvando} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Lançar'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Origem</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descrição</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(movimentacoes[contaMov.id] || []).map((mov) => (
                    <tr key={mov.id} className="border-b">
                      <td className="px-4 py-3 text-sm text-gray-700">{formatarDataPtBr(mov.data)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-1 ${mov.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>
                          {mov.tipo === 'ENTRADA' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${mov.origem === 'ESTORNO_PAGAMENTO_COMANDA' ? 'bg-amber-100 text-amber-700' : mov.origem === 'PAGAMENTO_COMANDA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {labelOrigemMovimentacao(mov.origem)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{mov.fornecedorNome || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{mov.descricao}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${mov.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>
                        {formatarMoeda(Number(mov.valor) * (mov.tipo === 'ENTRADA' ? 1 : -1))}
                      </td>
                    </tr>
                  ))}
                  {(movimentacoes[contaMov.id] || []).length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>Nenhuma movimentação encontrada</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModalMov(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {modalTransferencia && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Nova Transferência</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Data</label>
                <input type="date" value={formTransferencia.data} onChange={(e) => setFormTransferencia((p) => ({ ...p, data: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Valor</label>
                <InputMonetario value={formTransferencia.valor} onChange={(v) => setFormTransferencia((p) => ({ ...p, valor: v }))} placeholder="0,00" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <input value={formTransferencia.descricao} onChange={(e) => setFormTransferencia((p) => ({ ...p, descricao: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Origem</label>
                <select value={formTransferencia.origemTipo} onChange={(e) => setFormTransferencia((p) => ({ ...p, origemTipo: e.target.value as 'CAIXA' | 'CONTA_BANCARIA' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="CAIXA">Caixa</option>
                  <option value="CONTA_BANCARIA">Conta bancária</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Conta origem</label>
                <select disabled={formTransferencia.origemTipo !== 'CONTA_BANCARIA'} value={formTransferencia.origemContaBancariaId} onChange={(e) => setFormTransferencia((p) => ({ ...p, origemContaBancariaId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100">
                  <option value="">Selecione</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Destino</label>
                <select value={formTransferencia.destinoTipo} onChange={(e) => setFormTransferencia((p) => ({ ...p, destinoTipo: e.target.value as 'CAIXA' | 'CONTA_BANCARIA' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
                  <option value="CAIXA">Caixa</option>
                  <option value="CONTA_BANCARIA">Conta bancária</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Conta destino</label>
                <select disabled={formTransferencia.destinoTipo !== 'CONTA_BANCARIA'} value={formTransferencia.destinoContaBancariaId} onChange={(e) => setFormTransferencia((p) => ({ ...p, destinoContaBancariaId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100">
                  <option value="">Selecione</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <input value={formTransferencia.observacoes} onChange={(e) => setFormTransferencia((p) => ({ ...p, observacoes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalTransferencia(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarTransferencia} disabled={salvando} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar transferência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
