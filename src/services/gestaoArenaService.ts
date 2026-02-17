// src/services/gestaoArenaService.ts
import { api } from "@/lib/api";
import type {
  CardCliente,
  CriarCardClientePayload,
  CriarVendaRapidaPayload,
  AtualizarCardClientePayload,
  Produto,
  CriarProdutoPayload,
  AtualizarProdutoPayload,
  FormaPagamento,
  CriarFormaPagamentoPayload,
  AtualizarFormaPagamentoPayload,
  Fornecedor,
  CriarFornecedorPayload,
  AtualizarFornecedorPayload,
  CategoriaSaida,
  CriarCategoriaSaidaPayload,
  AtualizarCategoriaSaidaPayload,
  CentroCusto,
  CriarCentroCustoPayload,
  AtualizarCentroCustoPayload,
  TipoDespesa,
  CriarTipoDespesaPayload,
  AtualizarTipoDespesaPayload,
  ItemCard,
  CriarItemCardPayload,
  AtualizarItemCardPayload,
  PagamentoCard,
  CriarPagamentoCardPayload,
  EntradaCaixa,
  CriarEntradaCaixaPayload,
  SaidaCaixa,
  CriarSaidaCaixaPayload,
  AberturaCaixa,
  CriarAberturaCaixaPayload,
  FecharAberturaCaixaPayload,
  LancamentoFluxoCaixa,
  DashboardOperacionalData,
  HistoricoAtletaResumo,
  HistoricoAtletaConsumoItem,
  HistoricoAtletaPagamento,
  HistoricoAtletaAgendamento,
  HistoricoAtletaContaCorrente,
  AtletaHistoricoArena,
} from "@/types/gestaoArena";

export type {
  CardCliente,
  CriarCardClientePayload,
  CriarVendaRapidaPayload,
  AtualizarCardClientePayload,
  Produto,
  CriarProdutoPayload,
  AtualizarProdutoPayload,
  FormaPagamento,
  CriarFormaPagamentoPayload,
  AtualizarFormaPagamentoPayload,
  Fornecedor,
  CriarFornecedorPayload,
  AtualizarFornecedorPayload,
  CategoriaSaida,
  CriarCategoriaSaidaPayload,
  AtualizarCategoriaSaidaPayload,
  CentroCusto,
  CriarCentroCustoPayload,
  AtualizarCentroCustoPayload,
  TipoDespesa,
  CriarTipoDespesaPayload,
  AtualizarTipoDespesaPayload,
  ItemCard,
  CriarItemCardPayload,
  AtualizarItemCardPayload,
  PagamentoCard,
  CriarPagamentoCardPayload,
  EntradaCaixa,
  CriarEntradaCaixaPayload,
  SaidaCaixa,
  CriarSaidaCaixaPayload,
  AberturaCaixa,
  CriarAberturaCaixaPayload,
  FecharAberturaCaixaPayload,
  LancamentoFluxoCaixa,
  DashboardOperacionalData,
  HistoricoAtletaResumo,
  HistoricoAtletaConsumoItem,
  HistoricoAtletaPagamento,
  HistoricoAtletaAgendamento,
  HistoricoAtletaContaCorrente,
  AtletaHistoricoArena,
} from "@/types/gestaoArena";

// ========== CARDS DE CLIENTES ==========
export const cardClienteService = {
  listar: async (pointId?: string, status?: string, incluirItens?: boolean, incluirPagamentos?: boolean): Promise<CardCliente[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (status) params.append('status', status);
    if (incluirItens) params.append('incluirItens', 'true');
    if (incluirPagamentos) params.append('incluirPagamentos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/card-cliente${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string, incluirItens?: boolean, incluirPagamentos?: boolean, incluirAgendamentos?: boolean): Promise<CardCliente> => {
    const params = new URLSearchParams();
    if (incluirItens !== false) params.append('incluirItens', 'true');
    if (incluirPagamentos !== false) params.append('incluirPagamentos', 'true');
    if (incluirAgendamentos !== false) params.append('incluirAgendamentos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/card-cliente/${id}${query ? `?${query}` : ''}`);
    return res.data;
  },

  criar: async (payload: CriarCardClientePayload): Promise<CardCliente> => {
    const res = await api.post("/gestao-arena/card-cliente", payload);
    return res.data;
  },

  criarVendaRapida: async (payload: CriarVendaRapidaPayload): Promise<CardCliente> => {
    const res = await api.post("/gestao-arena/venda-rapida", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarCardClientePayload): Promise<CardCliente> => {
    const res = await api.put(`/gestao-arena/card-cliente/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string, senha: string): Promise<void> => {
    await api.delete(`/gestao-arena/card-cliente/${id}`, { senha });
  },

  limparTodos: async (pointId: string): Promise<{ mensagem: string; totalCards: number }> => {
    const res = await api.post('/gestao-arena/card-cliente/limpar-todos', { pointId });
    return res.data;
  },

  unificar: async (cardPrincipalId: string, cardSecundarioId: string): Promise<{ mensagem: string; cardPrincipalId: string; cardSecundarioId: string }> => {
    const res = await api.post('/gestao-arena/card-cliente/unificar', { cardPrincipalId, cardSecundarioId });
    return res.data;
  },

  lancamentoLote: async (payload: {
    pointId: string;
    produtoId: string;
    quantidade: number;
    valorUnitario?: number;
    observacao?: string;
    criarNovasComandas: boolean;
    atletas: { id: string; nome?: string }[];
  }): Promise<{ mensagem: string; resultados: any }> => {
    const res = await api.post('/gestao-arena/lancamento-lote', payload);
    return res.data;
  },

  // Agendamentos do card
  vincularAgendamento: async (cardId: string, agendamentoId: string): Promise<any> => {
    const res = await api.post(`/gestao-arena/card-cliente/${cardId}/agendamento`, { agendamentoId });
    return res.data;
  },

  desvincularAgendamento: async (cardId: string, agendamentoCardId: string): Promise<void> => {
    await api.delete(`/gestao-arena/card-cliente/${cardId}/agendamento/${agendamentoCardId}`);
  },

  listarAgendamentos: async (cardId: string): Promise<any[]> => {
    const res = await api.get(`/gestao-arena/card-cliente/${cardId}/agendamento`);
    return res.data;
  },
};

// ========== ITENS DO CARD ==========
export const itemCardService = {
  listar: async (cardId: string): Promise<ItemCard[]> => {
    const res = await api.get(`/gestao-arena/card-cliente/${cardId}/item`);
    return res.data;
  },

  criar: async (cardId: string, payload: CriarItemCardPayload): Promise<ItemCard> => {
    const res = await api.post(`/gestao-arena/card-cliente/${cardId}/item`, payload);
    return res.data;
  },

  atualizar: async (cardId: string, itemId: string, payload: AtualizarItemCardPayload): Promise<ItemCard> => {
    const res = await api.put(`/gestao-arena/card-cliente/${cardId}/item/${itemId}`, payload);
    return res.data;
  },

  deletar: async (cardId: string, itemId: string): Promise<void> => {
    await api.delete(`/gestao-arena/card-cliente/${cardId}/item/${itemId}`);
  },
};

// ========== PAGAMENTOS DO CARD ==========
export const pagamentoCardService = {
  listar: async (cardId: string): Promise<PagamentoCard[]> => {
    const res = await api.get(`/gestao-arena/card-cliente/${cardId}/pagamento`);
    return res.data;
  },

  criar: async (cardId: string, payload: CriarPagamentoCardPayload): Promise<PagamentoCard> => {
    const res = await api.post(`/gestao-arena/card-cliente/${cardId}/pagamento`, payload);
    return res.data;
  },

  deletar: async (cardId: string, pagamentoId: string): Promise<void> => {
    await api.delete(`/gestao-arena/card-cliente/${cardId}/pagamento/${pagamentoId}`);
  },
};

// ========== PRODUTOS ==========
export const produtoService = {
  listar: async (pointId?: string, apenasAtivos?: boolean, categoria?: string): Promise<Produto[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    if (categoria) params.append('categoria', categoria);
    const query = params.toString();
    const res = await api.get(`/gestao-arena/produto${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<Produto> => {
    const res = await api.get(`/gestao-arena/produto/${id}`);
    return res.data;
  },

  criar: async (payload: CriarProdutoPayload): Promise<Produto> => {
    const res = await api.post("/gestao-arena/produto", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarProdutoPayload): Promise<Produto> => {
    const res = await api.put(`/gestao-arena/produto/${id}`, payload);
    return res.data;
  },

  atualizarEmMassa: async (updates: { id: string; precoVenda: number }[]): Promise<{ mensagem: string; count: number }> => {
    const res = await api.put('/gestao-arena/produto/bulk-update', { updates });
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/produto/${id}`);
  },
};

// ========== FORMAS DE PAGAMENTO ==========
export const formaPagamentoService = {
  listar: async (pointId?: string, apenasAtivos?: boolean): Promise<FormaPagamento[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/forma-pagamento${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<FormaPagamento> => {
    const res = await api.get(`/gestao-arena/forma-pagamento/${id}`);
    return res.data;
  },

  criar: async (payload: CriarFormaPagamentoPayload): Promise<FormaPagamento> => {
    const res = await api.post("/gestao-arena/forma-pagamento", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarFormaPagamentoPayload): Promise<FormaPagamento> => {
    const res = await api.put(`/gestao-arena/forma-pagamento/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/forma-pagamento/${id}`);
  },
};

// ========== FORNECEDORES ==========
export const fornecedorService = {
  listar: async (pointId?: string, apenasAtivos?: boolean): Promise<Fornecedor[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/fornecedor${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<Fornecedor> => {
    const res = await api.get(`/gestao-arena/fornecedor/${id}`);
    return res.data;
  },

  criar: async (payload: CriarFornecedorPayload): Promise<Fornecedor> => {
    const res = await api.post("/gestao-arena/fornecedor", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarFornecedorPayload): Promise<Fornecedor> => {
    const res = await api.put(`/gestao-arena/fornecedor/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/fornecedor/${id}`);
  },
};

// ========== CATEGORIAS DE SAÍDA ==========
export const categoriaSaidaService = {
  listar: async (pointId?: string, apenasAtivos?: boolean): Promise<CategoriaSaida[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/categoria-saida${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<CategoriaSaida> => {
    const res = await api.get(`/gestao-arena/categoria-saida/${id}`);
    return res.data;
  },

  criar: async (payload: CriarCategoriaSaidaPayload): Promise<CategoriaSaida> => {
    const res = await api.post("/gestao-arena/categoria-saida", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarCategoriaSaidaPayload): Promise<CategoriaSaida> => {
    const res = await api.put(`/gestao-arena/categoria-saida/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/categoria-saida/${id}`);
  },
};

// ========== CENTRO DE CUSTO ==========
export const centroCustoService = {
  listar: async (pointId?: string, apenasAtivos?: boolean): Promise<CentroCusto[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/centro-custo${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<CentroCusto> => {
    const res = await api.get(`/gestao-arena/centro-custo/${id}`);
    return res.data;
  },

  criar: async (payload: CriarCentroCustoPayload): Promise<CentroCusto> => {
    const res = await api.post("/gestao-arena/centro-custo", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarCentroCustoPayload): Promise<CentroCusto> => {
    const res = await api.put(`/gestao-arena/centro-custo/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/centro-custo/${id}`);
  },
};

// ========== TIPO DE DESPESA ==========
export const tipoDespesaService = {
  listar: async (pointId?: string, apenasAtivos?: boolean): Promise<TipoDespesa[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (apenasAtivos) params.append('apenasAtivos', 'true');
    const query = params.toString();
    const res = await api.get(`/gestao-arena/tipo-despesa${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<TipoDespesa> => {
    const res = await api.get(`/gestao-arena/tipo-despesa/${id}`);
    return res.data;
  },

  criar: async (payload: CriarTipoDespesaPayload): Promise<TipoDespesa> => {
    const res = await api.post("/gestao-arena/tipo-despesa", payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarTipoDespesaPayload): Promise<TipoDespesa> => {
    const res = await api.put(`/gestao-arena/tipo-despesa/${id}`, payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/tipo-despesa/${id}`);
  },
};

// ========== ENTRADAS DE CAIXA ==========
export const entradaCaixaService = {
  listar: async (pointId?: string, dataInicio?: string, dataFim?: string): Promise<EntradaCaixa[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    const res = await api.get(`/gestao-arena/entrada-caixa${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<EntradaCaixa> => {
    const res = await api.get(`/gestao-arena/entrada-caixa/${id}`);
    return res.data;
  },

  criar: async (payload: CriarEntradaCaixaPayload): Promise<EntradaCaixa> => {
    const res = await api.post("/gestao-arena/entrada-caixa", payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/entrada-caixa/${id}`);
  },
};

// ========== SAÍDAS DE CAIXA ==========
export const saidaCaixaService = {
  listar: async (pointId?: string, dataInicio?: string, dataFim?: string): Promise<SaidaCaixa[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    const res = await api.get(`/gestao-arena/saida-caixa${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<SaidaCaixa> => {
    const res = await api.get(`/gestao-arena/saida-caixa/${id}`);
    return res.data;
  },

  criar: async (payload: CriarSaidaCaixaPayload): Promise<SaidaCaixa> => {
    const res = await api.post("/gestao-arena/saida-caixa", payload);
    return res.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/saida-caixa/${id}`);
  },
};

// ========== FLUXO DE CAIXA (Unificado) ==========
export const fluxoCaixaService = {
  listar: async (
    pointId?: string,
    aberturaCaixaId?: string,
    dataInicio?: string,
    dataFim?: string,
    tipo?: 'ENTRADA' | 'SAIDA' | 'TODOS'
  ): Promise<LancamentoFluxoCaixa[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (aberturaCaixaId) params.append('aberturaCaixaId', aberturaCaixaId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (tipo) params.append('tipo', tipo);
    const query = params.toString();
    const res = await api.get(`/gestao-arena/fluxo-caixa${query ? `?${query}` : ''}`);
    return res.data;
  },
};

export const dashboardOperacionalService = {
  obter: async (pointId: string, dataInicio: string, dataFim: string): Promise<DashboardOperacionalData> => {
    const res = await api.get('/gestao-arena/dashboard-operacional', {
      params: { pointId, dataInicio, dataFim }
    });
    return res.data;
  }
};

export const historicoAtletaArenaService = {
  listarConsumo: async (pointId: string, atletaId: string, dataInicio?: string, dataFim?: string): Promise<HistoricoAtletaConsumoItem[]> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const res = await api.get(`/gestao-arena/historico-atleta/${atletaId}/consumo?${params.toString()}`);
    return res.data;
  },

  listarPagamentos: async (pointId: string, atletaId: string, dataInicio?: string, dataFim?: string): Promise<HistoricoAtletaPagamento[]> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const res = await api.get(`/gestao-arena/historico-atleta/${atletaId}/pagamentos?${params.toString()}`);
    return res.data;
  },

  listarAgendamentos: async (pointId: string, atletaId: string, dataInicio?: string, dataFim?: string): Promise<HistoricoAtletaAgendamento[]> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const res = await api.get(`/gestao-arena/historico-atleta/${atletaId}/agendamentos?${params.toString()}`);
    return res.data;
  },

  obterContaCorrente: async (pointId: string, atletaId: string, dataInicio?: string, dataFim?: string): Promise<HistoricoAtletaContaCorrente> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const res = await api.get(`/gestao-arena/historico-atleta/${atletaId}/conta-corrente?${params.toString()}`);
    return res.data;
  },

  lancarMovimentacao: async (pointId: string, atletaId: string, payload: { tipo: 'CREDITO' | 'DEBITO'; valor: number; justificativa: string }): Promise<{ mensagem: string; novoSaldo: number }> => {
    const res = await api.post(`/gestao-arena/historico-atleta/${atletaId}/conta-corrente`, { ...payload, pointId });
    return res.data;
  },

  obterResumo: async (pointId: string, atletaId: string, dataInicio?: string, dataFim?: string): Promise<HistoricoAtletaResumo> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const res = await api.get(`/gestao-arena/historico-atleta/${atletaId}/resumo?${params.toString()}`);
    return res.data;
  },

  buscarAtletas: async (pointId: string, busca: string): Promise<AtletaHistoricoArena[]> => {
    const params = new URLSearchParams();
    params.append('pointId', pointId);
    params.append('q', busca);
    const res = await api.get(`/gestao-arena/historico-atleta/atletas?${params.toString()}`);
    return res.data;
  },
};

// ========== ABERTURA DE CAIXA ==========
export const aberturaCaixaService = {
  listar: async (
    pointId?: string,
    status?: 'ABERTA' | 'FECHADA',
    dataInicio?: string,
    dataFim?: string
  ): Promise<AberturaCaixa[]> => {
    const params = new URLSearchParams();
    if (pointId) params.append('pointId', pointId);
    if (status) params.append('status', status);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    const res = await api.get(`/gestao-arena/abertura-caixa${query ? `?${query}` : ''}`);
    return res.data;
  },

  obter: async (id: string): Promise<AberturaCaixa> => {
    const res = await api.get(`/gestao-arena/abertura-caixa/${id}`);
    return res.data;
  },

  criar: async (payload: CriarAberturaCaixaPayload): Promise<AberturaCaixa> => {
    const res = await api.post('/gestao-arena/abertura-caixa', payload);
    return res.data;
  },

  fechar: async (id: string, payload?: FecharAberturaCaixaPayload): Promise<AberturaCaixa> => {
    const res = await api.put(`/gestao-arena/abertura-caixa/${id}`, payload || {});
    return res.data;
  },
};

// ========== COLABORADORES ==========
export interface Colaborador {
  id: string;
  name: string;
  email: string;
  role: 'ORGANIZER';
  pointIdGestor: string;
  ehColaborador: boolean;
  gestorId: string | null;
  createdAt: string;
  gestor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CriarColaboradorPayload {
  name: string;
  email: string;
  password: string;
  pointId: string;
}

export interface AtualizarColaboradorPayload {
  name?: string;
  email?: string;
  password?: string;
}

export const colaboradorService = {
  listar: async (pointId: string): Promise<Colaborador[]> => {
    const res = await api.get(`/gestao-arena/colaboradores?pointId=${pointId}`);
    return res.data;
  },

  criar: async (payload: CriarColaboradorPayload): Promise<{ mensagem: string; colaborador: Colaborador }> => {
    const res = await api.post('/gestao-arena/colaboradores', payload);
    return res.data;
  },

  atualizar: async (id: string, payload: AtualizarColaboradorPayload): Promise<{ mensagem: string; colaborador: Colaborador }> => {
    const res = await api.put(`/gestao-arena/colaboradores/${id}`, payload);
    return res.data;
  },

  remover: async (id: string): Promise<{ mensagem: string }> => {
    const res = await api.delete(`/gestao-arena/colaboradores/${id}`);
    return res.data;
  },
};
