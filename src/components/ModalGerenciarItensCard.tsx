// components/ModalGerenciarItensCard.tsx - Modal específico para gerenciar itens do card
'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService, itemCardService, produtoService } from '@/services/gestaoArenaService';
import type { CardCliente, Produto, ItemCard, CriarItemCardPayload } from '@/types/gestaoArena';
import { X, Plus, Trash2, ShoppingCart, Search } from 'lucide-react';
import InputMonetario from './InputMonetario';

interface ModalGerenciarItensCardProps {
  isOpen: boolean;
  card: CardCliente | null;
  onClose: () => void;
  onSuccess: (cardAtualizado?: CardCliente) => void;
}

export default function ModalGerenciarItensCard({ isOpen, card, onClose, onSuccess }: ModalGerenciarItensCardProps) {
  const { usuario } = useAuth();
  const [cardCompleto, setCardCompleto] = useState<CardCliente | null>(null);
  const [itens, setItens] = useState<ItemCard[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Estados para adicionar item
  const [modalItemAberto, setModalItemAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [quantidadeItem, setQuantidadeItem] = useState(1);
  const [precoUnitarioItem, setPrecoUnitarioItem] = useState<number | null>(null);
  const inputBuscaItemRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && card) {
      carregarDados();
    }
  }, [isOpen, card]);

  const carregarDados = async () => {
    if (!card || !usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      setErro('');

      const [cardData, produtosData, itensData] = await Promise.all([
        cardClienteService.obter(card.id, true, false, false),
        produtoService.listar(usuario.pointIdGestor, true),
        itemCardService.listar(card.id),
      ]);

      setCardCompleto(cardData);
      setProdutos(produtosData);
      setItens(itensData);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalItem = () => {
    setProdutoSelecionado('');
    setBuscaProduto('');
    setQuantidadeItem(1);
    setPrecoUnitarioItem(null);
    setModalItemAberto(true);
  };

  // Focar no campo de busca quando a modal de item abrir
  useEffect(() => {
    if (modalItemAberto && inputBuscaItemRef.current) {
      // Pequeno delay para garantir que o DOM está pronto
      setTimeout(() => {
        inputBuscaItemRef.current?.focus();
      }, 100);
    }
  }, [modalItemAberto]);

  const fecharModalItem = () => {
    setModalItemAberto(false);
    setErro('');
  };

  const adicionarItem = async () => {
    if (!cardCompleto || !produtoSelecionado) {
      setErro('Selecione um produto');
      return;
    }

    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) {
      setErro('Produto não encontrado');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      const precoUnitario = precoUnitarioItem || parseFloat(produto.precoVenda.toString());
      const payload: CriarItemCardPayload = {
        cardId: cardCompleto.id,
        produtoId: produtoSelecionado,
        quantidade: quantidadeItem,
        precoUnitario: precoUnitario,
      };

      await itemCardService.criar(cardCompleto.id, payload);
      // Buscar card atualizado para refletir na listagem principal
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
      await carregarDados();
      onSuccess(cardAtualizado);
      fecharModalItem();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao adicionar item');
    } finally {
      setSalvando(false);
    }
  };

  const removerItem = async (itemId: string) => {
    if (!cardCompleto || !confirm('Tem certeza que deseja remover este item?')) return;

    try {
      setSalvando(true);
      await itemCardService.deletar(cardCompleto.id, itemId);
      // Buscar card atualizado para refletir na listagem principal
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
      await carregarDados();
      onSuccess(cardAtualizado);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao remover item');
    } finally {
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
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gerenciar Itens - Card #{cardCompleto?.numeroCard || card?.numeroCard}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {cardCompleto?.usuario?.name || cardCompleto?.nomeAvulso || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <>
              {erro && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}

              {/* Botão Adicionar Item + Acesso Rápido */}
              {cardCompleto?.status === 'ABERTO' && (
                <div className="mb-4 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={abrirModalItem}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Item
                    </button>
                    {/* Produtos de acesso rápido */}
                    {produtos
                      .filter((p) => p.acessoRapido)
                      .slice(0, 5)
                      .map((produto) => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={async () => {
                            if (!cardCompleto) return;
                            try {
                              setSalvando(true);
                              setErro('');
                              const precoUnitario = parseFloat(produto.precoVenda.toString());
                              const payload: CriarItemCardPayload = {
                                cardId: cardCompleto.id,
                                produtoId: produto.id,
                                quantidade: 1,
                                precoUnitario,
                              };
                              await itemCardService.criar(cardCompleto.id, payload);
                              const cardAtualizado = await cardClienteService.obter(
                                cardCompleto.id,
                                true,
                                true,
                                false,
                              );
                              await carregarDados();
                              onSuccess(cardAtualizado);
                            } catch (error: any) {
                              setErro(
                                error?.response?.data?.mensagem ||
                                  `Erro ao adicionar rapidamente o produto "${produto.nome}"`,
                              );
                            } finally {
                              setSalvando(false);
                            }
                          }}
                          className="px-3 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100 transition-colors"
                          title={`Adicionar 1x ${produto.nome}`}
                        >
                          {produto.nome}
                        </button>
                      ))}
                  </div>
                  {produtos.filter((p) => p.acessoRapido).length > 0 && (
                    <p className="text-[11px] text-gray-500">
                      Toque em um produto de acesso rápido para adicioná-lo diretamente ao card com quantidade 1 e
                      preço padrão.
                    </p>
                  )}
                </div>
              )}

              {/* Lista de Itens */}
              {itens.length > 0 ? (
                <div className="space-y-3">
                  {itens.map((item) => {
                    const produto = produtos.find((p) => p.id === item.produtoId);
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{produto?.nome || 'Produto'}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Quantidade: {item.quantidade} × {formatarMoeda(item.precoUnitario)} ={' '}
                            <span className="font-semibold text-gray-900">{formatarMoeda(item.precoTotal)}</span>
                          </div>
                          {item.observacoes && (
                            <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-100 rounded border-l-2 border-gray-300 italic">
                              {item.observacoes}
                            </div>
                          )}
                        </div>
                        {cardCompleto?.status === 'ABERTO' && (
                          <button
                            onClick={() => removerItem(item.id)}
                            disabled={salvando}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Remover item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum item adicionado ainda</p>
                </div>
              )}

              {/* Resumo */}
              {itens.length > 0 && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-emerald-700">
                      {formatarMoeda(itens.reduce((sum, item) => sum + item.precoTotal, 0))}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Adicionar Item */}
      {modalItemAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Adicionar Item</h3>
            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    ref={inputBuscaItemRef}
                    type="text"
                    value={buscaProduto}
                    onChange={(e) => {
                      setBuscaProduto(e.target.value);
                      if (!e.target.value) {
                        setProdutoSelecionado('');
                        setPrecoUnitarioItem(null);
                      }
                    }}
                    placeholder="Buscar produto..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-2"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                  {produtos
                    .filter((produto) => {
                      if (!buscaProduto) return false;
                      const buscaLower = buscaProduto.toLowerCase();
                      return (
                        produto.nome.toLowerCase().includes(buscaLower) ||
                        produto.descricao?.toLowerCase().includes(buscaLower)
                      );
                    })
                    .map((produto) => (
                      <button
                        key={produto.id}
                        type="button"
                        onClick={() => {
                          setProdutoSelecionado(produto.id);
                          setPrecoUnitarioItem(produto.precoVenda);
                          setBuscaProduto(produto.nome);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                          produtoSelecionado === produto.id ? 'bg-emerald-50' : ''
                        }`}
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
                  {buscaProduto && produtos.filter((produto) => {
                    const buscaLower = buscaProduto.toLowerCase();
                    return (
                      produto.nome.toLowerCase().includes(buscaLower) ||
                      produto.descricao?.toLowerCase().includes(buscaLower)
                    );
                  }).length === 0 && (
                    <div className="p-4 text-center text-gray-500">Nenhum produto encontrado</div>
                  )}
                  {!buscaProduto && (
                    <div className="p-4 text-center text-gray-500">Digite para buscar produtos</div>
                  )}
                </div>
                {produtoSelecionado && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                    <div className="text-sm font-medium text-emerald-900">
                      Produto selecionado: {produtos.find((p) => p.id === produtoSelecionado)?.nome}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={quantidadeItem}
                  onChange={(e) => setQuantidadeItem(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <InputMonetario
                  label="Preço Unitário (opcional)"
                  value={precoUnitarioItem}
                  onChange={setPrecoUnitarioItem}
                  placeholder="Usar preço do produto"
                  min={0}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={adicionarItem}
                  disabled={!produtoSelecionado || salvando}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {salvando ? 'Adicionando...' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={fecharModalItem}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  tabIndex={0}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

