// components/VendaRapidaModal.tsx - Modal para venda rápida (card + itens + pagamento em uma única operação)
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService, produtoService, formaPagamentoService } from '@/services/gestaoArenaService';
import { userService } from '@/services/userService';
import type { Produto, FormaPagamento, CriarVendaRapidaPayload } from '@/types/gestaoArena';
import type { UsuarioAdmin } from '@/services/userService';
import { X, Plus, Trash2, ShoppingCart, CreditCard, Search, User, UserPlus } from 'lucide-react';

interface ItemCarrinho {
  produtoId: string;
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  observacoes?: string;
}

interface VendaRapidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VendaRapidaModal({ isOpen, onClose, onSuccess }: VendaRapidaModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Produtos e formas de pagamento (cache)
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');

  // Cliente
  const [tipoCliente, setTipoCliente] = useState<'cadastrado' | 'avulso'>('avulso');
  const [usuarioId, setUsuarioId] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telefoneAvulso, setTelefoneAvulso] = useState('');
  const [observacoesCard, setObservacoesCard] = useState('');
  
  // Busca de clientes cadastrados
  const [clientes, setClientes] = useState<UsuarioAdmin[]>([]);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientesFiltrados, setClientesFiltrados] = useState<UsuarioAdmin[]>([]);
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false);
  const [carregandoClientes, setCarregandoClientes] = useState(false);

  // Carrinho de itens (trabalha no frontend)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // Pagamento
  const [incluirPagamento, setIncluirPagamento] = useState(false);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [valorPagamento, setValorPagamento] = useState('');
  const [observacoesPagamento, setObservacoesPagamento] = useState('');

  useEffect(() => {
    if (isOpen && usuario?.pointIdGestor) {
      carregarDados();
      resetarFormulario();
    }
  }, [isOpen, usuario?.pointIdGestor]);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !salvando) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose, salvando]);

  const carregarDados = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const [produtosData, formasData] = await Promise.all([
        produtoService.listar(usuario.pointIdGestor, true),
        formaPagamentoService.listar(usuario.pointIdGestor, true),
      ]);

      setProdutos(produtosData);
      setFormasPagamento(formasData);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const carregarClientes = async (buscaTexto?: string) => {
    try {
      setCarregandoClientes(true);
      const clientesData = await userService.buscarClientes(buscaTexto);
      setClientes(clientesData);
      setClientesFiltrados(clientesData);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      setErro('Erro ao carregar lista de clientes');
    } finally {
      setCarregandoClientes(false);
    }
  };

  useEffect(() => {
    if (tipoCliente === 'cadastrado') {
      // Carregar clientes quando mudar para tipo cadastrado
      if (buscaCliente.trim()) {
        // Se há busca, fazer busca na API
        const timeoutId = setTimeout(() => {
          carregarClientes(buscaCliente);
        }, 300); // Debounce de 300ms
        return () => clearTimeout(timeoutId);
      } else if (clientes.length === 0) {
        // Se não há busca e não há clientes carregados, carregar todos
        carregarClientes();
      } else {
        // Se já há clientes carregados, apenas filtrar localmente
        setClientesFiltrados(clientes);
      }
    }
  }, [tipoCliente, buscaCliente]);

  useEffect(() => {
    // Filtrar clientes localmente enquanto digita (para resposta mais rápida)
    if (buscaCliente.trim() === '') {
      setClientesFiltrados(clientes);
    } else {
      const buscaLower = buscaCliente.toLowerCase();
      const filtrados = clientes.filter(
        (cliente) =>
          cliente.name.toLowerCase().includes(buscaLower) ||
          cliente.email.toLowerCase().includes(buscaLower)
      );
      setClientesFiltrados(filtrados);
    }
  }, [buscaCliente, clientes]);

  const resetarFormulario = () => {
    setTipoCliente('avulso');
    setUsuarioId('');
    setNomeAvulso('');
    setTelefoneAvulso('');
    setObservacoesCard('');
    setCarrinho([]);
    setBuscaCliente('');
    setMostrarListaClientes(false);
    setIncluirPagamento(false);
    setFormaPagamentoId('');
    setValorPagamento('');
    setObservacoesPagamento('');
    setBuscaProduto('');
    setErro('');
  };

  const adicionarItemAoCarrinho = (produto: Produto) => {
    const itemExistente = carrinho.find((item) => item.produtoId === produto.id);
    
    // Garantir que precoVenda seja um número
    const precoVenda = typeof produto.precoVenda === 'string' 
      ? parseFloat(produto.precoVenda) 
      : produto.precoVenda;
    
    if (itemExistente) {
      // Se já existe, aumenta a quantidade
      setCarrinho((prev) =>
        prev.map((item) =>
          item.produtoId === produto.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
                precoTotal: (item.quantidade + 1) * item.precoUnitario,
              }
            : item
        )
      );
    } else {
      // Adiciona novo item
      const novoItem: ItemCarrinho = {
        produtoId: produto.id,
        produto,
        quantidade: 1,
        precoUnitario: precoVenda,
        precoTotal: precoVenda,
      };
      setCarrinho((prev) => [...prev, novoItem]);
    }
    setBuscaProduto('');
  };

  const removerItemDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produtoId !== produtoId));
  };

  const atualizarQuantidadeItem = (produtoId: string, quantidade: number) => {
    if (quantidade <= 0) {
      removerItemDoCarrinho(produtoId);
      return;
    }

    setCarrinho((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId
          ? {
              ...item,
              quantidade,
              precoTotal: quantidade * item.precoUnitario,
            }
          : item
      )
    );
  };

  const atualizarPrecoUnitario = (produtoId: string, preco: number | string) => {
    const precoNumero = typeof preco === 'string' ? parseFloat(preco) || 0 : preco;
    setCarrinho((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId
          ? {
              ...item,
              precoUnitario: precoNumero,
              precoTotal: item.quantidade * precoNumero,
            }
          : item
      )
    );
  };

  const valorTotalCarrinho = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + item.precoTotal, 0);
  }, [carrinho]);

  // Calcular saldo pendente
  const saldoPendente = useMemo(() => {
    if (!incluirPagamento || !valorPagamento) {
      return valorTotalCarrinho;
    }
    const valorPago = parseFloat(valorPagamento) || 0;
    return Math.max(0, valorTotalCarrinho - valorPago);
  }, [incluirPagamento, valorPagamento, valorTotalCarrinho]);

  // Determinar se pode finalizar (pagamento informado e sem saldo pendente)
  const podeFinalizar = useMemo(() => {
    return incluirPagamento && 
           formaPagamentoId && 
           valorPagamento && 
           parseFloat(valorPagamento) > 0 &&
           saldoPendente === 0;
  }, [incluirPagamento, formaPagamentoId, valorPagamento, saldoPendente]);

  // Verificar se o formulário está válido para habilitar o botão
  const formularioValido = useMemo(() => {
    // Deve ter itens no carrinho
    if (carrinho.length === 0) return false;
    
    // Cliente deve estar informado
    if (tipoCliente === 'cadastrado' && !usuarioId) return false;
    if (tipoCliente === 'avulso' && (!nomeAvulso || nomeAvulso.trim() === '')) return false;
    
    // Se incluir pagamento, deve ter forma de pagamento e valor válido
    if (incluirPagamento) {
      if (!formaPagamentoId) return false;
      if (!valorPagamento || valorPagamento.trim() === '') return false;
      const valor = parseFloat(valorPagamento);
      if (isNaN(valor) || valor <= 0) return false;
      if (valor > valorTotalCarrinho) return false;
    }
    
    return true;
  }, [carrinho.length, tipoCliente, usuarioId, nomeAvulso, incluirPagamento, formaPagamentoId, valorPagamento, valorTotalCarrinho]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto) return [];
    const buscaLower = buscaProduto.toLowerCase();
    return produtos.filter(
      (produto) =>
        produto.nome.toLowerCase().includes(buscaLower) ||
        produto.descricao?.toLowerCase().includes(buscaLower)
    );
  }, [produtos, buscaProduto]);

  const finalizarVenda = async () => {
    if (!usuario?.pointIdGestor) {
      setErro('Usuário não autenticado');
      return;
    }

    // Validações
    if (carrinho.length === 0) {
      setErro('Adicione pelo menos um item');
      return;
    }

    if (tipoCliente === 'cadastrado' && !usuarioId) {
      setErro('Selecione um cliente cadastrado');
      return;
    }

    if (tipoCliente === 'avulso' && !nomeAvulso.trim()) {
      setErro('Informe o nome do cliente avulso');
      return;
    }

    if (incluirPagamento) {
      if (!formaPagamentoId) {
        setErro('Selecione uma forma de pagamento');
        return;
      }
      if (!valorPagamento || parseFloat(valorPagamento) <= 0) {
        setErro('Informe um valor válido para o pagamento');
        return;
      }
      if (parseFloat(valorPagamento) > valorTotalCarrinho) {
        setErro(`O valor do pagamento não pode ser maior que o valor total (${formatarMoeda(valorTotalCarrinho)})`);
        return;
      }
    }

    try {
      setSalvando(true);
      setErro('');

      const payload: CriarVendaRapidaPayload = {
        pointId: usuario.pointIdGestor,
        usuarioId: tipoCliente === 'cadastrado' ? usuarioId : null,
        nomeAvulso: tipoCliente === 'avulso' ? nomeAvulso : undefined,
        telefoneAvulso: tipoCliente === 'avulso' ? telefoneAvulso : undefined,
        observacoes: observacoesCard || undefined,
        itens: carrinho.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          observacoes: item.observacoes,
        })),
        pagamento: incluirPagamento
          ? {
              formaPagamentoId,
              valor: parseFloat(valorPagamento),
              observacoes: observacoesPagamento || undefined,
            }
          : undefined,
      };

      console.log('Enviando venda rápida:', payload);
      
      // Adicionar timeout para evitar travamento
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: A requisição demorou mais de 30 segundos')), 30000);
      });
      
      const vendaPromise = cardClienteService.criarVendaRapida(payload);
      
      const cardCriado = await Promise.race([vendaPromise, timeoutPromise]) as any;
      console.log('Venda criada com sucesso:', cardCriado);
      
      // Sucesso - resetar e fechar
      resetarFormulario();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error);
      console.error('Tipo do erro:', typeof error);
      console.error('Detalhes do erro:', {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        status: error?.status || error?.response?.status,
        stack: error?.stack,
      });
      
      const mensagemErro = error?.response?.data?.mensagem 
        || error?.data?.mensagem
        || error?.message 
        || 'Erro ao finalizar venda. Verifique o console para mais detalhes.';
      setErro(mensagemErro);
    } finally {
      // Sempre resetar o estado de salvando, mesmo em caso de erro
      console.log('Resetando estado salvando para false');
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Nova Venda</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {erro}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <div className="space-y-6">
              {/* Seleção de Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <div className="flex gap-4 mb-3">
                  <button
                    type="button"
                    onClick={() => setTipoCliente('avulso')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                      tipoCliente === 'avulso'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cliente Avulso
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoCliente('cadastrado')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                      tipoCliente === 'cadastrado'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cliente Cadastrado
                  </button>
                </div>

                {tipoCliente === 'avulso' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={nomeAvulso}
                        onChange={(e) => setNomeAvulso(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (opcional)</label>
                      <input
                        type="text"
                        value={telefoneAvulso}
                        onChange={(e) => setTelefoneAvulso(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="Telefone"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Cliente *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={buscaCliente}
                        onChange={(e) => {
                          setBuscaCliente(e.target.value);
                          setMostrarListaClientes(true);
                        }}
                        onFocus={() => {
                          if (clientes.length === 0) {
                            carregarClientes();
                          }
                          setMostrarListaClientes(true);
                        }}
                        onBlur={() => {
                          // Delay para permitir clique no item da lista
                          setTimeout(() => setMostrarListaClientes(false), 200);
                        }}
                        placeholder="Buscar cliente por nome ou email..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    
                    {mostrarListaClientes && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {carregandoClientes ? (
                          <div className="p-4 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                            Carregando clientes...
                          </div>
                        ) : clientesFiltrados.length > 0 ? (
                          <div>
                            {clientesFiltrados.map((cliente) => (
                              <div
                                key={cliente.id}
                                onClick={() => {
                                  setUsuarioId(String(cliente.id));
                                  setBuscaCliente(cliente.name);
                                  setMostrarListaClientes(false);
                                }}
                                className={`p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 ${
                                  usuarioId === String(cliente.id) ? 'bg-emerald-100' : ''
                                }`}
                              >
                                <div className="font-medium text-gray-900">{cliente.name}</div>
                                <div className="text-sm text-gray-600">{cliente.email}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            {buscaCliente.trim() ? 'Nenhum cliente encontrado' : 'Digite para buscar clientes'}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {usuarioId && (
                      <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-emerald-900">
                              {clientes.find((c) => String(c.id) === usuarioId)?.name}
                            </p>
                            <p className="text-xs text-emerald-700">
                              {clientes.find((c) => String(c.id) === usuarioId)?.email}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUsuarioId('');
                              setBuscaCliente('');
                            }}
                            className="text-emerald-600 hover:text-emerald-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Busca e Adição de Produtos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adicionar Produto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    placeholder="Buscar produto por nome ou descrição..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {buscaProduto && produtosFiltrados.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    {produtosFiltrados.map((produto) => (
                      <button
                        key={produto.id}
                        type="button"
                        onClick={() => adicionarItemAoCarrinho(produto)}
                        className="w-full p-3 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{produto.nome}</div>
                        {produto.descricao && (
                          <div className="text-sm text-gray-600">{produto.descricao}</div>
                        )}
                        <div className="text-sm font-semibold text-emerald-600 mt-1">
                          {formatarMoeda(produto.precoVenda)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Carrinho */}
              {carrinho.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Itens ({carrinho.length})
                  </label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {carrinho.map((item) => (
                      <div key={item.produtoId} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.produto.nome}</div>
                            <div className="text-sm text-gray-600">
                              {formatarMoeda(item.precoUnitario)} cada
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removerItemDoCarrinho(item.produtoId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-3 items-center">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Qtd:</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => atualizarQuantidadeItem(item.produtoId, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Preço:</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={typeof item.precoUnitario === 'number' ? item.precoUnitario.toFixed(2) : '0.00'}
                              onChange={(e) => atualizarPrecoUnitario(item.produtoId, e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div className="ml-auto font-semibold text-emerald-600">
                            {formatarMoeda(item.precoTotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-emerald-600">
                        {formatarMoeda(valorTotalCarrinho)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações do Card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={observacoesCard}
                  onChange={(e) => setObservacoesCard(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Pagamento */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={incluirPagamento}
                    onChange={(e) => setIncluirPagamento(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Incluir pagamento</span>
                </label>

                {incluirPagamento && (
                  <div className="mt-3 space-y-3 pl-6 border-l-2 border-emerald-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Forma de Pagamento *
                      </label>
                      <select
                        value={formaPagamentoId}
                        onChange={(e) => setFormaPagamentoId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Selecione...</option>
                        {formasPagamento.map((forma) => (
                          <option key={forma.id} value={forma.id}>
                            {forma.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={valorTotalCarrinho}
                        value={valorPagamento}
                        onChange={(e) => setValorPagamento(e.target.value)}
                        placeholder={valorTotalCarrinho.toFixed(2)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setValorPagamento(valorTotalCarrinho.toFixed(2))}
                        className="mt-1 text-sm text-emerald-600 hover:text-emerald-700 underline"
                      >
                        Usar valor total
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações (opcional)
                      </label>
                      <textarea
                        value={observacoesPagamento}
                        onChange={(e) => setObservacoesPagamento(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={finalizarVenda}
            disabled={salvando || !formularioValido}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={
              !formularioValido
                ? carrinho.length === 0
                  ? 'Adicione pelo menos um item ao carrinho'
                  : tipoCliente === 'avulso' && (!nomeAvulso || nomeAvulso.trim() === '')
                  ? 'Informe o nome do cliente'
                  : tipoCliente === 'cadastrado' && !usuarioId
                  ? 'Selecione um cliente cadastrado'
                  : incluirPagamento && !formaPagamentoId
                  ? 'Selecione uma forma de pagamento'
                  : incluirPagamento && (!valorPagamento || parseFloat(valorPagamento) <= 0)
                  ? 'Informe um valor válido para o pagamento'
                  : incluirPagamento && parseFloat(valorPagamento) > valorTotalCarrinho
                  ? 'O valor do pagamento não pode ser maior que o total'
                  : 'Preencha todos os campos obrigatórios'
                : ''
            }
          >
            {salvando 
              ? (podeFinalizar ? 'Finalizando...' : 'Salvando...') 
              : (podeFinalizar ? 'Finalizar Venda' : 'Salvar')
            }
          </button>
        </div>
      </div>
    </div>
  );
}

