// types/gestaoArena.ts - Tipos para o sistema de gestão da arena

// ============================================
// CARD DE CLIENTE
// ============================================
export type StatusCard = 'ABERTO' | 'FECHADO' | 'CANCELADO';

export interface CardCliente {
  id: string;
  pointId: string;
  numeroCard: number;
  status: StatusCard;
  observacoes?: string | null;
  valorTotal: number;
  totalPago?: number; // Total já pago (calculado)
  saldo?: number; // Saldo pendente = valorTotal - totalPago (calculado)
  usuarioId?: string | null; // Usuário vinculado ao card (opcional)
  nomeAvulso?: string | null; // Nome do cliente avulso (quando não há usuário vinculado)
  telefoneAvulso?: string | null; // Telefone do cliente avulso (quando não há usuário vinculado)
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  fechadoAt?: string | null;
  fechadoBy?: string | null;
  // Relacionamentos
  usuario?: {
    id: string;
    name: string;
    email: string;
  } | null;
  itens?: ItemCard[];
  pagamentos?: PagamentoCard[];
}

export interface CriarCardClientePayload {
  pointId: string;
  observacoes?: string;
  usuarioId?: string; // Opcional: vincular card a um usuário
  nomeAvulso?: string; // Opcional: nome do cliente avulso (quando não há usuário vinculado)
  telefoneAvulso?: string; // Opcional: telefone do cliente avulso (quando não há usuário vinculado)
}

// Payload para criar card completo (card + itens + pagamento) em uma única chamada - VENDA RÁPIDA
export interface CriarVendaRapidaPayload {
  pointId: string;
  usuarioId?: string | null;
  nomeAvulso?: string;
  telefoneAvulso?: string;
  observacoes?: string;
  itens: Array<{
    produtoId: string;
    quantidade: number;
    precoUnitario?: number; // Opcional: se não informado, usa preço do produto
    observacoes?: string;
  }>;
  pagamento?: {
    formaPagamentoId: string;
    valor: number;
    observacoes?: string;
    itemIds?: string[]; // IDs dos itens que este pagamento está pagando (será preenchido automaticamente se não informado)
  };
}

export interface AtualizarCardClientePayload {
  status?: StatusCard;
  observacoes?: string;
  usuarioId?: string | null; // Opcional: vincular/desvincular card de um usuário
  nomeAvulso?: string | null; // Opcional: nome do cliente avulso
  telefoneAvulso?: string | null; // Opcional: telefone do cliente avulso
}

// ============================================
// PRODUTO
// ============================================
export interface Produto {
  id: string;
  pointId: string;
  nome: string;
  descricao?: string | null;
  precoVenda: number;
  precoCusto?: number | null;
  categoria?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriarProdutoPayload {
  pointId: string;
  nome: string;
  descricao?: string;
  precoVenda: number;
  precoCusto?: number;
  categoria?: string;
  ativo?: boolean;
}

export interface AtualizarProdutoPayload {
  nome?: string;
  descricao?: string;
  precoVenda?: number;
  precoCusto?: number;
  categoria?: string;
  ativo?: boolean;
}

// ============================================
// ITEM DO CARD
// ============================================
export interface ItemCard {
  id: string;
  cardId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relacionamentos
  produto?: Produto;
}

export interface CriarItemCardPayload {
  cardId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario?: number; // Se não informado, usa o preço do produto
  observacoes?: string;
}

export interface AtualizarItemCardPayload {
  quantidade?: number;
  precoUnitario?: number;
  observacoes?: string;
}

// ============================================
// FORMA DE PAGAMENTO
// ============================================
export type TipoFormaPagamento = 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'OUTRO';

export interface FormaPagamento {
  id: string;
  pointId: string;
  nome: string;
  descricao?: string | null;
  tipo: TipoFormaPagamento;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriarFormaPagamentoPayload {
  pointId: string;
  nome: string;
  descricao?: string;
  tipo: TipoFormaPagamento;
  ativo?: boolean;
}

export interface AtualizarFormaPagamentoPayload {
  nome?: string;
  descricao?: string;
  tipo?: TipoFormaPagamento;
  ativo?: boolean;
}

// ============================================
// PAGAMENTO DO CARD
// ============================================
export interface PagamentoCard {
  id: string;
  cardId: string;
  formaPagamentoId: string;
  valor: number;
  observacoes?: string | null;
  createdAt: string;
  createdBy?: string | null;
  // Relacionamentos
  formaPagamento?: FormaPagamento;
  itens?: ItemCard[]; // Itens vinculados a este pagamento
}

export interface CriarPagamentoCardPayload {
  cardId: string;
  formaPagamentoId: string;
  valor: number;
  observacoes?: string;
  itemIds?: string[]; // IDs dos itens que este pagamento está pagando (opcional)
}

// ============================================
// FORNECEDOR
// ============================================
export interface Fornecedor {
  id: string;
  pointId: string;
  nome: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriarFornecedorPayload {
  pointId: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  observacoes?: string;
  ativo?: boolean;
}

export interface AtualizarFornecedorPayload {
  nome?: string;
  nomeFantasia?: string;
  cnpj?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  observacoes?: string;
  ativo?: boolean;
}

// ============================================
// CATEGORIA DE SAÍDA
// ============================================
export interface CategoriaSaida {
  id: string;
  pointId: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriarCategoriaSaidaPayload {
  pointId: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
}

export interface AtualizarCategoriaSaidaPayload {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
}

// ============================================
// CENTRO DE CUSTO
// ============================================
export interface CentroCusto {
  id: string;
  pointId: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriarCentroCustoPayload {
  pointId: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
}

export interface AtualizarCentroCustoPayload {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
}

// ============================================
// ENTRADA DE CAIXA (Manual)
// ============================================
export interface EntradaCaixa {
  id: string;
  pointId: string;
  valor: number;
  descricao: string;
  formaPagamentoId: string;
  observacoes?: string | null;
  dataEntrada: string;
  createdAt: string;
  createdBy?: string | null;
  // Relacionamentos
  formaPagamento?: FormaPagamento;
}

export interface CriarEntradaCaixaPayload {
  pointId: string;
  valor: number;
  descricao: string;
  formaPagamentoId: string;
  observacoes?: string;
  dataEntrada?: string; // Se não informado, usa a data atual
}

// ============================================
// SAÍDA DE CAIXA (Manual)
// ============================================
export interface SaidaCaixa {
  id: string;
  pointId: string;
  valor: number;
  descricao: string;
  fornecedorId?: string | null;
  categoriaSaidaId: string;
  centroCustoId: string;
  formaPagamentoId: string;
  observacoes?: string | null;
  dataSaida: string;
  createdAt: string;
  createdBy?: string | null;
  // Relacionamentos
  fornecedor?: Fornecedor;
  categoriaSaida?: CategoriaSaida;
  centroCusto?: CentroCusto;
  formaPagamento?: FormaPagamento;
}

export interface CriarSaidaCaixaPayload {
  pointId: string;
  valor: number;
  descricao: string;
  fornecedorId?: string | null;
  categoriaSaidaId: string;
  centroCustoId: string;
  formaPagamentoId: string;
  observacoes?: string;
  dataSaida?: string; // Se não informado, usa a data atual
}

// ============================================
// FILTROS
// ============================================
export interface FiltrosCardCliente {
  pointId?: string;
  status?: StatusCard;
  dataInicio?: string;
  dataFim?: string;
  usuarioId?: string; // Filtrar cards de um usuário específico
}

export interface FiltrosFluxoCaixa {
  pointId?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: 'ENTRADA' | 'SAIDA' | 'TODOS';
}

