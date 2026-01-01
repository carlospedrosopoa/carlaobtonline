// app/app/arena/fluxo-caixa/page.tsx - Fluxo de Caixa
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fluxoCaixaService, entradaCaixaService, saidaCaixaService, formaPagamentoService, centroCustoService, tipoDespesaService, fornecedorService, aberturaCaixaService } from '@/services/gestaoArenaService';
import type { LancamentoFluxoCaixa } from '@/types/gestaoArena';
import type { FormaPagamento, CentroCusto, TipoDespesa, Fornecedor, CriarEntradaCaixaPayload, CriarSaidaCaixaPayload, AberturaCaixa, CriarAberturaCaixaPayload } from '@/types/gestaoArena';
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, Calendar, Filter, X, Trash2 } from 'lucide-react';
import CurrencyInput from '@/components/CurrencyInput';

export default function FluxoCaixaPage() {
  const { usuario } = useAuth();
  const [lancamentos, setLancamentos] = useState<LancamentoFluxoCaixa[]>([]);
  const [aberturaAtual, setAberturaAtual] = useState<AberturaCaixa | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return primeiroDiaMes.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'ENTRADA' | 'SAIDA'>('TODOS');
  const [busca, setBusca] = useState('');
  
  // Dados para modais
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  
  // Estados dos modais
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [modalAbrirCaixaAberto, setModalAbrirCaixaAberto] = useState(false);
  const [modalFecharCaixaAberto, setModalFecharCaixaAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  
  // Formulário de abertura de caixa
  const [formAbrirCaixa, setFormAbrirCaixa] = useState<CriarAberturaCaixaPayload>({
    pointId: '',
    saldoInicial: 0,
    observacoes: '',
  });
  
  // Formulário de fechamento de caixa
  const [saldoFinalInformado, setSaldoFinalInformado] = useState<number | undefined>(undefined);
  const [observacoesFechamento, setObservacoesFechamento] = useState('');
  
  // Formulários
  const [formEntrada, setFormEntrada] = useState<CriarEntradaCaixaPayload>({
    pointId: '',
    valor: 0,
    descricao: '',
    formaPagamentoId: '',
    observacoes: '',
    dataEntrada: new Date().toISOString().split('T')[0],
  });
  
  const [formSaida, setFormSaida] = useState<CriarSaidaCaixaPayload>({
    pointId: '',
    valor: 0,
    descricao: '',
    fornecedorId: '',
    categoriaSaidaId: '',
    tipoDespesaId: '',
    centroCustoId: '',
    formaPagamentoId: '',
    observacoes: '',
    dataSaida: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      setFormEntrada((prev) => ({ ...prev, pointId: usuario.pointIdGestor! }));
      setFormSaida((prev) => ({ ...prev, pointId: usuario.pointIdGestor! }));
      carregarDados();
    }
  }, [usuario?.pointIdGestor, dataInicio, dataFim, tipoFiltro]);

  const carregarDados = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      
      // Carregar abertura de caixa aberta atual
      const aberturasAbertas = await aberturaCaixaService.listar(
        usuario.pointIdGestor,
        'ABERTA'
      );
      const abertura = aberturasAbertas.length > 0 ? aberturasAbertas[0] : null;
      setAberturaAtual(abertura);
      
      // Carregar lançamentos (filtrar por abertura se existir)
      const lancamentosData = await fluxoCaixaService.listar(
        usuario.pointIdGestor,
        abertura?.id,
        dataInicio,
        dataFim,
        tipoFiltro === 'TODOS' ? undefined : tipoFiltro
      );
      setLancamentos(lancamentosData);
      
      // Carregar dados auxiliares
      const [formasData, centrosData, tiposData, fornecedoresData] = await Promise.all([
        formaPagamentoService.listar(usuario.pointIdGestor, true),
        centroCustoService.listar(usuario.pointIdGestor, true),
        tipoDespesaService.listar(usuario.pointIdGestor, true),
        fornecedorService.listar(usuario.pointIdGestor, true),
      ]);
      
      setFormasPagamento(formasData);
      setCentrosCusto(centrosData);
      setTiposDespesa(tiposData);
      setFornecedores(fornecedoresData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAbrirCaixa = () => {
    setFormAbrirCaixa({
      pointId: usuario?.pointIdGestor || '',
      saldoInicial: 0,
      observacoes: '',
    });
    setErro('');
    setModalAbrirCaixaAberto(true);
  };

  const fecharModalAbrirCaixa = () => {
    setModalAbrirCaixaAberto(false);
    setErro('');
  };

  const abrirModalFecharCaixa = () => {
    if (!aberturaAtual) return;
    setSaldoFinalInformado(aberturaAtual.saldoAtual);
    setObservacoesFechamento('');
    setErro('');
    setModalFecharCaixaAberto(true);
  };

  const fecharModalFecharCaixa = () => {
    setModalFecharCaixaAberto(false);
    setErro('');
  };

  const salvarAbrirCaixa = async () => {
    if (!formAbrirCaixa.pointId) {
      setErro('PointId é obrigatório');
      return;
    }
    if (formAbrirCaixa.saldoInicial === undefined || formAbrirCaixa.saldoInicial === null) {
      setErro('Saldo inicial é obrigatório');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      await aberturaCaixaService.criar(formAbrirCaixa);
      await carregarDados();
      fecharModalAbrirCaixa();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao abrir caixa');
    } finally {
      setSalvando(false);
    }
  };

  const salvarFecharCaixa = async () => {
    if (!aberturaAtual) return;

    try {
      setSalvando(true);
      setErro('');
      await aberturaCaixaService.fechar(aberturaAtual.id, {
        saldoFinal: saldoFinalInformado,
        observacoes: observacoesFechamento,
      });
      await carregarDados();
      fecharModalFecharCaixa();
    } catch (error: any) {
      const mensagemErro = error?.response?.data?.mensagem || 
                           error?.response?.data?.detail || 
                           error?.response?.data?.error || 
                           error?.message || 
                           'Erro ao fechar caixa';
      console.error('Erro ao fechar caixa:', error?.response?.data);
      setErro(mensagemErro);
    } finally {
      setSalvando(false);
    }
  };

  const excluirLancamento = async (id: string, tipo: 'ENTRADA_MANUAL' | 'ENTRADA_CARD' | 'SAIDA') => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
      return;
    }

    try {
      setErro('');
      if (tipo === 'ENTRADA_MANUAL') {
        await entradaCaixaService.deletar(id);
      } else if (tipo === 'SAIDA') {
        await saidaCaixaService.deletar(id);
      } else {
        setErro('Não é possível excluir este tipo de lançamento');
        return;
      }
      await carregarDados();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir lançamento');
    }
  };

  const abrirModalEntrada = () => {
    if (!aberturaAtual) {
      setErro('É necessário abrir o caixa antes de criar entradas');
      return;
    }
    setFormEntrada({
      pointId: usuario?.pointIdGestor || '',
      valor: 0,
      descricao: '',
      formaPagamentoId: '',
      observacoes: '',
      dataEntrada: new Date().toISOString().split('T')[0],
    });
    setErro('');
    setModalEntradaAberto(true);
  };

  const abrirModalSaida = () => {
    if (!aberturaAtual) {
      setErro('É necessário abrir o caixa antes de criar saídas');
      return;
    }
    setFormSaida({
      pointId: usuario?.pointIdGestor || '',
      valor: 0,
      descricao: '',
      fornecedorId: '',
      categoriaSaidaId: '',
      tipoDespesaId: '',
      centroCustoId: '',
      formaPagamentoId: '',
      observacoes: '',
      dataSaida: new Date().toISOString().split('T')[0],
    });
    setErro('');
    setModalSaidaAberto(true);
  };

  const fecharModalEntrada = () => {
    setModalEntradaAberto(false);
    setErro('');
  };

  const fecharModalSaida = () => {
    setModalSaidaAberto(false);
    setErro('');
  };

  const salvarEntrada = async () => {
    if (!formEntrada.valor || formEntrada.valor <= 0) {
      setErro('Valor deve ser maior que zero');
      return;
    }
    if (!formEntrada.descricao) {
      setErro('Descrição é obrigatória');
      return;
    }
    if (!formEntrada.formaPagamentoId) {
      setErro('Forma de pagamento é obrigatória');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      await entradaCaixaService.criar(formEntrada);
      await carregarDados();
      fecharModalEntrada();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar entrada');
    } finally {
      setSalvando(false);
    }
  };

  const salvarSaida = async () => {
    if (!formSaida.valor || formSaida.valor <= 0) {
      setErro('Valor deve ser maior que zero');
      return;
    }
    if (!formSaida.descricao) {
      setErro('Descrição é obrigatória');
      return;
    }
    if (!formSaida.centroCustoId) {
      setErro('Centro de custo é obrigatório');
      return;
    }
    if (!formSaida.formaPagamentoId) {
      setErro('Forma de pagamento é obrigatória');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      await saidaCaixaService.criar(formSaida);
      await carregarDados();
      fecharModalSaida();
    } catch (error: any) {
      const mensagemErro = error?.response?.data?.mensagem || error?.response?.data?.detail || error?.message || 'Erro ao salvar saída';
      console.error('Erro ao salvar saída:', error?.response?.data);
      setErro(mensagemErro);
    } finally {
      setSalvando(false);
    }
  };

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((lancamento) => {
      const matchBusca = busca === '' || 
        lancamento.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        lancamento.observacoes?.toLowerCase().includes(busca.toLowerCase());
      return matchBusca;
    });
  }, [lancamentos, busca]);

  const totais = useMemo(() => {
    const entradas = lancamentosFiltrados
      .filter((l) => l.tipo === 'ENTRADA_MANUAL' || l.tipo === 'ENTRADA_CARD')
      .reduce((sum, l) => sum + l.valor, 0);
    const saidas = lancamentosFiltrados
      .filter((l) => l.tipo === 'SAIDA')
      .reduce((sum, l) => sum + l.valor, 0);
    const saldoMovimentacao = entradas - saidas;
    const saldoAtual = aberturaAtual 
      ? aberturaAtual.saldoInicial + saldoMovimentacao 
      : saldoMovimentacao;
    return {
      entradas,
      saidas,
      saldo: saldoMovimentacao,
      saldoAtual,
    };
  }, [lancamentosFiltrados, aberturaAtual]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    try {
      // Se a data já vem como ISO string completa, usar diretamente
      if (data.includes('T')) {
        return new Date(data).toLocaleDateString('pt-BR');
      }
      // Se vem apenas como data (YYYY-MM-DD), adicionar hora
      if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
      }
      // Tentar parsear diretamente
      const parsed = new Date(data);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('pt-BR');
      }
      return data; // Retornar como está se não conseguir parsear
    } catch (error) {
      console.error('Erro ao formatar data:', data, error);
      return data;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando fluxo de caixa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fluxo de Caixa</h1>
          <p className="text-gray-600 mt-1">Controle de entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          {aberturaAtual ? (
            <>
              <button
                onClick={abrirModalEntrada}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <TrendingUp className="w-5 h-5" />
                Nova Entrada
              </button>
              <button
                onClick={abrirModalSaida}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <TrendingDown className="w-5 h-5" />
                Nova Saída
              </button>
              <button
                onClick={abrirModalFecharCaixa}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <X className="w-5 h-5" />
                Fechar Caixa
              </button>
            </>
          ) : (
            <button
              onClick={abrirModalAbrirCaixa}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <DollarSign className="w-5 h-5" />
              Abrir Caixa
            </button>
          )}
        </div>
      </div>

      {/* Status da Abertura de Caixa */}
      {aberturaAtual ? (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-emerald-800">Caixa Aberto</span>
              </div>
              <p className="text-sm text-gray-600">
                Aberto em {formatarData(aberturaAtual.dataAbertura)}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
              <div>
                <p className="text-xs text-gray-600">Saldo Inicial</p>
                <p className="text-lg font-bold text-gray-900">{formatarMoeda(aberturaAtual.saldoInicial)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Entradas</p>
                <p className="text-lg font-bold text-green-600">{formatarMoeda(aberturaAtual.totalEntradas || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Saídas</p>
                <p className="text-lg font-bold text-red-600">{formatarMoeda(aberturaAtual.totalSaidas || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Saldo Atual</p>
                <p className={`text-lg font-bold ${(aberturaAtual.saldoAtual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarMoeda(aberturaAtual.saldoAtual || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div>
              <p className="font-semibold text-yellow-800">Caixa Fechado</p>
              <p className="text-sm text-yellow-700">É necessário abrir o caixa para registrar movimentações</p>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
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
              <p className="text-sm text-gray-600">Saldo Atual</p>
              <p className={`text-2xl font-bold ${totais.saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(totais.saldoAtual)}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totais.saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar lançamentos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
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
              onChange={(e) => setTipoFiltro(e.target.value as 'TODOS' | 'ENTRADA' | 'SAIDA')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="TODOS">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Lançamentos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Forma Pagamento
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Centro Custo / Tipo
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado por
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentosFiltrados.map((lancamento) => (
                <tr key={lancamento.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatarData(lancamento.data)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lancamento.tipo === 'ENTRADA_MANUAL' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Entrada Manual
                      </span>
                    )}
                    {lancamento.tipo === 'ENTRADA_CARD' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        Pagamento Card #{lancamento.numeroCard}
                      </span>
                    )}
                    {lancamento.tipo === 'SAIDA' && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Saída
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>{lancamento.descricao}</div>
                    {lancamento.observacoes && (
                      <div className="text-xs text-gray-500 mt-1">{lancamento.observacoes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {lancamento.formaPagamento?.nome || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {lancamento.tipo === 'SAIDA' && (
                      <div>
                        {lancamento.centroCusto?.nome && <div>{lancamento.centroCusto.nome}</div>}
                        {lancamento.tipoDespesa?.nome && (
                          <div className="text-xs text-gray-500">{lancamento.tipoDespesa.nome}</div>
                        )}
                      </div>
                    )}
                    {lancamento.tipo !== 'SAIDA' && '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                    lancamento.tipo === 'SAIDA' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {lancamento.tipo === 'SAIDA' ? '-' : '+'}{formatarMoeda(lancamento.valor)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {lancamento.createdBy ? (
                      <div>
                        <div className="font-medium">{lancamento.createdBy.name}</div>
                        <div className="text-xs text-gray-500">{formatarData(lancamento.createdAt)}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {(lancamento.tipo === 'ENTRADA_MANUAL' || lancamento.tipo === 'SAIDA') && (
                      <button
                        onClick={() => excluirLancamento(lancamento.id, lancamento.tipo)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir lançamento"
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

      {/* Modal Entrada */}
      {modalEntradaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Nova Entrada</h2>
              <button onClick={fecharModalEntrada} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  value={formEntrada.dataEntrada}
                  onChange={(e) => setFormEntrada({ ...formEntrada, dataEntrada: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <CurrencyInput
                  name="valor"
                  value={formEntrada.valor}
                  onChange={(value) => setFormEntrada({ ...formEntrada, valor: value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                  min={0.01}
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={formEntrada.descricao}
                  onChange={(e) => setFormEntrada({ ...formEntrada, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Descrição da entrada"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                <select
                  value={formEntrada.formaPagamentoId}
                  onChange={(e) => setFormEntrada({ ...formEntrada, formaPagamentoId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp.id} value={fp.id}>{fp.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formEntrada.observacoes}
                  onChange={(e) => setFormEntrada({ ...formEntrada, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={fecharModalEntrada}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEntrada}
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Saída */}
      {modalSaidaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Nova Saída</h2>
              <button onClick={fecharModalSaida} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  value={formSaida.dataSaida}
                  onChange={(e) => setFormSaida({ ...formSaida, dataSaida: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <CurrencyInput
                  name="valor"
                  value={formSaida.valor}
                  onChange={(value) => setFormSaida({ ...formSaida, valor: value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                  min={0.01}
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={formSaida.descricao}
                  onChange={(e) => setFormSaida({ ...formSaida, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Descrição da saída"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Despesa</label>
                <select
                  value={formSaida.tipoDespesaId || ''}
                  onChange={(e) => setFormSaida({ ...formSaida, tipoDespesaId: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {tiposDespesa.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custo *</label>
                <select
                  value={formSaida.centroCustoId}
                  onChange={(e) => setFormSaida({ ...formSaida, centroCustoId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {centrosCusto.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                <select
                  value={formSaida.fornecedorId || ''}
                  onChange={(e) => setFormSaida({ ...formSaida, fornecedorId: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map((forn) => (
                    <option key={forn.id} value={forn.id}>{forn.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                <select
                  value={formSaida.formaPagamentoId}
                  onChange={(e) => setFormSaida({ ...formSaida, formaPagamentoId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp.id} value={fp.id}>{fp.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formSaida.observacoes}
                  onChange={(e) => setFormSaida({ ...formSaida, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={fecharModalSaida}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarSaida}
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abrir Caixa */}
      {modalAbrirCaixaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Abrir Caixa</h2>
              <button onClick={fecharModalAbrirCaixa} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAbrirCaixa.saldoInicial || ''}
                  onChange={(e) => setFormAbrirCaixa({ ...formAbrirCaixa, saldoInicial: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formAbrirCaixa.observacoes}
                  onChange={(e) => setFormAbrirCaixa({ ...formAbrirCaixa, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={fecharModalAbrirCaixa}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarAbrirCaixa}
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {salvando ? 'Abrindo...' : 'Abrir Caixa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {modalFecharCaixaAberto && aberturaAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Fechar Caixa</h2>
              <button onClick={fecharModalFecharCaixa} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Saldo Inicial:</span>
                  <span className="font-semibold">{formatarMoeda(aberturaAtual.saldoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total de Entradas:</span>
                  <span className="font-semibold text-green-600">{formatarMoeda(aberturaAtual.totalEntradas || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total de Saídas:</span>
                  <span className="font-semibold text-red-600">{formatarMoeda(aberturaAtual.totalSaidas || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">Saldo Calculado:</span>
                  <span className={`font-bold ${(aberturaAtual.saldoAtual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatarMoeda(aberturaAtual.saldoAtual || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Final (para conferência)</label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoFinalInformado !== undefined ? saldoFinalInformado : ''}
                  onChange={(e) => setSaldoFinalInformado(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder={formatarMoeda(aberturaAtual.saldoAtual || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para usar o saldo calculado automaticamente</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={observacoesFechamento}
                  onChange={(e) => setObservacoesFechamento(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações sobre o fechamento (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={fecharModalFecharCaixa}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarFecharCaixa}
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {salvando ? 'Fechando...' : 'Fechar Caixa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

