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
  ItemCard,
  CriarItemCardPayload,
  AtualizarItemCardPayload,
  PagamentoCard,
  CriarPagamentoCardPayload,
  EntradaCaixa,
  CriarEntradaCaixaPayload,
  SaidaCaixa,
  CriarSaidaCaixaPayload,
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

  obter: async (id: string, incluirItens?: boolean, incluirPagamentos?: boolean): Promise<CardCliente> => {
    const params = new URLSearchParams();
    if (incluirItens !== false) params.append('incluirItens', 'true');
    if (incluirPagamentos !== false) params.append('incluirPagamentos', 'true');
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

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/gestao-arena/card-cliente/${id}`);
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

