// app/app/arena/cards-clientes/page.tsx - Cards de Clientes
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import type { CardCliente, StatusCard } from '@/types/gestaoArena';
import GerenciarCardModal from '@/components/GerenciarCardModal';
import CriarEditarCardModal from '@/components/CriarEditarCardModal';
import VendaRapidaModal from '@/components/VendaRapidaModal';
import { Search, CreditCard, User, Calendar, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';

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
            Venda Rápida
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
      </div>

      {/* Lista de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cardsFiltrados.map((card) => (
          <div
            key={card.id}
            onClick={() => abrirDetalhes(card)}
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span className="text-lg font-bold text-gray-900">Card #{card.numeroCard}</span>
                </div>
                {getStatusBadge(card.status)}
              </div>
            </div>

            {card.usuario ? (
              <div className="mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-emerald-900">{card.usuario.name}</div>
                    {card.usuario.email && (
                      <div className="text-xs text-emerald-700">{card.usuario.email}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : card.nomeAvulso ? (
              <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-semibold text-blue-900">{card.nomeAvulso}</div>
                    {card.telefoneAvulso && (
                      <div className="text-xs text-blue-700">{card.telefoneAvulso}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                  <User className="w-4 h-4" />
                  <span>Cliente não informado</span>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Valor Total:</span>
                <span className="font-semibold text-gray-900">{formatarMoeda(card.valorTotal)}</span>
              </div>
              {card.totalPago !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Pago:</span>
                  <span className="font-semibold text-green-600">{formatarMoeda(card.totalPago)}</span>
                </div>
              )}
              {/* Saldo sempre visível e destacado */}
              <div className={`mt-3 p-2 rounded-lg border-2 ${
                card.saldo !== undefined && card.saldo > 0 
                  ? 'bg-red-50 border-red-200' 
                  : card.saldo !== undefined && card.saldo === 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${
                    card.saldo !== undefined && card.saldo > 0 
                      ? 'text-red-900' 
                      : card.saldo !== undefined && card.saldo === 0
                      ? 'text-green-900'
                      : 'text-gray-700'
                  }`}>
                    Saldo:
                  </span>
                  <span className={`text-lg font-bold ${
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
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>{formatarData(card.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {cardsFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum card encontrado</p>
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
    </div>
  );
}

