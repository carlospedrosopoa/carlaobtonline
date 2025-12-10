// app/app/arena/cards-clientes/page.tsx - Cards de Clientes
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import type { CardCliente, StatusCard } from '@/types/gestaoArena';
import GerenciarCardModal from '@/components/GerenciarCardModal';
import CriarEditarCardModal from '@/components/CriarEditarCardModal';
import VendaRapidaModal from '@/components/VendaRapidaModal';
import ModalGerenciarItensCard from '@/components/ModalGerenciarItensCard';
import ModalGerenciarPagamentosCard from '@/components/ModalGerenciarPagamentosCard';
import { Search, CreditCard, User, Calendar, Clock, CheckCircle, XCircle, Zap, FileText, MessageCircle, ShoppingCart, DollarSign, Trash2 } from 'lucide-react';
import { gzappyService } from '@/services/gzappyService';

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
  const [cardGerenciando, setCardGerenciando] = useState<CardCliente | null>(null);
  const [limpandoCards, setLimpandoCards] = useState(false);

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarCards();
    }
  }, [usuario?.pointIdGestor, filtroStatus]);

  const carregarCards = async () => {
    if (!usuario?.pointIdGestor) return;
    
    try {
      setLoading(true);
      // Para cards abertos, não carregar itens e pagamentos inicialmente (melhor performance)
      // Mas sempre calcular totalPago e saldo para exibir na listagem
      const incluirItens = filtroStatus !== 'ABERTO';
      const incluirPagamentos = filtroStatus !== 'ABERTO';
      
      const data = await cardClienteService.listar(
        usuario.pointIdGestor,
        filtroStatus || undefined,
        incluirItens,
        true // Sempre incluir pagamentos para calcular saldo
      );
      setCards(data);
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
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


  const cardsFiltrados = cards.filter((card) => {
    const matchBusca = busca === '' || 
      card.numeroCard.toString().includes(busca) ||
      card.usuario?.name?.toLowerCase().includes(busca.toLowerCase()) ||
      card.usuario?.email?.toLowerCase().includes(busca.toLowerCase()) ||
      card.nomeAvulso?.toLowerCase().includes(busca.toLowerCase()) ||
      card.telefoneAvulso?.includes(busca);
    return matchBusca;
  });

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

    let mensagem = `📋 *Card #${card.numeroCard}*\n\n`;
    mensagem += `👤 *Cliente:* ${nomeCliente}\n`;
    mensagem += `📅 *Data:* ${dataFormatada}\n`;
    mensagem += `📊 *Status:* ${status}\n\n`;
    mensagem += `💰 *Valores:*\n`;
    mensagem += `• Total: ${valorTotal}\n`;
    mensagem += `• Pago: ${totalPago}\n`;
    mensagem += `• Saldo: ${saldo}\n`;

    if (card.observacoes) {
      mensagem += `\n📝 *Observações:*\n${card.observacoes}\n`;
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

    const mensagem = formatarMensagemCard(card);
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

  const limparTodosCards = async () => {
    if (!usuario?.pointIdGestor) {
      alert('Erro: Arena não identificada.');
      return;
    }

    const confirmacao = confirm(
      `⚠️ ATENÇÃO: Esta ação irá DELETAR TODOS os cards de clientes desta arena (${cards.length} card(s) encontrado(s)).\n\n` +
      `Esta ação é IRREVERSÍVEL e irá remover:\n` +
      `- Todos os cards\n` +
      `- Todos os itens dos cards\n` +
      `- Todos os pagamentos dos cards\n\n` +
      `Deseja continuar?`
    );

    if (!confirmacao) return;

    try {
      setLimpandoCards(true);
      const resultado = await cardClienteService.limparTodos(usuario.pointIdGestor);
      alert(`${resultado.mensagem}\n\nTotal de cards deletados: ${resultado.totalCards}`);
      carregarCards();
    } catch (error: any) {
      console.error('Erro ao limpar cards:', error);
      const mensagemErro = error?.response?.data?.mensagem || error?.message || 'Erro ao limpar cards';
      alert(`Erro ao limpar cards: ${mensagemErro}`);
    } finally {
      setLimpandoCards(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cards de Clientes</h1>
          <p className="text-gray-600 mt-1">Gerencie os cards de atendimento</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setModalVendaRapidaAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-5 h-5" />
            Nova Venda
          </button>
          {(usuario?.role === 'ADMIN' || usuario?.role === 'ORGANIZER') && (
            <button
              onClick={limparTodosCards}
              disabled={limpandoCards || !usuario?.pointIdGestor}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Limpar todos os cards desta arena (apenas desenvolvimento)"
            >
              {limpandoCards ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Limpar Todos
                </>
              )}
            </button>
          )}
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
      </div>

      {/* Lista de Cards */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Card</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Valor Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Pago</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Saldo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
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
                        <div className="font-semibold text-gray-900">{card.usuario.name}</div>
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

      {cardsFiltrados.length === 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum card encontrado</p>
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
          onSuccess={() => {
            carregarCards();
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
          onSuccess={() => {
            carregarCards();
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
          onSuccess={() => {
            carregarCards();
          }}
        />
      )}

    </div>
  );
}

