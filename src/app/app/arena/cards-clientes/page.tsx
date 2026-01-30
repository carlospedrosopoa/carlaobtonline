// app/app/arena/cards-clientes/page.tsx - Cards de Clientes
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import type { CardCliente, StatusCard } from '@/types/gestaoArena';
import GerenciarCardModal from '@/components/GerenciarCardModal';
import CriarEditarCardModal from '@/components/CriarEditarCardModal';
import VendaRapidaModal from '@/components/VendaRapidaModal';
import ModalGerenciarItensCard from '@/components/ModalGerenciarItensCard';
import ModalGerenciarPagamentosCard from '@/components/ModalGerenciarPagamentosCard';
import ModalUnificarComanda from '@/components/ModalUnificarComanda';
import { Search, CreditCard, User, Calendar, Clock, CheckCircle, XCircle, Zap, FileText, MessageCircle, ShoppingCart, DollarSign, RotateCw, LayoutGrid, List, Bolt, Merge, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { gzappyService } from '@/services/gzappyService';
import { pointService } from '@/services/agendamentoService';
import { formaPagamentoService, pagamentoCardService } from '@/services/gestaoArenaService';
import type { FormaPagamento } from '@/types/gestaoArena';
import InputMonetario from '@/components/InputMonetario';

export default function CardsClientesPage() {
  const { usuario } = useAuth();
  const [cards, setCards] = useState<CardCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusCard | ''>('ABERTO'); // Iniciar com apenas cards abertos
  const [busca, setBusca] = useState('');
  const [cardSelecionado, setCardSelecionado] = useState<CardCliente | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalCriarEditarAberto, setModalCriarEditarAberto] = useState(false);
  const [modalVendaRapidaAberto, setModalVendaRapidaAberto] = useState(false);
  const [cardEditando, setCardEditando] = useState<CardCliente | null>(null);
  const [modalItensAberto, setModalItensAberto] = useState(false);
  const [modalPagamentosAberto, setModalPagamentosAberto] = useState(false);
  const [modalUnificarAberto, setModalUnificarAberto] = useState(false);
  const [cardParaUnificar, setCardParaUnificar] = useState<CardCliente | null>(null);
  const [cardGerenciando, setCardGerenciando] = useState<CardCliente | null>(null);

  // Estados de ordenação
  type SortField = 'numeroCard' | 'cliente' | 'status' | 'valorTotal' | 'totalPago' | 'saldo' | 'data';
  type SortOrder = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('data');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [nomeArena, setNomeArena] = useState<string>('');
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  // Estados para pagamento rápido por card
  const [pagamentoRapidoAberto, setPagamentoRapidoAberto] = useState<Record<string, boolean>>({});
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState<Record<string, string>>({});
  const [valorRecebido, setValorRecebido] = useState<Record<string, number | null>>({});
  const [processandoPagamento, setProcessandoPagamento] = useState<Record<string, boolean>>({});
  
  // Carregar preferência de visualização do localStorage
  const [visualizacao, setVisualizacao] = useState<'lista' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const salva = localStorage.getItem('cards-visualizacao');
      return (salva === 'cards' || salva === 'lista') ? salva : 'lista';
    }
    return 'lista';
  });
  
  // Salvar preferência no localStorage quando mudar
  const alterarVisualizacao = (novaVisualizacao: 'lista' | 'cards') => {
    setVisualizacao(novaVisualizacao);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cards-visualizacao', novaVisualizacao);
    }
  };

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarCards();
      carregarNomeArena();
      carregarFormasPagamento();
    }
    // Removido filtroStatus da dependência para não recarregar ao alternar visualização
  }, [usuario?.pointIdGestor]);
  
  // Recarregar apenas quando o filtro de status mudar
  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarCards();
    }
  }, [filtroStatus]);
  
  const carregarFormasPagamento = async () => {
    if (!usuario?.pointIdGestor) return;
    try {
      const formas = await formaPagamentoService.listar(usuario.pointIdGestor, true);
      setFormasPagamento(formas);
    } catch (error) {
      console.error('Erro ao carregar formas de pagamento:', error);
    }
  };

  const carregarNomeArena = async () => {
    if (!usuario?.pointIdGestor) return;
    
    try {
      const point = await pointService.obter(usuario.pointIdGestor);
      if (point) {
        setNomeArena(point.nome);
      }
    } catch (error) {
      console.error('Erro ao carregar nome da arena:', error);
    }
  };

  const carregarCards = async () => {
    if (!usuario?.pointIdGestor) {
      console.log('[carregarCards] Sem pointIdGestor, abortando');
      return;
    }
    
    try {
      setLoading(true);
      // Para cards abertos, não carregar itens e pagamentos inicialmente (melhor performance)
      // Mas sempre calcular totalPago e saldo para exibir na listagem
      const incluirItens = filtroStatus !== 'ABERTO';
      const incluirPagamentos = filtroStatus !== 'ABERTO';
      
      console.log('[carregarCards] Carregando cards:', {
        pointId: usuario.pointIdGestor,
        status: filtroStatus || undefined,
        incluirItens,
        incluirPagamentos: true
      });
      
      const data = await cardClienteService.listar(
        usuario.pointIdGestor,
        filtroStatus || undefined,
        incluirItens,
        true // Sempre incluir pagamentos para calcular saldo
      );
      
      console.log('[carregarCards] Cards recebidos:', Array.isArray(data) ? data.length : 'não é array', data);
      setCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = (card: CardCliente) => {
    setCardSelecionado(card);
    setModalDetalhesAberto(true);
  };

  const abrirModalEditar = (card: CardCliente) => {
    setCardEditando(card);
    setModalCriarEditarAberto(true);
  };


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const cardsFiltrados = useMemo(() => {
    // 1. Filtrar
    const listaFiltrada = cards.filter((card) => {
      const termo = busca.toLowerCase();
      return (
        busca === '' || 
        card.numeroCard.toString().includes(busca) ||
        card.usuario?.name?.toLowerCase().includes(termo) ||
        card.usuario?.email?.toLowerCase().includes(termo) ||
        card.nomeAvulso?.toLowerCase().includes(termo) ||
        card.telefoneAvulso?.includes(busca)
      );
    });

    // 2. Ordenar (usando cópia explícita para evitar mutações indesejadas)
    return [...listaFiltrada].sort((a, b) => {
      let valorA: any;
      let valorB: any;

      switch (sortField) {
        case 'numeroCard':
          valorA = a.numeroCard;
          valorB = b.numeroCard;
          break;
        
        case 'cliente':
          valorA = (a.usuario?.name || a.nomeAvulso || '').toLowerCase();
          valorB = (b.usuario?.name || b.nomeAvulso || '').toLowerCase();
          break;
        
        case 'status':
          valorA = (a.status || '').toLowerCase();
          valorB = (b.status || '').toLowerCase();
          break;
        
        case 'valorTotal':
          valorA = a.valorTotal || 0;
          valorB = b.valorTotal || 0;
          break;
        
        case 'totalPago':
          valorA = a.totalPago || 0;
          valorB = b.totalPago || 0;
          break;
        
        case 'saldo':
          valorA = (a.valorTotal || 0) - (a.totalPago || 0);
          valorB = (b.valorTotal || 0) - (b.totalPago || 0);
          break;
        
        case 'data':
          valorA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          valorB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          break;
        
        default:
          return 0;
      }

      if (valorA < valorB) return sortOrder === 'asc' ? -1 : 1;
      if (valorA > valorB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [cards, busca, sortField, sortOrder]);

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

  const formatarMensagemCard = (card: CardCliente): string => {
    const nomeCliente = card.usuario?.name || card.nomeAvulso || 'Cliente';
    const dataFormatada = formatarData(card.createdAt);
    const valorTotal = formatarMoeda(card.valorTotal);
    const totalPago = formatarMoeda(card.totalPago || 0);
    const saldo = formatarMoeda(card.saldo !== undefined ? card.saldo : card.valorTotal);
    const status = card.status === 'ABERTO' ? 'Aberto' : card.status === 'FECHADO' ? 'Fechado' : 'Cancelado';

    let mensagem = '';
    
    // Título: Nome da Arena
    if (nomeArena) {
      mensagem += `*${nomeArena}*\n\n`;
    }
    
    // Card: informações do cliente, data e status
    mensagem += `📋 *Comanda #${card.numeroCard}:*\n`;
    mensagem += `👤 *Cliente:* ${nomeCliente}\n`;
    mensagem += `📅 *Data:* ${dataFormatada}\n`;
    mensagem += `📊 *Status:* ${status}\n\n`;
    mensagem += `💰 *Valores:*\n`;
    mensagem += `• Total: ${valorTotal}\n`;
    mensagem += `• Pago: ${totalPago}\n`;
    mensagem += `• Saldo: ${saldo}\n`;

    // Adicionar itens com observações
    if (card.itens && card.itens.length > 0) {
      mensagem += `\n🛒 *Itens:*\n`;
      card.itens.forEach((item, index) => {
        const nomeProduto = item.produto?.nome || 'Produto';
        mensagem += `${index + 1}. ${nomeProduto} - ${item.quantidade}x ${formatarMoeda(item.precoUnitario)} = ${formatarMoeda(item.precoTotal)}\n`;
        if (item.observacoes) {
          mensagem += `   📝 ${item.observacoes}\n`;
        }
      });
    }

    // Adicionar pagamentos com data e forma de pagamento
    if (card.pagamentos && card.pagamentos.length > 0) {
      mensagem += `\n💳 *Pagamentos:*\n`;
      card.pagamentos.forEach((pagamento, index) => {
        const dataPagamento = formatarData(pagamento.createdAt);
        const formaPagamento = pagamento.formaPagamento?.nome || 'Não informado';
        mensagem += `${index + 1}. ${formatarMoeda(pagamento.valor)} - ${formaPagamento}\n`;
        mensagem += `   📅 ${dataPagamento}\n`;
        if (pagamento.observacoes) {
          mensagem += `   📝 ${pagamento.observacoes}\n`;
        }
      });
    }

    // Observações gerais do card
    if (card.observacoes) {
      mensagem += `\n📝 *Observações Gerais:*\n${card.observacoes}\n`;
    }

    return mensagem;
  };

  const obterTelefoneCliente = (card: CardCliente): string | null => {
    // Prioridade: telefoneAvulso > telefone do atleta vinculado > whatsapp do usuário
    if (card.telefoneAvulso) {
      return card.telefoneAvulso;
    }
    if (card.usuario?.telefone) {
      return card.usuario.telefone; // Telefone do atleta vinculado ao usuário
    }
    if (card.usuario?.whatsapp) {
      return card.usuario.whatsapp;
    }
    return null;
  };

  const enviarWhatsAppCard = async (card: CardCliente, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que o clique abra o modal de detalhes

    const telefone = obterTelefoneCliente(card);
    if (!telefone) {
      alert('Telefone do cliente não encontrado. Por favor, adicione o telefone do cliente no cadastro.');
      return;
    }

    // Buscar dados completos do card (com itens e pagamentos) para garantir que tudo esteja disponível
    let cardCompleto = card;
    try {
      // Se o card não tiver itens ou pagamentos carregados, buscar dados completos
      if (!card.itens || !card.pagamentos) {
        cardCompleto = await cardClienteService.obter(card.id, true, true, false);
      }
    } catch (error) {
      console.error('Erro ao buscar dados completos do card:', error);
      // Continuar com o card original se houver erro
    }

    const mensagem = formatarMensagemCard(cardCompleto);
    const pointId = usuario?.pointIdGestor;

    if (!pointId) {
      alert('Erro: Arena não identificada.');
      return;
    }

    try {
      await gzappyService.enviar({
        destinatario: telefone,
        mensagem: mensagem,
        tipo: 'texto',
        pointId: pointId,
      });
      alert('Mensagem enviada com sucesso via Gzappy!');
    } catch (error: any) {
      console.error('Erro ao enviar mensagem via Gzappy:', error);
      const mensagemErro = error?.response?.data?.mensagem || error?.message || 'Erro ao enviar mensagem';
      alert(`Erro ao enviar mensagem: ${mensagemErro}`);
    }
  };

  const abrirPagamentoRapido = (cardId: string) => {
    setPagamentoRapidoAberto((prev) => ({ ...prev, [cardId]: true }));
    setFormaPagamentoSelecionada((prev) => ({ ...prev, [cardId]: '' }));
    setValorRecebido((prev) => ({ ...prev, [cardId]: null }));
  };

  const fecharPagamentoRapido = (cardId: string) => {
    setPagamentoRapidoAberto((prev) => ({ ...prev, [cardId]: false }));
    setFormaPagamentoSelecionada((prev) => ({ ...prev, [cardId]: '' }));
    setValorRecebido((prev) => ({ ...prev, [cardId]: null }));
  };

  const processarPagamentoRapido = async (card: CardCliente) => {
    if (!formaPagamentoSelecionada[card.id]) return;
    
    const formaPagamentoId = formaPagamentoSelecionada[card.id];
    const saldo = card.saldo !== undefined ? card.saldo : card.valorTotal;
    
    // Se for dinheiro, usar valor recebido (mas limitado ao saldo), senão usar saldo completo
    let valorPagamento = saldo;
    const formaPagamento = formasPagamento.find((fp) => fp.id === formaPagamentoId);
    const isDinheiro = formaPagamento?.nome?.toLowerCase().includes('dinheiro') || 
                       formaPagamento?.nome?.toLowerCase().includes('cash');
    
    if (isDinheiro) {
      if (valorRecebido[card.id] === null || valorRecebido[card.id] === undefined) {
        alert('Informe o valor recebido');
        return;
      }
      if (valorRecebido[card.id]! < saldo) {
        alert(`O valor recebido (${formatarMoeda(valorRecebido[card.id]!)}) deve ser maior ou igual ao saldo (${formatarMoeda(saldo)})`);
        return;
      }
      valorPagamento = saldo; // Sempre pagar o saldo completo, o troco é calculado separadamente
    }

    if (valorPagamento <= 0) {
      alert('O valor do pagamento deve ser maior que zero');
      return;
    }

    try {
      setProcessandoPagamento((prev) => ({ ...prev, [card.id]: true }));
      
      await pagamentoCardService.criar(card.id, {
        cardId: card.id,
        formaPagamentoId,
        valor: valorPagamento,
        observacoes: 'Pagamento rápido',
      });

      // Calcular o novo saldo (saldo atual - valor do pagamento)
      const saldoAtual = card.saldo !== undefined ? card.saldo : card.valorTotal;
      const novoSaldo = saldoAtual - valorPagamento;
      
      // Se o saldo for zero ou negativo, finalizar a comanda
      if (novoSaldo <= 0 && card.status === 'ABERTO') {
        await cardClienteService.atualizar(card.id, {
          status: 'FECHADO',
        });
        
        // Atualizar o card localmente sem recarregar a lista
        setCards((prevCards) =>
          prevCards.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  status: 'FECHADO' as StatusCard,
                  saldo: 0,
                }
              : c
          )
        );
      } else {
        // Atualizar apenas o saldo do card localmente
        setCards((prevCards) =>
          prevCards.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  saldo: novoSaldo,
                }
              : c
          )
        );
      }
      
      // Fechar pagamento rápido
      fecharPagamentoRapido(card.id);
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao processar pagamento');
    } finally {
      setProcessandoPagamento((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  const calcularTroco = (card: CardCliente): number => {
    const saldo = card.saldo !== undefined ? card.saldo : card.valorTotal;
    const recebido = valorRecebido[card.id];
    if (recebido === null || recebido === undefined) return 0;
    return Math.max(0, recebido - saldo);
  };

  const getStatusBadge = (status: StatusCard) => {
    switch (status) {
      case 'ABERTO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Aberto</span>;
      case 'FECHADO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Fechado</span>;
      case 'CANCELADO':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelado</span>;
    }
  };


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-emerald-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando comandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comandas de Clientes</h1>
          <p className="text-gray-600 mt-1">Gerencie as comandas de atendimento</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              carregarCards();
              carregarNomeArena();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title="Atualizar lista de cards"
          >
            <RotateCw className="w-5 h-5" />
            Atualizar
          </button>
          <button
            onClick={() => setModalVendaRapidaAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-5 h-5" />
            Nova Venda
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por número, cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusCard | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">Todos os status</option>
          <option value="ABERTO">Aberto</option>
          <option value="FECHADO">Fechado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        {/* Botões de alternância de visualização */}
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1 bg-gray-50">
          <button
            onClick={() => alterarVisualizacao('lista')}
            className={`px-3 py-1.5 rounded transition-colors ${
              visualizacao === 'lista'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Visualização em lista"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => alterarVisualizacao('cards')}
            className={`px-3 py-1.5 rounded transition-colors ${
              visualizacao === 'cards'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Visualização em cards"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lista de Cards ou Cards */}
      {visualizacao === 'lista' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('numeroCard')}
                >
                  <div className="flex items-center gap-1">
                    Card
                    <SortIcon field="numeroCard" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('cliente')}
                >
                  <div className="flex items-center gap-1">
                    Cliente
                    <SortIcon field="cliente" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('valorTotal')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <SortIcon field="valorTotal" />
                    Valor Total
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('totalPago')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <SortIcon field="totalPago" />
                    Total Pago
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('saldo')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <SortIcon field="saldo" />
                    Saldo
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('data')}
                >
                  <div className="flex items-center gap-1">
                    Data
                    <SortIcon field="data" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cardsFiltrados.map((card) => (
                <tr
                  key={card.id}
                  onClick={() => abrirDetalhes(card)}
                  className="cursor-pointer hover:bg-emerald-50 transition-colors"
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-gray-900">#{card.numeroCard}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {card.usuario ? (
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                          {card.usuario.name}
                          {card.usuario.saldoContaCorrente !== undefined && card.usuario.saldoContaCorrente !== 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${
                              card.usuario.saldoContaCorrente > 0 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`} title="Saldo em Conta Corrente">
                              CC: {formatarMoeda(card.usuario.saldoContaCorrente)}
                            </span>
                          )}
                        </div>
                        {card.usuario.email && (
                          <div className="text-xs text-gray-500">{card.usuario.email}</div>
                        )}
                      </div>
                    ) : card.nomeAvulso ? (
                      <div>
                        <div className="font-semibold text-gray-900">{card.nomeAvulso}</div>
                        {card.telefoneAvulso && (
                          <div className="text-xs text-gray-500">{card.telefoneAvulso}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Não informado</span>
                    )}
                    {card.observacoes && (
                      <div className="mt-1 flex items-start gap-1">
                        <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500 line-clamp-1">{card.observacoes}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(card.status)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className="font-semibold text-gray-900">{formatarMoeda(card.valorTotal)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    {card.totalPago !== undefined ? (
                      <span className="font-semibold text-green-600">{formatarMoeda(card.totalPago)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className={`font-bold ${
                      card.saldo !== undefined && card.saldo > 0 
                        ? 'text-red-600' 
                        : card.saldo !== undefined && card.saldo === 0
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }`}>
                      {formatarMoeda(card.saldo !== undefined ? card.saldo : card.valorTotal)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatarData(card.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardGerenciando(card);
                          setModalItensAberto(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                        title="Gerenciar Itens"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Itens
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardGerenciando(card);
                          setModalPagamentosAberto(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium"
                        title="Gerenciar Pagamentos"
                      >
                        <DollarSign className="w-4 h-4" />
                        Pagamentos
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardParaUnificar(card);
                          setModalUnificarAberto(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-xs font-medium"
                        title="Unificar com outra comanda"
                      >
                        <Merge className="w-4 h-4" />
                        Unificar
                      </button>
                      <button
                        onClick={(e) => {
                          if (obterTelefoneCliente(card)) {
                            enviarWhatsAppCard(card, e);
                          }
                        }}
                        disabled={!obterTelefoneCliente(card)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                          obterTelefoneCliente(card)
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title={obterTelefoneCliente(card) ? 'Enviar informações do card por WhatsApp' : 'Telefone do cliente não cadastrado'}
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        /* Visualização em Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cardsFiltrados.map((card) => (
            <div
              key={card.id}
              onClick={() => abrirDetalhes(card)}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-gray-900">#{card.numeroCard}</span>
                </div>
                {getStatusBadge(card.status)}
              </div>
              
              <div className="mb-3">
                {card.usuario ? (
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      {card.usuario.name}
                      {card.usuario.saldoContaCorrente !== undefined && card.usuario.saldoContaCorrente !== 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${
                          card.usuario.saldoContaCorrente > 0 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`} title="Saldo em Conta Corrente">
                          CC: {formatarMoeda(card.usuario.saldoContaCorrente)}
                        </span>
                      )}
                    </div>
                    {card.usuario.email && (
                      <div className="text-xs text-gray-500">{card.usuario.email}</div>
                    )}
                  </div>
                ) : card.nomeAvulso ? (
                  <div>
                    <div className="font-semibold text-gray-900">{card.nomeAvulso}</div>
                    {card.telefoneAvulso && (
                      <div className="text-xs text-gray-500">{card.telefoneAvulso}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">Não informado</span>
                )}
                {card.observacoes && (
                  <div className="mt-2 flex items-start gap-1">
                    <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500 line-clamp-2">{card.observacoes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-semibold text-gray-900">{formatarMoeda(card.valorTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Pago:</span>
                  {card.totalPago !== undefined ? (
                    <span className="font-semibold text-green-600">{formatarMoeda(card.totalPago)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Saldo:</span>
                  <span className={`font-bold ${
                    card.saldo !== undefined && card.saldo > 0 
                      ? 'text-red-600' 
                      : card.saldo !== undefined && card.saldo === 0
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}>
                    {formatarMoeda(card.saldo !== undefined ? card.saldo : card.valorTotal)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 pt-3 border-t border-gray-200">
                <Calendar className="w-4 h-4" />
                <span>{formatarData(card.createdAt)}</span>
              </div>

              {/* Pagamento Rápido - apenas para cards abertos */}
              {card.status === 'ABERTO' && (
                <div className="mb-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                  {!pagamentoRapidoAberto[card.id] ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirPagamentoRapido(card.id);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                    >
                      <Bolt className="w-4 h-4" />
                      Pagamento Rápido
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Bolt className="w-4 h-4 text-yellow-600" />
                          Pagamento Rápido
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fecharPagamentoRapido(card.id);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Fechar
                        </button>
                      </div>
                      
                      {/* Botões de Formas de Pagamento */}
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const ordem = ['Pix', 'Cartão de Débito', 'Cartão de Crédito', 'Dinheiro', 'Infinite Pay', 'Conta Corrente'];
                          const formasOrdenadas = [...formasPagamento].sort((a, b) => {
                            const indexA = ordem.indexOf(a.nome);
                            const indexB = ordem.indexOf(b.nome);
                            
                            // Se ambos estiverem na lista de ordem
                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                            
                            // Se apenas A estiver na lista, ele vem primeiro
                            if (indexA !== -1) return -1;
                            
                            // Se apenas B estiver na lista, ele vem primeiro
                            if (indexB !== -1) return 1;
                            
                            // Se nenhum estiver na lista, ordem alfabética
                            return a.nome.localeCompare(b.nome);
                          });
                          
                          return formasOrdenadas.map((forma) => {
                            const selecionada = formaPagamentoSelecionada[card.id] === forma.id;
                            const isDinheiro = forma.nome?.toLowerCase().includes('dinheiro') || 
                                             forma.nome?.toLowerCase().includes('cash');
                            return (
                              <button
                                key={forma.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormaPagamentoSelecionada((prev) => ({ ...prev, [card.id]: forma.id }));
                                  // Se for dinheiro, inicializar com o saldo
                                  if (isDinheiro) {
                                    const saldo = card.saldo !== undefined ? card.saldo : card.valorTotal;
                                    setValorRecebido((prev) => ({ ...prev, [card.id]: saldo }));
                                  } else {
                                    setValorRecebido((prev) => ({ ...prev, [card.id]: null }));
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                                  selecionada
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-emerald-300'
                                }`}
                              >
                                {forma.nome === 'Infinite Pay' ? 'Online' : forma.nome}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      {/* Campo de Valor Recebido (apenas para dinheiro) */}
                      {formaPagamentoSelecionada[card.id] && (() => {
                        const formaSelecionada = formasPagamento.find(
                          (fp) => fp.id === formaPagamentoSelecionada[card.id]
                        );
                        const isDinheiro = formaSelecionada?.nome?.toLowerCase().includes('dinheiro') || 
                                         formaSelecionada?.nome?.toLowerCase().includes('cash');
                        
                        if (isDinheiro) {
                          const saldo = card.saldo !== undefined ? card.saldo : card.valorTotal;
                          const troco = calcularTroco(card);
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-700 font-medium flex-1">
                                  Valor Recebido:
                                </label>
                                <div className="flex-1">
                                  <InputMonetario
                                    value={valorRecebido[card.id]}
                                    onChange={(val) => setValorRecebido((prev) => ({ ...prev, [card.id]: val }))}
                                    placeholder="0,00"
                                    min={saldo}
                                  />
                                </div>
                              </div>
                              {valorRecebido[card.id] !== null && valorRecebido[card.id] !== undefined && valorRecebido[card.id]! >= saldo && (
                                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                                  <span className="text-xs font-medium text-green-700">Troco:</span>
                                  <span className="text-sm font-bold text-green-700">{formatarMoeda(troco)}</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Botão de Processar Pagamento */}
                      {formaPagamentoSelecionada[card.id] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            processarPagamentoRapido(card);
                          }}
                          disabled={processandoPagamento[card.id] || (() => {
                            const formaSelecionada = formasPagamento.find(
                              (fp) => fp.id === formaPagamentoSelecionada[card.id]
                            );
                            const isDinheiro = formaSelecionada?.nome?.toLowerCase().includes('dinheiro') || 
                                             formaSelecionada?.nome?.toLowerCase().includes('cash');
                            if (isDinheiro) {
                              const saldo = card.saldo !== undefined ? card.saldo : card.valorTotal;
                              return !valorRecebido[card.id] || valorRecebido[card.id]! < saldo;
                            }
                            // Para outras formas de pagamento, sempre permitir
                            return false;
                          })()}
                          className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processandoPagamento[card.id] ? 'Processando...' : 'Confirmar Pagamento'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardGerenciando(card);
                    setModalItensAberto(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                  title="Gerenciar Itens"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Itens
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardGerenciando(card);
                    setModalPagamentosAberto(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium"
                  title="Gerenciar Pagamentos"
                >
                  <DollarSign className="w-4 h-4" />
                  Pagamentos
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardParaUnificar(card);
                    setModalUnificarAberto(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-xs font-medium"
                  title="Unificar"
                >
                  <Merge className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (obterTelefoneCliente(card)) {
                      enviarWhatsAppCard(card, e);
                    }
                  }}
                  disabled={!obterTelefoneCliente(card)}
                  className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                    obterTelefoneCliente(card)
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                  title={obterTelefoneCliente(card) ? 'Enviar informações do card por WhatsApp' : 'Telefone do cliente não cadastrado'}
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cardsFiltrados.length === 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma comanda encontrada</p>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar Card */}
      {modalCriarEditarAberto && (
        <CriarEditarCardModal
          isOpen={modalCriarEditarAberto}
          card={cardEditando}
          onClose={() => {
            setModalCriarEditarAberto(false);
            setCardEditando(null);
          }}
          onSuccess={(cardCriado) => {
            carregarCards();
            // Se foi criado um novo card, abrir o modal de gerenciamento (venda)
            if (cardCriado) {
              setCardSelecionado(cardCriado);
              setModalDetalhesAberto(true);
            }
          }}
        />
      )}

      {/* Modal de Gerenciar Card */}
      {modalDetalhesAberto && cardSelecionado && (
        <GerenciarCardModal
          isOpen={modalDetalhesAberto}
          card={cardSelecionado}
          onClose={() => {
            setModalDetalhesAberto(false);
            setCardSelecionado(null);
          }}
          onSuccess={(cardAtualizado) => {
            if (cardAtualizado) {
              // Atualizar apenas o card alterado na lista
              setCards((prevCards) =>
                prevCards.map((card) =>
                  card.id === cardAtualizado.id ? cardAtualizado : card
                )
              );
            } else {
              // Se não recebeu card atualizado (card foi deletado), recarregar lista e limpar busca
              setBusca(''); // Limpar campo de busca após deletar card
              carregarCards();
            }
          }}
          onEditar={() => {
            abrirModalEditar(cardSelecionado);
          }}
        />
      )}

      <VendaRapidaModal
        isOpen={modalVendaRapidaAberto}
        onClose={() => setModalVendaRapidaAberto(false)}
        onSuccess={() => {
          carregarCards();
          setModalVendaRapidaAberto(false);
        }}
      />

      {/* Modal Gerenciar Itens */}
      {modalItensAberto && cardGerenciando && (
        <ModalGerenciarItensCard
          isOpen={modalItensAberto}
          card={cardGerenciando}
          onClose={() => {
            setModalItensAberto(false);
            setCardGerenciando(null);
          }}
          onSuccess={(cardAtualizado) => {
            if (cardAtualizado) {
              setCards((prevCards) =>
                prevCards.map((card) => (card.id === cardAtualizado.id ? cardAtualizado : card))
              );
            } else {
              carregarCards();
            }
          }}
        />
      )}

      {/* Modal Gerenciar Pagamentos */}
      {modalPagamentosAberto && cardGerenciando && (
        <ModalGerenciarPagamentosCard
          isOpen={modalPagamentosAberto}
          card={cardGerenciando}
          onClose={() => {
            setModalPagamentosAberto(false);
            setCardGerenciando(null);
          }}
          onSuccess={(cardAtualizado) => {
            if (cardAtualizado) {
              setCards((prevCards) =>
                prevCards.map((card) => (card.id === cardAtualizado.id ? cardAtualizado : card))
              );
            } else {
              carregarCards();
            }
          }}
        />
      )}

      {/* Modal Unificar Comanda */}
      {modalUnificarAberto && cardParaUnificar && (
        <ModalUnificarComanda
          isOpen={modalUnificarAberto}
          cardPrincipal={cardParaUnificar}
          onClose={() => {
            setModalUnificarAberto(false);
            setCardParaUnificar(null);
          }}
          onUnificarSucesso={() => {
            carregarCards();
            setModalUnificarAberto(false);
            setCardParaUnificar(null);
          }}
        />
      )}

    </div>
  );
}

