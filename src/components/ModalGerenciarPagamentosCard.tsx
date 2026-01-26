// components/ModalGerenciarPagamentosCard.tsx - Modal específico para gerenciar pagamentos do card
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService, pagamentoCardService, itemCardService, formaPagamentoService } from '@/services/gestaoArenaService';
import type { CardCliente, FormaPagamento, PagamentoCard, ItemCard, CriarPagamentoCardPayload } from '@/types/gestaoArena';
import { X, Plus, Trash2, CreditCard, DollarSign } from 'lucide-react';
import InputMonetario from './InputMonetario';

interface ModalGerenciarPagamentosCardProps {
  isOpen: boolean;
  card: CardCliente | null;
  onClose: () => void;
  onSuccess: (cardAtualizado?: CardCliente) => void;
}

export default function ModalGerenciarPagamentosCard({ isOpen, card, onClose, onSuccess }: ModalGerenciarPagamentosCardProps) {
  const { usuario } = useAuth();
  const [cardCompleto, setCardCompleto] = useState<CardCliente | null>(null);
  const [pagamentos, setPagamentos] = useState<PagamentoCard[]>([]);
  const [itens, setItens] = useState<ItemCard[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Estados para adicionar pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState('');
  const [valorPagamento, setValorPagamento] = useState<number | null>(null);
  const [observacoesPagamento, setObservacoesPagamento] = useState('');
  const [itensSelecionadosPagamento, setItensSelecionadosPagamento] = useState<string[]>([]);
  const [numeroPessoas, setNumeroPessoas] = useState<number>(1);
  const [valorPorPessoa, setValorPorPessoa] = useState<number | null>(null);

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

      const [cardData, formasData, pagamentosData, itensData] = await Promise.all([
        cardClienteService.obter(card.id, false, true, false), // incluirAgendamentos: false
        formaPagamentoService.listar(usuario.pointIdGestor, true),
        pagamentoCardService.listar(card.id),
        itemCardService.listar(card.id),
      ]);

      const ordem = ['Pix', 'Cartão de Débito', 'Cartão de Crédito', 'Dinheiro', 'Infinite Pay', 'Conta Corrente'];
       const formasOrdenadas = [...formasData].sort((a, b) => {
         const indexA = ordem.indexOf(a.nome);
         const indexB = ordem.indexOf(b.nome);
         if (indexA !== -1 && indexB !== -1) return indexA - indexB;
         if (indexA !== -1) return -1;
         if (indexB !== -1) return 1;
         return a.nome.localeCompare(b.nome);
       });

      setCardCompleto(cardData);
      setFormasPagamento(formasOrdenadas);
      setPagamentos(pagamentosData);
      setItens(itensData);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalPagamento = () => {
    setFormaPagamentoSelecionada('');
    setValorPagamento(null);
    setObservacoesPagamento('');
    setItensSelecionadosPagamento([]);
    setNumeroPessoas(1);
    setValorPorPessoa(null);
    setModalPagamentoAberto(true);
  };

  const fecharModalPagamento = () => {
    setModalPagamentoAberto(false);
    setErro('');
  };

  const calcularValorItensSelecionados = () => {
    if (itens.length === 0 || itensSelecionadosPagamento.length === 0) return 0;
    return itens
      .filter((item) => itensSelecionadosPagamento.includes(item.id))
      .reduce((sum, item) => sum + item.precoTotal, 0);
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

  // Calcular saldo atual
  const calcularSaldo = () => {
    if (!cardCompleto) return 0;
    const valorTotalItens = itens.reduce((sum, item) => sum + item.precoTotal, 0);
    const totalPago = pagamentos.reduce((sum, pag) => sum + pag.valor, 0);
    return valorTotalItens - totalPago;
  };

  // Preencher valor automaticamente quando itens são selecionados ou quando modal abre
  useEffect(() => {
    if (!modalPagamentoAberto || !cardCompleto) return;
    
    if (itensSelecionadosPagamento.length > 0) {
      // Sempre atualizar o valor quando itens são selecionados
      const valorItens = calcularValorItensSelecionados();
      if (valorItens > 0) {
        setValorPagamento(valorItens);
      } else {
        setValorPagamento(0);
      }
    } else if (valorPagamento === null || valorPagamento === 0) {
      // Se não há itens selecionados e valor ainda não foi preenchido, usar saldo
      const saldo = calcularSaldo();
      if (saldo > 0) {
        setValorPagamento(saldo);
      } else {
        setValorPagamento(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensSelecionadosPagamento, modalPagamentoAberto, itens]);

  // Recalcular valor por pessoa quando valor ou numeroPessoas mudar
  useEffect(() => {
    if (numeroPessoas > 1 && valorPagamento !== null && valorPagamento > 0) {
      const novoValorPorPessoa = valorPagamento / numeroPessoas;
      if (valorPorPessoa !== novoValorPorPessoa) {
        setValorPorPessoa(novoValorPorPessoa);
      }
    } else if (numeroPessoas === 1) {
      setValorPorPessoa(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorPagamento, numeroPessoas]);

  const adicionarPagamento = async () => {
    if (!cardCompleto || !formaPagamentoSelecionada) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar número de pessoas (apenas para cálculo, não cria múltiplos pagamentos)
    if (numeroPessoas < 1 || numeroPessoas > 20) {
      setErro('Número de pessoas deve ser entre 1 e 20');
      return;
    }

    // Se está dividindo por pessoas, usar valorPorPessoa; senão, usar valorPagamento
    let valorFinal: number;
    if (numeroPessoas > 1) {
      if (valorPorPessoa === null || valorPorPessoa <= 0) {
        setErro('Informe o valor por pessoa');
        return;
      }
      valorFinal = valorPorPessoa;
    } else {
      if (valorPagamento === null || valorPagamento <= 0) {
        setErro('Preencha o valor do pagamento');
        return;
      }
      valorFinal = valorPagamento;
    }

    if (isNaN(valorFinal) || valorFinal <= 0) {
      setErro('Valor inválido');
      return;
    }

    // Se há itens selecionados, validar valor total
    if (itensSelecionadosPagamento.length > 0) {
      const valorItens = calcularValorItensSelecionados();
      const valorTotal = numeroPessoas > 1 ? valorPorPessoa! * numeroPessoas : valorPagamento!;
      if (valorTotal > valorItens) {
        setErro(`O valor total do pagamento (R$ ${valorTotal.toFixed(2)}) não pode ser maior que o valor dos itens selecionados (R$ ${valorItens.toFixed(2)})`);
        return;
      }
    }

    try {
      setSalvando(true);
      setErro('');

      // Criar apenas UM pagamento por vez (cada pessoa pode ter forma de pagamento diferente)
      const observacoesComPessoa = numeroPessoas > 1 
        ? `${observacoesPagamento || ''} (${numeroPessoas} pessoas dividindo)`.trim()
        : observacoesPagamento || undefined;

      const payload: CriarPagamentoCardPayload = {
        cardId: cardCompleto.id,
        formaPagamentoId: formaPagamentoSelecionada,
        valor: valorFinal,
        observacoes: observacoesComPessoa,
        itemIds: itensSelecionadosPagamento.length > 0 ? itensSelecionadosPagamento : undefined,
      };

      await pagamentoCardService.criar(cardCompleto.id, payload);
      
      // Buscar card atualizado para refletir na listagem principal
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, false, true, false);
      
      // Recalcular saldo ANTES de recarregar dados (usando o valor que acabamos de adicionar)
      const valorTotalItensAtual = itens.reduce((sum, item) => sum + item.precoTotal, 0);
      const totalPagoAtual = pagamentos.reduce((sum, pag) => sum + pag.valor, 0);
      const novoSaldo = valorTotalItensAtual - (totalPagoAtual + valorFinal);
      const saldoZerado = Math.abs(novoSaldo) < 0.01;
      
      await carregarDados();
      onSuccess(cardAtualizado);
      
      // Se o saldo zerou, fechar a modal independente de ter divisão ou não
      if (saldoZerado) {
        fecharModalPagamento();
      } else if (numeroPessoas > 1 && valorPorPessoa !== null) {
        // Se ainda há saldo e está dividindo por pessoas, manter os valores preenchidos mas limpar a forma de pagamento
        // para que o atendente possa adicionar o próximo pagamento com outra forma
        setFormaPagamentoSelecionada(''); // Limpar forma de pagamento para próximo pagamento
        setObservacoesPagamento(''); // Limpar observações
        setItensSelecionadosPagamento([]); // Limpar itens selecionados
        // Manter numeroPessoas e valorPorPessoa preenchidos
      } else {
        fecharModalPagamento();
      }
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao adicionar pagamento');
    } finally {
      setSalvando(false);
    }
  };

  const removerPagamento = async (pagamentoId: string) => {
    if (!cardCompleto || !confirm('Tem certeza que deseja remover este pagamento?')) return;

    try {
      setSalvando(true);
      await pagamentoCardService.deletar(cardCompleto.id, pagamentoId);
      // Buscar card atualizado para refletir na listagem principal
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, false, true, false);
      await carregarDados();
      onSuccess(cardAtualizado);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao remover pagamento');
    } finally {
      setSalvando(false);
    }
  };

  const fecharCard = async () => {
    if (!cardCompleto || !confirm('Tem certeza que deseja fechar esta comanda?')) return;

    try {
      setSalvando(true);
      setErro('');
      await cardClienteService.atualizar(cardCompleto.id, { status: 'FECHADO' });
      // Buscar card atualizado
      const cardAtualizado = await cardClienteService.obter(cardCompleto.id, false, true, false);
      onSuccess(cardAtualizado);
      onClose();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao fechar card');
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

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  const valorTotalItens = itens.reduce((sum, item) => sum + item.precoTotal, 0);
  const valorTotal = valorTotalItens;
  const totalPago = pagamentos.reduce((sum, pag) => sum + pag.valor, 0);
  const saldo = valorTotal - totalPago;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gerenciar Pagamentos - Comanda #{cardCompleto?.numeroCard || card?.numeroCard}
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

              {/* Resumo Financeiro */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Valor Total</div>
                  <div className="text-xl font-bold text-gray-900">{formatarMoeda(valorTotal)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Itens: {formatarMoeda(valorTotalItens)}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Pago</div>
                  <div className="text-xl font-bold text-green-700">{formatarMoeda(totalPago)}</div>
                </div>
                <div className={`p-4 rounded-lg ${saldo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-sm text-gray-600 mb-1">Saldo</div>
                  <div className={`text-xl font-bold ${saldo > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatarMoeda(saldo)}
                  </div>
                </div>
              </div>

              {/* Botão Adicionar Pagamento */}
              {cardCompleto?.status === 'ABERTO' && (
                <div className="mb-4">
                  <button
                    onClick={abrirModalPagamento}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Pagamento
                  </button>
                </div>
              )}

              {/* Lista de Pagamentos */}
              {pagamentos.length > 0 ? (
                <div className="space-y-3">
                  {pagamentos.map((pagamento) => {
                    const formaPagamento = formasPagamento.find((fp) => fp.id === pagamento.formaPagamentoId);
                    const itensDoPagamento = pagamento.itens || [];
                    return (
                      <div
                        key={pagamento.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="w-5 h-5 text-emerald-600" />
                              <span className="font-semibold text-gray-900">{formaPagamento?.nome || 'Forma de Pagamento'}</span>
                              <span className="text-xl font-bold text-emerald-700">{formatarMoeda(pagamento.valor)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {formatarData(pagamento.createdAt)}
                            </div>
                            {pagamento.createdBy && (
                              <div className="text-xs text-gray-400 mb-2">
                                Registrado por: {pagamento.createdBy.name} - {formatarData(pagamento.createdAt)}
                              </div>
                            )}
                            {pagamento.observacoes && (
                              <div className="text-sm text-gray-600 mb-2">{pagamento.observacoes}</div>
                            )}
                            {itensDoPagamento.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs font-medium text-blue-900 mb-1">Itens pagos neste pagamento:</div>
                                <div className="space-y-1">
                                  {itensDoPagamento.map((item) => (
                                    <div key={item.id} className="text-xs text-gray-600">
                                      • {item.produto?.nome || 'Produto'} - {formatarMoeda(item.precoTotal)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {cardCompleto?.status === 'ABERTO' && (
                            <button
                              onClick={() => removerPagamento(pagamento.id)}
                              disabled={salvando}
                              className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remover pagamento"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum pagamento registrado ainda</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {Math.abs(saldo) < 0.01 && cardCompleto?.status === 'ABERTO' ? (
            // Quando saldo é zero e card está aberto, mostrar dois botões
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                disabled={salvando}
              >
                Manter Aberto
              </button>
              <button
                onClick={fecharCard}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={salvando}
              >
                {salvando ? 'Fechando...' : 'Fechar Comanda'}
              </button>
            </div>
          ) : (
            // Quando saldo não é zero ou card já está fechado, mostrar apenas botão Fechar
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Modal Adicionar Pagamento */}
      {modalPagamentoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Adicionar Pagamento</h3>
            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}
            
            {/* Informação do valor em aberto */}
            {cardCompleto && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-900 mb-1">Valor em Aberto</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatarMoeda(saldo)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-blue-600 mb-1">Total do Card</div>
                    <div className="text-sm font-semibold text-blue-900">
                      {formatarMoeda(valorTotal)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">Total Pago</div>
                    <div className="text-sm font-semibold text-green-700">
                      {formatarMoeda(totalPago)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* 1. Seleção de Itens */}
              {itens.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecionar Itens para Pagamento (opcional)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
                    {itens.map((item) => {
                      const isSelected = itensSelecionadosPagamento.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border-2 ${
                            isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemPagamento(item.id)}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.produto?.nome || 'Produto'}</div>
                            <div className="text-sm text-gray-600">
                              {formatarMoeda(item.precoTotal)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {itensSelecionadosPagamento.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-900">
                        Valor dos itens selecionados: {formatarMoeda(calcularValorItensSelecionados())}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Valor a pagar */}
              <div>
                <InputMonetario
                  label="Valor *"
                  value={valorPagamento}
                  onChange={setValorPagamento}
                  placeholder={itensSelecionadosPagamento.length > 0 
                    ? calcularValorItensSelecionados().toFixed(2) 
                    : calcularSaldo() > 0 
                      ? calcularSaldo().toFixed(2) 
                      : "0,00"}
                  min={0}
                  required
                />
                {itensSelecionadosPagamento.length === 0 && calcularSaldo() > 0 && (
                  <button
                    type="button"
                    onClick={() => setValorPagamento(calcularSaldo())}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Usar valor em aberto
                  </button>
                )}
              </div>

              {/* 3. Dividir pagamento e Valor por pessoa (ao lado) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dividir pagamento por quantas pessoas?
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numeroPessoas}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 1;
                      setNumeroPessoas(num);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                {numeroPessoas > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor por pessoa (calculado)
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                      {valorPorPessoa !== null && valorPorPessoa > 0 
                        ? formatarMoeda(valorPorPessoa)
                        : '0,00'}
                    </div>
                    {valorPorPessoa !== null && valorPorPessoa > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                        <div className="text-xs font-medium text-blue-900">
                          Total: {formatarMoeda(valorPorPessoa * numeroPessoas)} ({numeroPessoas} × {formatarMoeda(valorPorPessoa)})
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Observação do pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                <textarea
                  value={observacoesPagamento}
                  onChange={(e) => setObservacoesPagamento(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações sobre o pagamento..."
                />
              </div>

              {/* 5. Botões de Forma de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento *</label>
                <div className="flex flex-wrap gap-2">
                  {formasPagamento.map((forma) => {
                    const selecionada = formaPagamentoSelecionada === forma.id;
                    return (
                      <button
                        key={forma.id}
                        type="button"
                        onClick={() => setFormaPagamentoSelecionada(forma.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                          selecionada
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-emerald-300'
                        }`}
                      >
                        {forma.nome === 'Infinite Pay' ? 'Online' : forma.nome}
                      </button>
                    );
                  })}
                </div>
                {formaPagamentoSelecionada === '' && (
                  <p className="mt-2 text-xs text-red-500">Selecione uma forma de pagamento.</p>
                )}
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
                  disabled={
                    salvando || 
                    !formaPagamentoSelecionada || 
                    (numeroPessoas === 1 && (valorPagamento === null || valorPagamento <= 0)) ||
                    (numeroPessoas > 1 && (valorPorPessoa === null || valorPorPessoa <= 0))
                  }
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Adicionando...' : numeroPessoas > 1 ? `Adicionar Pagamento (${numeroPessoas} pessoas)` : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

