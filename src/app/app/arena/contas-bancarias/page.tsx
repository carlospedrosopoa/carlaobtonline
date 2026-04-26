'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { contaBancariaService, fornecedorService, transferenciaFinanceiraService } from '@/services/gestaoArenaService';
import type { ContaBancaria, Fornecedor, MovimentacaoContaBancaria, TransferenciaFinanceira } from '@/types/gestaoArena';
import {
  Plus,
  Edit,
  Trash2,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';

type TipoFiltro = 'TODOS' | 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA';
type SortKey = 'data' | 'tipo' | 'conta' | 'origem' | 'fornecedor' | 'descricao' | 'valor';
type TipoLancamentoManual = 'ENTRADA' | 'SAIDA';

type LancamentoBancario =
  | {
      id: string;
      kind: 'MOVIMENTACAO';
      data: string;
      createdAt: string;
      tipo: 'ENTRADA' | 'SAIDA';
      valor: number;
      descricao: string;
      observacoes?: string | null;
      origem: string;
      contaBancariaId: string;
      contaNome: string;
      fornecedorNome?: string | null;
      transferenciaFinanceiraId?: string | null;
      liquidacaoContaPagarId?: string | null;
    }
  | {
      id: string;
      kind: 'TRANSFERENCIA';
      data: string;
      createdAt: string;
      tipo: 'TRANSFERENCIA';
      valor: number;
      descricao: string;
      observacoes?: string | null;
      origem: string;
      contaNome: string;
      origemContaBancariaId?: string | null;
      destinoContaBancariaId?: string | null;
      origemContaNome: string;
      destinoContaNome: string;
      fornecedorNome?: string | null;
    };

const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const hojeInput = () => new Date().toISOString().split('T')[0];
const inicioMesAtualInput = () => {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
};

const labelOrigemMovimentacao = (origem: string) => {
  if (origem === 'ESTORNO_PAGAMENTO_COMANDA') return 'Estorno Comanda';
  if (origem === 'PAGAMENTO_COMANDA') return 'Pagamento Comanda';
  if (origem === 'TRANSFERENCIA') return 'Transferência';
  if (origem === 'CONTA_PAGAR') return 'Conta a Pagar';
  if (origem === 'MANUAL') return 'Manual';
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

function normalizarData(value: string) {
  return String(value || '').slice(0, 10);
}

function dataDentroDoPeriodo(data: string, inicio: string, fim: string) {
  const valor = normalizarData(data);
  if (!valor) return false;
  if (inicio && valor < inicio) return false;
  if (fim && valor > fim) return false;
  return true;
}

export default function ContasBancariasPage() {
  const { usuario } = useAuth();
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Record<string, MovimentacaoContaBancaria[]>>({});
  const [transferencias, setTransferencias] = useState<TransferenciaFinanceira[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState(inicioMesAtualInput);
  const [dataFim, setDataFim] = useState(hojeInput);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('TODOS');
  const [contaFiltroId, setContaFiltroId] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({
    key: 'data',
    direction: 'desc',
  });

  const [modalConta, setModalConta] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [tipoLancamentoModal, setTipoLancamentoModal] = useState<TipoLancamentoManual | null>(null);
  const [contaEditando, setContaEditando] = useState<ContaBancaria | null>(null);

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
    contaBancariaId: '',
    valor: null as number | null,
    data: hojeInput(),
    descricao: '',
    observacoes: '',
    fornecedorId: '',
  });

  const [formTransferencia, setFormTransferencia] = useState({
    data: hojeInput(),
    valor: null as number | null,
    descricao: '',
    observacoes: '',
    origemTipo: 'CAIXA' as 'CAIXA' | 'CONTA_BANCARIA',
    origemContaBancariaId: '',
    destinoTipo: 'CONTA_BANCARIA' as 'CAIXA' | 'CONTA_BANCARIA',
    destinoContaBancariaId: '',
  });

  const contaPadraoId = useMemo(() => contas.find((conta) => conta.ativo)?.id || contas[0]?.id || '', [contas]);
  const contaFiltroAtiva = useMemo(() => contas.find((conta) => conta.id === contaFiltroId) || null, [contaFiltroId, contas]);
  const contaSelecionadaMovimentacao = useMemo(
    () => contas.find((conta) => conta.id === formMov.contaBancariaId) || null,
    [contas, formMov.contaBancariaId]
  );
  const contaEmFocoPodeExcluir = useMemo(() => {
    if (!contaFiltroAtiva) return false;
    return Math.abs(Number(contaFiltroAtiva.saldoAtual || 0)) < 0.005;
  }, [contaFiltroAtiva]);

  const carregar = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      setErro('');

      const [contasData, transferenciasData, fornecedoresData] = await Promise.all([
        contaBancariaService.listar(usuario.pointIdGestor),
        transferenciaFinanceiraService.listar({ pointId: usuario.pointIdGestor }),
        fornecedorService.listar(usuario.pointIdGestor, true),
      ]);

      const movimentacoesPorConta = await Promise.all(
        contasData.map(async (conta) => [conta.id, await contaBancariaService.listarMovimentacoes(conta.id)] as const)
      );

      setContas(contasData);
      setTransferencias(transferenciasData);
      setFornecedores(fornecedoresData);
      setMovimentacoes(Object.fromEntries(movimentacoesPorConta));
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar contas bancárias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [usuario?.pointIdGestor]);

  const totalSaldos = useMemo(() => contas.reduce((acc, conta) => acc + Number(conta.saldoAtual || 0), 0), [contas]);
  const contasAtivas = useMemo(() => contas.filter((conta) => conta.ativo).length, [contas]);

  const lancamentos = useMemo<LancamentoBancario[]>(() => {
    const movimentos = Object.entries(movimentacoes).flatMap(([contaId, itens]) => {
      const conta = contas.find((item) => item.id === contaId);
      const contaNome = conta?.nome || 'Conta bancária';

      return itens.map((mov) => ({
        id: mov.id,
        kind: 'MOVIMENTACAO' as const,
        data: mov.data,
        createdAt: mov.createdAt,
        tipo: mov.tipo as 'ENTRADA' | 'SAIDA',
        valor: Number(mov.valor || 0),
        descricao: mov.descricao,
        observacoes: mov.observacoes,
        origem: mov.origem,
        contaBancariaId: mov.contaBancariaId,
        contaNome,
        fornecedorNome: mov.fornecedorNome,
        transferenciaFinanceiraId: mov.transferenciaFinanceiraId,
        liquidacaoContaPagarId: mov.liquidacaoContaPagarId,
      }));
    });

    const itensTransferencia = transferencias.map((transf) => ({
      id: transf.id,
      kind: 'TRANSFERENCIA' as const,
      data: transf.data,
      createdAt: transf.data,
      tipo: 'TRANSFERENCIA' as const,
      valor: Number(transf.valor || 0),
      descricao: transf.descricao,
      observacoes: transf.observacoes,
      origem: 'TRANSFERENCIA',
      contaNome: `${transf.origemTipo === 'CAIXA' ? 'Caixa' : transf.origemContaBancariaNome || 'Conta bancária'} -> ${
        transf.destinoTipo === 'CAIXA' ? 'Caixa' : transf.destinoContaBancariaNome || 'Conta bancária'
      }`,
      origemContaBancariaId: transf.origemContaBancariaId,
      destinoContaBancariaId: transf.destinoContaBancariaId,
      origemContaNome: transf.origemTipo === 'CAIXA' ? 'Caixa' : transf.origemContaBancariaNome || 'Conta bancária',
      destinoContaNome: transf.destinoTipo === 'CAIXA' ? 'Caixa' : transf.destinoContaBancariaNome || 'Conta bancária',
      fornecedorNome: null,
    }));

    return [...movimentos, ...itensTransferencia];
  }, [contas, movimentacoes, transferencias]);

  const lancamentosFiltrados = useMemo(() => {
    const filtrados = lancamentos.filter((lancamento) => {
      if (contaFiltroId) {
        const pertenceConta =
          lancamento.kind === 'MOVIMENTACAO'
            ? lancamento.contaBancariaId === contaFiltroId
            : lancamento.origemContaBancariaId === contaFiltroId || lancamento.destinoContaBancariaId === contaFiltroId;

        if (!pertenceConta) {
          return false;
        }
      }

      if (!dataDentroDoPeriodo(lancamento.data, dataInicio, dataFim)) {
        return false;
      }

      if (tipoFiltro !== 'TODOS' && lancamento.tipo !== tipoFiltro) {
        return false;
      }

      const textoBusca = [
        lancamento.descricao,
        lancamento.observacoes || '',
        lancamento.contaNome,
        lancamento.fornecedorNome || '',
        labelOrigemMovimentacao(lancamento.origem),
        lancamento.kind === 'TRANSFERENCIA' ? lancamento.origemContaNome : '',
        lancamento.kind === 'TRANSFERENCIA' ? lancamento.destinoContaNome : '',
      ]
        .join(' ')
        .toLowerCase();

      return !busca.trim() || textoBusca.includes(busca.trim().toLowerCase());
    });

    if (!sortConfig) {
      return filtrados;
    }

    return [...filtrados].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      const getValue = (item: LancamentoBancario) => {
        switch (sortConfig.key) {
          case 'data':
            return `${normalizarData(item.data)} ${item.createdAt || ''}`;
          case 'tipo':
            return item.tipo;
          case 'conta':
            return item.contaNome;
          case 'origem':
            return labelOrigemMovimentacao(item.origem);
          case 'fornecedor':
            return item.fornecedorNome || '';
          case 'descricao':
            return item.descricao;
          case 'valor':
            return item.valor;
          default:
            return '';
        }
      };

      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue < bValue ? -1 * direction : aValue > bValue ? 1 * direction : 0;
      }

      const aTexto = String(aValue).toLowerCase();
      const bTexto = String(bValue).toLowerCase();
      return aTexto < bTexto ? -1 * direction : aTexto > bTexto ? 1 * direction : 0;
    });
  }, [busca, contaFiltroId, dataFim, dataInicio, lancamentos, sortConfig, tipoFiltro]);

  const totais = useMemo(() => {
    const entradas = lancamentosFiltrados
      .filter((lancamento) => lancamento.tipo === 'ENTRADA')
      .reduce((acc, lancamento) => acc + lancamento.valor, 0);
    const saidas = lancamentosFiltrados
      .filter((lancamento) => lancamento.tipo === 'SAIDA')
      .reduce((acc, lancamento) => acc + lancamento.valor, 0);
    const transferenciasPeriodo = lancamentosFiltrados
      .filter((lancamento) => lancamento.tipo === 'TRANSFERENCIA')
      .reduce((acc, lancamento) => acc + lancamento.valor, 0);

    return {
      entradas,
      saidas,
      saldoPeriodo: entradas - saidas,
      transferenciasPeriodo,
    };
  }, [lancamentosFiltrados]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400 ml-1 inline-block" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-4 h-4 text-emerald-600 ml-1 inline-block" />;
    }
    return <ArrowDown className="w-4 h-4 text-emerald-600 ml-1 inline-block" />;
  };

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
    if (Math.abs(Number(conta.saldoAtual || 0)) >= 0.005) {
      setErro('A conta so pode ser excluida quando o saldo estiver zerado');
      return;
    }
    if (!confirm(`Deseja remover a conta "${conta.nome}"?`)) return;

    try {
      setErro('');
      await contaBancariaService.deletar(conta.id);
      if (contaFiltroId === conta.id) {
        setContaFiltroId('');
      }
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao remover conta bancária');
    }
  };

  const abrirModalLancamento = (tipo: TipoLancamentoManual, contaBancariaId?: string) => {
    const contaSelecionadaId = contaBancariaId || contaFiltroId || contaPadraoId;
    if (!contaSelecionadaId) {
      setErro('Cadastre uma conta bancária antes de lançar movimentações');
      return;
    }

    setErro('');
    setTipoLancamentoModal(tipo);
    setFormMov({
      contaBancariaId: contaSelecionadaId,
      valor: null,
      data: hojeInput(),
      descricao: '',
      observacoes: '',
      fornecedorId: '',
    });
  };

  const fecharModalLancamento = () => {
    setTipoLancamentoModal(null);
  };

  const salvarMovimentacao = async () => {
    if (!tipoLancamentoModal) return;
    if (!formMov.contaBancariaId || !formMov.valor || formMov.valor <= 0 || !formMov.data || !formMov.descricao.trim()) {
      setErro('Preencha os dados da movimentação');
      return;
    }
    if (tipoLancamentoModal === 'SAIDA' && !formMov.fornecedorId) {
      setErro('Informe o fornecedor para a saída');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      await contaBancariaService.criarMovimentacao(formMov.contaBancariaId, {
        tipo: tipoLancamentoModal,
        valor: formMov.valor,
        data: formMov.data,
        descricao: formMov.descricao.trim(),
        observacoes: formMov.observacoes.trim() || undefined,
        fornecedorId: tipoLancamentoModal === 'SAIDA' ? formMov.fornecedorId || undefined : undefined,
      });

      fecharModalLancamento();
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao lançar movimentação');
    } finally {
      setSalvando(false);
    }
  };

  const abrirTransferencia = () => {
    setErro('');
    setFormTransferencia({
      data: hojeInput(),
      valor: null,
      descricao: '',
      observacoes: '',
      origemTipo: 'CAIXA',
      origemContaBancariaId: contaPadraoId,
      destinoTipo: 'CONTA_BANCARIA',
      destinoContaBancariaId: contaPadraoId,
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
        origemContaBancariaId:
          formTransferencia.origemTipo === 'CONTA_BANCARIA' ? formTransferencia.origemContaBancariaId : undefined,
        destinoTipo: formTransferencia.destinoTipo,
        destinoContaBancariaId:
          formTransferencia.destinoTipo === 'CONTA_BANCARIA' ? formTransferencia.destinoContaBancariaId : undefined,
      });

      setModalTransferencia(false);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar transferência');
    } finally {
      setSalvando(false);
    }
  };

  const podeExcluirLancamento = (lancamento: LancamentoBancario) =>
    lancamento.kind === 'MOVIMENTACAO' &&
    lancamento.origem === 'MANUAL' &&
    !lancamento.transferenciaFinanceiraId &&
    !lancamento.liquidacaoContaPagarId;

  const excluirMovimentacao = async (lancamento: LancamentoBancario) => {
    if (lancamento.kind !== 'MOVIMENTACAO') return;
    if (!confirm('Tem certeza que deseja excluir este lançamento manual?')) return;

    try {
      setErro('');
      await contaBancariaService.deletarMovimentacao(lancamento.contaBancariaId, lancamento.id);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir lançamento');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contas Bancárias</h1>
          <p className="text-gray-600 mt-1">Controle de entradas, saídas e transferências fora do caixa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => abrirModalLancamento('ENTRADA')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            Nova Entrada
          </button>
          <button
            onClick={() => abrirModalLancamento('SAIDA')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <TrendingDown className="w-5 h-5" />
            Nova Saída
          </button>
          <button
            onClick={abrirTransferencia}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <ArrowRightLeft className="w-5 h-5" />
            Transferir
          </button>
          <button
            onClick={abrirNovaConta}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Conta
          </button>
        </div>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="sticky top-2 z-20 bg-white/95 backdrop-blur rounded-xl border border-emerald-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Conta em foco</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="text-lg font-bold text-gray-900">
                {contaFiltroAtiva ? contaFiltroAtiva.nome : 'Todas as contas bancárias'}
              </div>
              <div className="text-sm text-gray-600">
                {contaFiltroAtiva
                  ? `${contaFiltroAtiva.banco || 'Banco não informado'}${contaFiltroAtiva.conta ? ` · Conta ${contaFiltroAtiva.conta}` : ''}`
                  : 'A consulta mostra o consolidado de todas as contas'}
              </div>
            </div>
            {contaFiltroAtiva && (
              <div className="text-sm font-medium text-emerald-700">
                Saldo atual: {formatarMoeda(Number(contaFiltroAtiva.saldoAtual || 0))}
              </div>
            )}
            {contaFiltroAtiva && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => abrirEditarConta(contaFiltroAtiva)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Editar Conta
                </button>
                {contaEmFocoPodeExcluir && (
                  <button
                    onClick={() => deletarConta(contaFiltroAtiva)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Conta
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="w-full lg:w-80">
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta consultada</label>
            <select
              value={contaFiltroId}
              onChange={(e) => setContaFiltroId(e.target.value)}
              className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              <option value="">Todas as contas</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-semibold text-emerald-800">Movimentações Bancárias</span>
            </div>
            <p className="text-sm text-gray-600">
              Consulta {contaFiltroAtiva ? `da conta ${contaFiltroAtiva.nome}` : 'consolidada das contas bancárias'} no período de{' '}
              {formatarDataPtBr(dataInicio)} até {formatarDataPtBr(dataFim)}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
            <div>
              <p className="text-xs text-gray-600">Saldo Consolidado</p>
              <p className="text-lg font-bold text-gray-900">{formatarMoeda(totalSaldos)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Contas Ativas</p>
              <p className="text-lg font-bold text-emerald-700">{contasAtivas}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Entradas no Período</p>
              <p className="text-lg font-bold text-green-600">{formatarMoeda(totais.entradas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Saídas no Período</p>
              <p className="text-lg font-bold text-red-600">{formatarMoeda(totais.saidas)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Entradas</p>
              <p className="text-2xl font-bold text-green-600">{formatarMoeda(totais.entradas)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Saídas</p>
              <p className="text-2xl font-bold text-red-600">{formatarMoeda(totais.saidas)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo do Período</p>
              <p className={`text-2xl font-bold ${totais.saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(totais.saldoPeriodo)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Transferências: {formatarMoeda(totais.transferenciasPeriodo)}</p>
            </div>
            <DollarSign className={`w-8 h-8 ${totais.saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar lançamentos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="TODOS">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
              <option value="TRANSFERENCIA">Transferências</option>
            </select>
            <button
              onClick={() => setContaFiltroId('')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Ver todas
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('data')}
                >
                  Data {getSortIcon('data')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('tipo')}
                >
                  Tipo {getSortIcon('tipo')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('conta')}
                >
                  Conta / Fluxo {getSortIcon('conta')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('origem')}
                >
                  Origem {getSortIcon('origem')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('fornecedor')}
                >
                  Fornecedor {getSortIcon('fornecedor')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('descricao')}
                >
                  Descrição {getSortIcon('descricao')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => requestSort('valor')}
                >
                  Valor {getSortIcon('valor')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentosFiltrados.map((lancamento) => (
                <tr key={`${lancamento.kind}-${lancamento.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatarDataPtBr(lancamento.data)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lancamento.tipo === 'ENTRADA' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Entrada</span>
                    )}
                    {lancamento.tipo === 'SAIDA' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Saída</span>
                    )}
                    {lancamento.tipo === 'TRANSFERENCIA' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Transferência</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {lancamento.kind === 'TRANSFERENCIA' ? (
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">{lancamento.origemContaNome}</div>
                        <div className="text-gray-500">{lancamento.destinoContaNome}</div>
                      </div>
                    ) : (
                      <span>{lancamento.contaNome}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        lancamento.origem === 'MANUAL'
                          ? 'bg-gray-100 text-gray-700'
                          : lancamento.origem === 'PAGAMENTO_COMANDA'
                            ? 'bg-blue-100 text-blue-700'
                            : lancamento.origem === 'ESTORNO_PAGAMENTO_COMANDA'
                              ? 'bg-amber-100 text-amber-700'
                              : lancamento.origem === 'CONTA_PAGAR'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {labelOrigemMovimentacao(lancamento.origem)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lancamento.fornecedorNome || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>{lancamento.descricao}</div>
                    {lancamento.observacoes && <div className="text-xs text-gray-500 mt-1">{lancamento.observacoes}</div>}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      lancamento.tipo === 'SAIDA'
                        ? 'text-red-600'
                        : lancamento.tipo === 'TRANSFERENCIA'
                          ? 'text-purple-700'
                          : 'text-green-600'
                    }`}
                  >
                    {lancamento.tipo === 'SAIDA' ? '-' : lancamento.tipo === 'TRANSFERENCIA' ? '↔' : '+'}
                    {formatarMoeda(lancamento.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {podeExcluirLancamento(lancamento) && (
                      <button
                        onClick={() => excluirMovimentacao(lancamento)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir lançamento manual"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lancamentosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum lançamento encontrado</p>
          </div>
        )}
      </div>

      {contas.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
          Nenhuma conta bancária cadastrada
        </div>
      )}

      {modalConta && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{contaEditando ? 'Editar conta bancária' : 'Nova conta bancária'}</h2>
              <button onClick={() => setModalConta(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
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
                <select value={formConta.tipo} onChange={(e) => setFormConta((p) => ({ ...p, tipo: e.target.value as typeof formConta.tipo }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
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

      {tipoLancamentoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{tipoLancamentoModal === 'ENTRADA' ? 'Nova Entrada' : 'Nova Saída'}</h2>
              <button onClick={fecharModalLancamento} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {contaSelecionadaMovimentacao && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Conta selecionada para o lançamento</p>
                  <div className="mt-1 text-lg font-bold text-gray-900">{contaSelecionadaMovimentacao.nome}</div>
                  <div className="text-sm text-gray-600">
                    {contaSelecionadaMovimentacao.banco || 'Banco não informado'}
                    {contaSelecionadaMovimentacao.conta ? ` · Conta ${contaSelecionadaMovimentacao.conta}` : ''}
                  </div>
                  <div className="text-sm font-medium text-emerald-700 mt-1">
                    Saldo atual: {formatarMoeda(Number(contaSelecionadaMovimentacao.saldoAtual || 0))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conta bancária *</label>
                <select
                  value={formMov.contaBancariaId}
                  onChange={(e) => setFormMov((prev) => ({ ...prev, contaBancariaId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  value={formMov.data}
                  onChange={(e) => setFormMov((prev) => ({ ...prev, data: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <InputMonetario value={formMov.valor} onChange={(v) => setFormMov((prev) => ({ ...prev, valor: v }))} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  value={formMov.descricao}
                  onChange={(e) => setFormMov((prev) => ({ ...prev, descricao: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {tipoLancamentoModal === 'SAIDA' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor *</label>
                  <select
                    value={formMov.fornecedorId}
                    onChange={(e) => setFormMov((prev) => ({ ...prev, fornecedorId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Selecione</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formMov.observacoes}
                  onChange={(e) => setFormMov((prev) => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={fecharModalLancamento} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvarMovimentacao} disabled={salvando} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTransferencia && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Nova Transferência</h2>
              <button onClick={() => setModalTransferencia(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
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
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
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
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
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
