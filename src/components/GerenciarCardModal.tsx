// components/GerenciarCardModal.tsx - Modal para gerenciar card (adicionar itens e pagamentos)
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService, itemCardService, pagamentoCardService, produtoService, formaPagamentoService } from '@/services/gestaoArenaService';
import type { CardCliente, Produto, FormaPagamento, CriarItemCardPayload, CriarPagamentoCardPayload } from '@/types/gestaoArena';
import { api } from '@/lib/api';
import { X, Plus, Trash2, ShoppingCart, CreditCard, DollarSign, CheckCircle, XCircle, Clock, User, UserPlus, Edit, Search, FileText } from 'lucide-react';
import InputMonetario from './InputMonetario';

interface GerenciarCardModalProps {
  isOpen: boolean;
  card: CardCliente | null;
  onClose: () => void;
  onSuccess: (cardAtualizado?: CardCliente) => void;
  onEditar?: () => void;
}

export default function GerenciarCardModal({ isOpen, card, onClose, onSuccess, onEditar }: GerenciarCardModalProps) {
  const { usuario, isAdmin, isOrganizer } = useAuth();
  const canGerenciarCard = isAdmin || isOrganizer;
  const [cardCompleto, setCardCompleto] = useState<CardCliente | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  
  // Itens locais (não salvos ainda)
  const [itensLocais, setItensLocais] = useState<Array<{
    id: string; // ID temporário para itens novos
    produtoId: string;
    quantidade: number;
    precoUnitario: number;
    precoTotal: number;
    observacoes?: string;
    isNovo: boolean; // true se é novo, false se já existe no backend
    itemIdBackend?: string; // ID do backend se já existe
  }>>([]);
  const [itensRemovidos, setItensRemovidos] = useState<string[]>([]); // IDs de itens removidos
  
  // Pagamentos locais (não salvos ainda)
  const [pagamentosLocais, setPagamentosLocais] = useState<Array<{
    id: string; // ID temporário para pagamentos novos
    formaPagamentoId: string;
    valor: number;
    observacoes?: string;
    itemIds?: string[];
    isNovo: boolean; // true se é novo, false se já existe no backend
    pagamentoIdBackend?: string; // ID do backend se já existe
  }>>([]);
  const [pagamentosRemovidos, setPagamentosRemovidos] = useState<string[]>([]); // IDs de pagamentos removidos
  const [temAlteracoesNaoSalvas, setTemAlteracoesNaoSalvas] = useState(false);

  // Estados para adicionar item
  const [modalItemAberto, setModalItemAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [quantidadeItem, setQuantidadeItem] = useState(1);
  const [precoUnitarioItem, setPrecoUnitarioItem] = useState<number | null>(null);
  const inputBuscaItemRef = useRef<HTMLInputElement>(null);

  // Estados para adicionar pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState('');
  const [valorPagamento, setValorPagamento] = useState<number | null>(null);
  const [observacoesPagamento, setObservacoesPagamento] = useState('');
  const [itensSelecionadosPagamento, setItensSelecionadosPagamento] = useState<string[]>([]);

  // Estados para modal de confirmação de senha
  const [modalConfirmarSenhaAberto, setModalConfirmarSenhaAberto] = useState(false);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');


  useEffect(() => {
    if (isOpen && card) {
      carregarDados();
      // Resetar estados locais ao abrir
      setItensLocais([]);
      setItensRemovidos([]);
      setPagamentosLocais([]);
      setPagamentosRemovidos([]);
      setTemAlteracoesNaoSalvas(false);
    }
  }, [isOpen, card]);


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
    if (!card || !usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      setErro('');

      const [cardData, produtosData, formasData] = await Promise.all([
        cardClienteService.obter(card.id, true, true, false), // incluirAgendamentos: false
        produtoService.listar(usuario.pointIdGestor, true),
        formaPagamentoService.listar(usuario.pointIdGestor, true),
      ]);

      setCardCompleto(cardData);
      setProdutos(produtosData);
      setFormasPagamento(formasData);
      
      // Debug: verificar se observacoes está sendo carregado
      console.log('Card carregado - observacoes:', cardData.observacoes, 'tipo:', typeof cardData.observacoes);
      
      // Inicializar itens locais com os itens do backend
      if (cardData.itens) {
        setItensLocais(
          cardData.itens.map((item) => ({
            id: item.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            precoTotal: item.precoTotal,
            observacoes: item.observacoes || undefined,
            isNovo: false,
            itemIdBackend: item.id,
          }))
        );
      } else {
        setItensLocais([]);
      }
      
      // Inicializar pagamentos locais com os pagamentos do backend
      if (cardData.pagamentos) {
        setPagamentosLocais(
          cardData.pagamentos.map((pag) => ({
            id: pag.id,
            formaPagamentoId: pag.formaPagamentoId,
            valor: pag.valor,
            observacoes: pag.observacoes || undefined,
            itemIds: pag.itens?.map((i) => i.id),
            isNovo: false,
            pagamentoIdBackend: pag.id,
          }))
        );
      } else {
        setPagamentosLocais([]);
      }

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

  const adicionarItem = () => {
    if (!cardCompleto || !produtoSelecionado) {
      setErro('Selecione um produto');
      return;
    }

    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) {
      setErro('Produto não encontrado');
      return;
    }

    const precoUnitario = precoUnitarioItem || parseFloat(produto.precoVenda.toString());
    const precoTotal = precoUnitario * quantidadeItem;

    // Adicionar item localmente (não salvar no backend ainda)
    const novoItem = {
      id: `temp-${Date.now()}`, // ID temporário
      produtoId: produtoSelecionado,
      quantidade: quantidadeItem,
      precoUnitario: precoUnitario,
      precoTotal: precoTotal,
      observacoes: undefined,
      isNovo: true,
    };

    setItensLocais((prev) => [...prev, novoItem]);
    setTemAlteracoesNaoSalvas(true);
    fecharModalItem();
  };

  const removerItem = (itemId: string) => {
    if (!cardCompleto || !confirm('Tem certeza que deseja remover este item?')) return;

    // Encontrar o item para verificar se é novo ou já existe no backend
    const item = itensLocais.find((i) => i.id === itemId);
    
    if (item && !item.isNovo && item.itemIdBackend) {
      // Se já existe no backend, marcar para remoção
      setItensRemovidos((prev) => [...prev, item.itemIdBackend!]);
    }
    
    // Remover da lista local
    setItensLocais((prev) => prev.filter((i) => i.id !== itemId));
    setTemAlteracoesNaoSalvas(true);
  };

  const abrirModalPagamento = () => {
    setFormaPagamentoSelecionada('');
    setValorPagamento(null);
    setObservacoesPagamento('');
    setItensSelecionadosPagamento([]);
    setModalPagamentoAberto(true);
  };

  const toggleItemPagamento = (itemId: string) => {
    setItensSelecionadosPagamento((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const calcularValorItensSelecionados = () => {
    if (itensLocais.length === 0 || itensSelecionadosPagamento.length === 0) return 0;
    return itensLocais
      .filter((item) => itensSelecionadosPagamento.includes(item.id))
      .reduce((sum, item) => sum + item.precoTotal, 0);
  };

  const fecharModalPagamento = () => {
    setModalPagamentoAberto(false);
    setErro('');
  };

  const adicionarPagamento = () => {
    if (!cardCompleto || !formaPagamentoSelecionada || valorPagamento === null || valorPagamento <= 0) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }

    const valor = valorPagamento;

    // Se há itens selecionados, validar valor
    if (itensSelecionadosPagamento.length > 0) {
      const valorItens = calcularValorItensSelecionados();
      if (valor > valorItens) {
        setErro(`O valor do pagamento (R$ ${valor.toFixed(2)}) não pode ser maior que o valor dos itens selecionados (R$ ${valorItens.toFixed(2)})`);
        return;
      }
    }

    // Adicionar pagamento localmente (não salvar no backend ainda)
    const novoPagamento = {
      id: `temp-${Date.now()}`, // ID temporário
      formaPagamentoId: formaPagamentoSelecionada,
      valor: valor,
      observacoes: observacoesPagamento || undefined,
      itemIds: itensSelecionadosPagamento.length > 0 ? itensSelecionadosPagamento : undefined,
      isNovo: true,
    };

    setPagamentosLocais((prev) => [...prev, novoPagamento]);
    setTemAlteracoesNaoSalvas(true);
    fecharModalPagamento();
  };

  const removerPagamento = (pagamentoId: string) => {
    if (!cardCompleto || !confirm('Tem certeza que deseja remover este pagamento?')) return;

    // Encontrar o pagamento para verificar se é novo ou já existe no backend
    const pagamento = pagamentosLocais.find((p) => p.id === pagamentoId);
    
    if (pagamento && !pagamento.isNovo && pagamento.pagamentoIdBackend) {
      // Se já existe no backend, marcar para remoção
      setPagamentosRemovidos((prev) => [...prev, pagamento.pagamentoIdBackend!]);
    }
    
    // Remover da lista local
    setPagamentosLocais((prev) => prev.filter((p) => p.id !== pagamentoId));
    setTemAlteracoesNaoSalvas(true);
  };

  const salvarAlteracoes = async (fecharAposSalvar: boolean = false) => {
    if (!cardCompleto) return;

    try {
      setSalvando(true);
      setErro('');

      // Mapear IDs temporários para IDs reais dos itens
      const mapeamentoIds: Record<string, string> = {};

      // Remover itens marcados para remoção
      for (const itemId of itensRemovidos) {
        await itemCardService.deletar(cardCompleto.id, itemId);
      }

      // Adicionar novos itens e armazenar mapeamento de IDs temporários para reais
      const itensNovos = itensLocais.filter((i) => i.isNovo);
      for (const item of itensNovos) {
        const payload: CriarItemCardPayload = {
          cardId: cardCompleto.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          observacoes: item.observacoes,
        };
        const itemSalvo = await itemCardService.criar(cardCompleto.id, payload);
        // Mapear ID temporário para ID real retornado pela API
        if (item.id.startsWith('temp-')) {
          mapeamentoIds[item.id] = itemSalvo.id;
        }
        // Atualizar estado local: marcar item como salvo e atualizar ID
        setItensLocais((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  id: itemSalvo.id,
                  isNovo: false,
                  itemIdBackend: itemSalvo.id,
                }
              : i
          )
        );
      }

      // Remover pagamentos marcados para remoção
      for (const pagamentoId of pagamentosRemovidos) {
        await pagamentoCardService.deletar(cardCompleto.id, pagamentoId);
      }

      // Adicionar novos pagamentos, substituindo IDs temporários pelos reais
      const pagamentosNovos = pagamentosLocais.filter((p) => p.isNovo);
      for (const pagamento of pagamentosNovos) {
        // Substituir IDs temporários pelos IDs reais
        const itemIdsReais = pagamento.itemIds?.map((itemId) => {
          // Se é um ID temporário e existe no mapeamento, usar o ID real
          if (itemId.startsWith('temp-') && mapeamentoIds[itemId]) {
            return mapeamentoIds[itemId];
          }
          // Se não é temporário, usar o ID original
          return itemId;
        });

        const payload: CriarPagamentoCardPayload = {
          cardId: cardCompleto.id,
          formaPagamentoId: pagamento.formaPagamentoId,
          valor: pagamento.valor,
          observacoes: pagamento.observacoes,
          itemIds: itemIdsReais,
        };
        const pagamentoSalvo = await pagamentoCardService.criar(cardCompleto.id, payload);
        // Atualizar estado local: marcar pagamento como salvo e atualizar ID
        setPagamentosLocais((prev) =>
          prev.map((p) =>
            p.id === pagamento.id
              ? {
                  ...p,
                  id: pagamentoSalvo.id,
                  isNovo: false,
                  pagamentoIdBackend: pagamentoSalvo.id,
                  // Atualizar itemIds com IDs reais
                  itemIds: itemIdsReais,
                }
              : p
          )
        );
      }

      // Recarregar dados e resetar estados locais
      await carregarDados();
      setItensRemovidos([]);
      setPagamentosRemovidos([]);
      setTemAlteracoesNaoSalvas(false);
      
      // Se deve fechar após salvar, fazer isso antes de fechar o modal
      if (fecharAposSalvar) {
        await cardClienteService.atualizar(cardCompleto.id, { status: 'FECHADO' });
        await carregarDados();
      }
      
      // Passar o card atualizado para o callback, se disponível
      if (cardCompleto) {
        // Buscar card atualizado com todos os dados
        const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
        onSuccess(cardAtualizado);
      } else {
        onSuccess();
      }
      onClose(); // Fechar o modal após salvar
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar alterações');
      // Em caso de erro, recarregar dados para sincronizar estado
      await carregarDados();
    } finally {
      setSalvando(false);
    }
  };

  const fecharCard = async () => {
    if (!cardCompleto) return;

    // Se há alterações não salvas, perguntar se quer salvar antes de fechar
    if (temAlteracoesNaoSalvas) {
      const salvarAntes = confirm('Há alterações não salvas. Deseja salvá-las antes de fechar o card?');
      if (salvarAntes) {
        await salvarAlteracoes(true); // Salvar e fechar
        return; // salvarAlteracoes já fecha o modal
      } else {
        // Se não quer salvar, pergunta se quer descartar as alterações e fechar mesmo assim
        if (!confirm('As alterações não salvas serão descartadas. Deseja continuar fechando o card?')) {
          return;
        }
      }
    }

    if (!confirm('Tem certeza que deseja fechar este card?')) return;

    try {
      await cardClienteService.atualizar(cardCompleto.id, { status: 'FECHADO' });
      await carregarDados();
      // Buscar card atualizado e passar para o callback
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
      onSuccess(cardAtualizado);
      onClose(); // Fechar o modal após fechar o card
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao fechar card');
    }
  };

  const cancelarCard = async () => {
    if (!cardCompleto) return;

    // Confirmação rigorosa para evitar cliques acidentais
    const confirmacao1 = confirm('⚠️ ATENÇÃO: Você está prestes a CANCELAR este card.\n\nEsta ação é IRREVERSÍVEL e todos os dados serão perdidos.\n\nDeseja realmente continuar?');
    if (!confirmacao1) return;

    const confirmacao2 = confirm('⚠️ ÚLTIMA CONFIRMAÇÃO:\n\nTem CERTEZA ABSOLUTA que deseja CANCELAR este card?\n\nEsta ação não pode ser desfeita.');
    if (!confirmacao2) return;

    try {
      await cardClienteService.atualizar(cardCompleto.id, { status: 'CANCELADO' });
      // Buscar card atualizado e passar para o callback
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
      onClose();
      onSuccess(cardAtualizado);
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao cancelar card');
    }
  };

  const abrirModalConfirmarSenha = () => {
    setSenhaConfirmacao('');
    setErroSenha('');
    setModalConfirmarSenhaAberto(true);
  };

  const fecharModalConfirmarSenha = () => {
    setModalConfirmarSenhaAberto(false);
    setSenhaConfirmacao('');
    setErroSenha('');
  };

  const reabrirCard = async () => {
    if (!cardCompleto) return;

    if (!senhaConfirmacao.trim()) {
      setErroSenha('Digite sua senha');
      return;
    }

    try {
      setValidandoSenha(true);
      setErroSenha('');

      // Validar senha primeiro
      const response = await api.post('/user/auth/validate-password', {
        password: senhaConfirmacao,
      });

      if (!response.data.valido) {
        setErroSenha('Senha incorreta');
        return;
      }

      // Se a senha for válida, fechar modal de senha e reabrir o card
      fecharModalConfirmarSenha();

      await cardClienteService.atualizar(cardCompleto.id, { status: 'ABERTO' });
      await carregarDados();
      // Buscar card atualizado e passar para o callback
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, true, true, false);
      onSuccess(cardAtualizado);
    } catch (error: any) {
      const mensagemErro = error?.response?.data?.mensagem || 'Erro ao validar senha ou reabrir card';
      setErroSenha(mensagemErro);
    } finally {
      setValidandoSenha(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarDataHora = (dataHora: string) => {
    return new Date(dataHora).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ABERTO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Aberto</span>;
      case 'FECHADO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Fechado</span>;
      case 'CANCELADO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelado</span>;
    }
  };

  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Card #{card.numeroCard}</h2>
              <div className="mt-2">{cardCompleto && getStatusBadge(cardCompleto.status)}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando...</p>
          </div>
        ) : cardCompleto ? (
          <div className="p-6 space-y-6">
            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            {/* Informações do Cliente */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Cliente</h3>
                  {cardCompleto.usuario ? (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">{cardCompleto.usuario.name}</div>
                        <div className="text-sm text-gray-600">{cardCompleto.usuario.email}</div>
                      </div>
                    </div>
                  ) : cardCompleto.nomeAvulso ? (
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">{cardCompleto.nomeAvulso}</div>
                        {cardCompleto.telefoneAvulso && (
                          <div className="text-sm text-gray-600">{cardCompleto.telefoneAvulso}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Cliente não informado</div>
                  )}
                </div>
                {cardCompleto.status === 'ABERTO' && onEditar && (
                  <button
                    onClick={() => {
                      onClose();
                      onEditar();
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* Observações do Card */}
            {cardCompleto.observacoes && typeof cardCompleto.observacoes === 'string' && cardCompleto.observacoes.trim() !== '' && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900 mb-1">Observações</h3>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{cardCompleto.observacoes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Resumo Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const valorTotalItens = itensLocais.reduce((sum, item) => sum + item.precoTotal, 0);
                const valorTotalLocal = valorTotalItens;
                const totalPagoLocal = pagamentosLocais.reduce((sum, pag) => sum + pag.valor, 0);
                const saldoLocal = valorTotalLocal - totalPagoLocal;
                return (
                  <>
                    <div className={`p-4 rounded-lg ${temAlteracoesNaoSalvas ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-50'}`}>
                      <div className="text-sm text-gray-600 mb-1">
                        Valor Total {temAlteracoesNaoSalvas && <span className="text-yellow-600">(não salvo)</span>}
                      </div>
                      <div className="text-xl font-bold text-gray-900">{formatarMoeda(valorTotalLocal)}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${temAlteracoesNaoSalvas ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-green-50'}`}>
                      <div className="text-sm text-gray-600 mb-1">
                        Total Pago {temAlteracoesNaoSalvas && <span className="text-yellow-600">(não salvo)</span>}
                      </div>
                      <div className="text-xl font-bold text-green-700">{formatarMoeda(totalPagoLocal)}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${saldoLocal > 0 ? 'bg-red-50' : 'bg-green-50'} ${temAlteracoesNaoSalvas ? 'border-2 border-yellow-300' : ''}`}>
                      <div className="text-sm text-gray-600 mb-1">
                        Saldo {temAlteracoesNaoSalvas && <span className="text-yellow-600">(não salvo)</span>}
                      </div>
                      <div className={`text-xl font-bold ${saldoLocal > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {formatarMoeda(saldoLocal)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Itens */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Itens
                </h3>
                {cardCompleto.status === 'ABERTO' && (
                  <button
                    onClick={abrirModalItem}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                )}
              </div>
              {itensLocais.length > 0 ? (
                <div className="space-y-2">
                  {itensLocais.map((item) => {
                    const produto = produtos.find((p) => p.id === item.produtoId);
                    return (
                      <div 
                        key={item.id} 
                        className={`flex justify-between items-center p-3 rounded-lg ${
                          item.isNovo 
                            ? 'bg-yellow-50 border-2 border-yellow-300' 
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{produto?.nome || 'Produto'}</span>
                            {item.isNovo && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                                Não salvo
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {item.quantidade}x {formatarMoeda(item.precoUnitario)} = {formatarMoeda(item.precoTotal)}
                          </div>
                          {item.observacoes && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              {item.observacoes}
                            </div>
                          )}
                        </div>
                        {cardCompleto.status === 'ABERTO' && (
                          <button
                            onClick={() => removerItem(item.id)}
                            className="ml-3 p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  Nenhum item adicionado
                </div>
              )}
            </div>

            {/* Pagamentos */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Pagamentos
                </h3>
                {cardCompleto.status === 'ABERTO' && (
                  <button
                    onClick={abrirModalPagamento}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Pagamento
                  </button>
                )}
              </div>
              {pagamentosLocais.length > 0 ? (
                <div className="space-y-2">
                  {pagamentosLocais.map((pagamento) => {
                    const formaPagamento = formasPagamento.find((fp) => fp.id === pagamento.formaPagamentoId);
                    const itensDoPagamento = pagamento.itemIds 
                      ? itensLocais.filter((item) => pagamento.itemIds?.includes(item.id))
                      : [];
                    
                    return (
                      <div 
                        key={pagamento.id} 
                        className={`p-3 rounded-lg border-2 ${
                          pagamento.isNovo 
                            ? 'bg-yellow-50 border-yellow-300' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {formaPagamento?.nome || 'Forma de Pagamento'}
                              </span>
                              {pagamento.isNovo && (
                                <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                                  Não salvo
                                </span>
                              )}
                            </div>
                            {!pagamento.isNovo && (() => {
                              const pagBackend = cardCompleto.pagamentos?.find((p) => p.id === pagamento.pagamentoIdBackend);
                              return pagBackend?.createdAt ? (
                                <div className="text-sm text-gray-600">
                                  {formatarData(pagBackend.createdAt)}
                                </div>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-green-600">{formatarMoeda(pagamento.valor)}</div>
                            {cardCompleto.status === 'ABERTO' && (
                              <button
                                onClick={() => removerPagamento(pagamento.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {itensDoPagamento.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs font-medium text-blue-900 mb-1">Itens pagos neste pagamento:</div>
                            <div className="space-y-1">
                              {itensDoPagamento.map((item) => {
                                const produto = produtos.find((p) => p.id === item.produtoId);
                                return (
                                  <div key={item.id} className="text-sm text-blue-800">
                                    • {produto?.nome || 'Produto não encontrado'} - {formatarMoeda(item.precoTotal)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {pagamento.observacoes && (
                          <div className="text-sm text-gray-600 mt-2 italic">
                            {pagamento.observacoes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  Nenhum pagamento registrado
                </div>
              )}
            </div>


            {/* Ações */}
            {cardCompleto && (() => {
              const valorTotalItens = itensLocais.reduce((sum, item) => sum + item.precoTotal, 0);
              const valorTotalLocal = valorTotalItens;
              const totalPagoLocal = pagamentosLocais.reduce((sum, pag) => sum + pag.valor, 0);
              const saldoLocal = valorTotalLocal - totalPagoLocal;
              const saldoIgualZero = Math.abs(saldoLocal) < 0.01; // Permitir pequenas diferenças de arredondamento
              
              return (
                <div className="pt-4 border-t border-gray-200">
                  {cardCompleto?.status === 'ABERTO' ? (
                    <>
                      {temAlteracoesNaoSalvas && (
                        <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                          <div className="text-yellow-800 font-medium mb-3">
                            ⚠️ Alterações não salvas
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={salvarAlteracoes}
                              disabled={salvando}
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {salvando ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                            {saldoIgualZero && (
                              <button
                                onClick={() => salvarAlteracoes(true)}
                                disabled={salvando}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {salvando ? 'Salvando...' : 'Salvar e Fechar Card'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {!temAlteracoesNaoSalvas && (
                        <div className="flex gap-3 mb-3">
                          <button
                            onClick={fecharCard}
                            disabled={!saldoIgualZero}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!saldoIgualZero ? 'O saldo deve ser zero para fechar o card' : ''}
                          >
                            Fechar Card
                          </button>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-3">
                        <button
                          onClick={cancelarCard}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                        >
                          ⚠️ Cancelar Card (Irreversível)
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          Esta ação não pode ser desfeita
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {canGerenciarCard && (
                        <div className="mb-3">
                          <button
                            onClick={abrirModalConfirmarSenha}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            {cardCompleto?.status === 'FECHADO' ? 'Reabrir Card' : 'Reabrir Card (Cancelado)'}
                          </button>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs text-gray-500 text-center">
                          {cardCompleto?.status === 'FECHADO' 
                            ? 'Este card está fechado' 
                            : 'Este card está cancelado'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* Modal Adicionar Item */}
        {modalItemAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                      placeholder="Buscar produto por nome ou descrição..."
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
                    disabled={!produtoSelecionado}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Adicionar
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

        {/* Modal Adicionar Pagamento */}
        {modalPagamentoAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Adicionar Pagamento</h3>
              {erro && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={formaPagamentoSelecionada}
                    onChange={(e) => setFormaPagamentoSelecionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Selecione uma forma de pagamento</option>
                    {formasPagamento.map((forma) => (
                      <option key={forma.id} value={forma.id}>
                        {forma.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seleção de Itens */}
                {itensLocais.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecionar Itens para Pagamento (opcional)
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto bg-gray-50">
                      {itensLocais.map((item) => {
                        const produto = produtos.find((p) => p.id === item.produtoId);
                        const isSelected = itensSelecionadosPagamento.includes(item.id);
                        // Verificar se o item já está totalmente pago usando pagamentos locais
                        let totalPagoItem = 0;
                        for (const pag of pagamentosLocais) {
                          if (pag.itemIds?.includes(item.id)) {
                            const itensDoPagamento = itensLocais.filter((i) => pag.itemIds?.includes(i.id));
                            const valorTotalItensPagamento = itensDoPagamento.reduce((sum, i) => sum + i.precoTotal, 0);
                            if (valorTotalItensPagamento > 0) {
                              const proporcaoItem = item.precoTotal / valorTotalItensPagamento;
                              totalPagoItem += pag.valor * proporcaoItem;
                            }
                          }
                        }
                        
                        const saldoItem = item.precoTotal - totalPagoItem;
                        const podeSelecionar = saldoItem > 0.01; // Permitir pequenas diferenças de arredondamento

                        return (
                          <div
                            key={item.id}
                            className={`p-3 mb-2 rounded-lg border-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50'
                                : podeSelecionar
                                ? 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                                : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                            }`}
                            onClick={() => podeSelecionar && toggleItemPagamento(item.id)}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                disabled={!podeSelecionar}
                                className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {produto?.nome || 'Produto não encontrado'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {item.quantidade}x {formatarMoeda(item.precoUnitario)} = {formatarMoeda(item.precoTotal)}
                                </div>
                                {saldoItem < item.precoTotal && (
                                  <div className="text-xs text-orange-600 mt-1">
                                    Já pago: {formatarMoeda(totalPagoItem)} | Saldo: {formatarMoeda(saldoItem)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {itensSelecionadosPagamento.length > 0 && (
                      <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="text-sm font-medium text-emerald-900">
                          Valor dos itens selecionados: {formatarMoeda(calcularValorItensSelecionados())}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <InputMonetario
                    label={itensSelecionadosPagamento.length > 0 ? 'Valor (será ajustado automaticamente se necessário)' : 'Valor'}
                    value={valorPagamento}
                    onChange={setValorPagamento}
                    placeholder={itensSelecionadosPagamento.length > 0 ? calcularValorItensSelecionados().toFixed(2) : "0,00"}
                    min={0}
                    required
                  />
                  {itensSelecionadosPagamento.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setValorPagamento(calcularValorItensSelecionados())}
                      className="mt-1 text-sm text-emerald-600 hover:text-emerald-700 underline"
                    >
                      Usar valor dos itens selecionados
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                  <textarea
                    value={observacoesPagamento}
                    onChange={(e) => setObservacoesPagamento(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={fecharModalPagamento}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={adicionarPagamento}
                    disabled={salvando || !formaPagamentoSelecionada || valorPagamento === null || valorPagamento <= 0}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {salvando ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmar Senha para Reabrir Card */}
        {modalConfirmarSenhaAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Senha</h3>
              <p className="text-sm text-gray-600 mb-4">
                Para reabrir este card, é necessário confirmar sua senha.
              </p>
              {erroSenha && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erroSenha}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                  <input
                    type="password"
                    value={senhaConfirmacao}
                    onChange={(e) => {
                      setSenhaConfirmacao(e.target.value);
                      setErroSenha('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !validandoSenha && senhaConfirmacao.trim()) {
                        reabrirCard();
                      }
                    }}
                    placeholder="Digite sua senha"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={fecharModalConfirmarSenha}
                    disabled={validandoSenha}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={reabrirCard}
                    disabled={validandoSenha || !senhaConfirmacao.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {validandoSenha ? 'Validando...' : 'Confirmar e Reabrir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

