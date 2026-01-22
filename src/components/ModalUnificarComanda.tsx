'use client';

import { useState, useEffect } from 'react';
import { cardClienteService } from '@/services/gestaoArenaService';
import { api } from '@/lib/api';
import type { CardCliente } from '@/types/gestaoArena';
import { X, Search, ArrowRight, AlertTriangle, CheckCircle, User, Merge } from 'lucide-react';

interface ModalUnificarComandaProps {
  isOpen: boolean;
  onClose: () => void;
  cardPrincipal: CardCliente;
  onUnificarSucesso: () => void;
}

export default function ModalUnificarComanda({
  isOpen,
  onClose,
  cardPrincipal,
  onUnificarSucesso,
}: ModalUnificarComandaProps) {
  const [loading, setLoading] = useState(false);
  const [comandasDisponiveis, setComandasDisponiveis] = useState<CardCliente[]>([]);
  const [busca, setBusca] = useState('');
  const [cardSecundario, setCardSecundario] = useState<CardCliente | null>(null);
  const [unificando, setUnificando] = useState(false);
  const [erro, setErro] = useState('');
  
  // Controle de confirmação por senha
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  // Carregar comandas disponíveis ao abrir
  useEffect(() => {
    if (isOpen && cardPrincipal) {
      carregarComandas();
    }
  }, [isOpen, cardPrincipal]);

  const carregarComandas = async () => {
    try {
      setLoading(true);
      // Busca todas as comandas abertas do mesmo point
      const res = await cardClienteService.listar(cardPrincipal.pointId, 'ABERTO');
      
      // Filtra para remover a comanda principal atual
      const outras = res.filter(c => c.id !== cardPrincipal.id);
      setComandasDisponiveis(outras);
    } catch (error) {
      console.error('Erro ao carregar comandas', error);
      setErro('Não foi possível carregar a lista de comandas.');
    } finally {
      setLoading(false);
    }
  };

  const comandasFiltradas = comandasDisponiveis.filter(c => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    const numero = c.numeroCard.toString();
    const nomeCliente = c.usuario?.name?.toLowerCase() || '';
    const nomeAvulso = c.nomeAvulso?.toLowerCase() || '';
    
    return numero.includes(termo) || nomeCliente.includes(termo) || nomeAvulso.includes(termo);
  });

  const solicitarUnificacao = () => {
    if (!cardSecundario) return;
    setSenhaConfirmacao('');
    setErroSenha('');
    setModalSenhaAberto(true);
  };

  const confirmarUnificacaoComSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaConfirmacao) {
      setErroSenha('Digite sua senha para confirmar');
      return;
    }

    try {
      setUnificando(true);
      setErroSenha('');
      setErro('');

      // 1. Validar senha
      const validacao = await api.post('/user/auth/validate-password', {
        password: senhaConfirmacao
      });

      if (!validacao.data.valido) {
        setErroSenha('Senha incorreta');
        setUnificando(false);
        return;
      }

      // 2. Se senha válida, prosseguir com unificação
      await cardClienteService.unificar(cardPrincipal.id, cardSecundario!.id);
      
      alert('Comandas unificadas com sucesso!');
      onUnificarSucesso();
      onClose();
    } catch (error: any) {
      console.error('Erro na unificação:', error);
      const msg = error?.response?.data?.mensagem || 'Erro ao unificar comandas';
      
      if (msg.includes('Senha')) {
        setErroSenha(msg);
      } else {
        setModalSenhaAberto(false); // Fecha modal de senha se for erro geral
        setErro(msg);
      }
    } finally {
      setUnificando(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Merge className="w-6 h-6 text-purple-600" />
              Unificar Comandas
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Transfira itens e pagamentos de outra comanda para a comanda atual.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center mb-8">
            {/* Card Principal (Destino) */}
            <div className="border-2 border-emerald-500 bg-emerald-50 rounded-lg p-4 relative">
              <div className="absolute -top-3 left-3 bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold border border-emerald-200">
                DESTINO (Principal)
              </div>
              <div className="font-bold text-lg text-gray-900 mb-1">Comanda #{cardPrincipal.numeroCard}</div>
              <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                <User className="w-3 h-3" />
                {cardPrincipal.usuario?.name || cardPrincipal.nomeAvulso || 'Sem cliente'}
              </div>
              <div className="text-emerald-700 font-bold">
                Atual: {formatarMoeda(cardPrincipal.valorTotal)}
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400 transform rotate-90 md:rotate-0" />
            </div>

            {/* Card Secundário (Origem) */}
            <div className={`border-2 rounded-lg p-4 relative min-h-[120px] flex flex-col justify-center ${
              cardSecundario ? 'border-purple-500 bg-purple-50' : 'border-dashed border-gray-300 bg-gray-50'
            }`}>
              {cardSecundario ? (
                <>
                  <div className="absolute -top-3 left-3 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold border border-purple-200">
                    ORIGEM (Será esvaziada)
                  </div>
                  <div className="font-bold text-lg text-gray-900 mb-1">Comanda #{cardSecundario.numeroCard}</div>
                  <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {cardSecundario.usuario?.name || cardSecundario.nomeAvulso || 'Sem cliente'}
                  </div>
                  <div className="text-purple-700 font-bold">
                    Total: {formatarMoeda(cardSecundario.valorTotal)}
                  </div>
                  <button 
                    onClick={() => setCardSecundario(null)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    title="Remover seleção"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="text-center text-gray-500 text-sm">
                  Selecione uma comanda abaixo para unificar
                </div>
              )}
            </div>
          </div>

          {!cardSecundario && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar comanda para unificar (nome ou número)..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Carregando comandas...</div>
                ) : comandasFiltradas.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {comandasFiltradas.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setCardSecundario(card)}
                        className="w-full text-left p-3 hover:bg-purple-50 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <div className="font-medium text-gray-900">Comanda #{card.numeroCard}</div>
                          <div className="text-sm text-gray-500">
                            {card.usuario?.name || card.nomeAvulso || 'Sem cliente'}
                          </div>
                        </div>
                        <div className="font-semibold text-gray-700">
                          {formatarMoeda(card.valorTotal)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    Nenhuma outra comanda aberta encontrada.
                  </div>
                )}
              </div>
            </div>
          )}

          {cardSecundario && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-yellow-800 text-sm">Confirmação da Unificação</h4>
                  <ul className="mt-2 text-sm text-yellow-700 space-y-1 list-disc list-inside">
                    <li>Todos os itens, pagamentos e agendamentos da comanda <strong>#{cardSecundario.numeroCard}</strong> serão COPIADOS para a comanda <strong>#{cardPrincipal.numeroCard}</strong>.</li>
                    <li>O valor total da comanda <strong>#{cardPrincipal.numeroCard}</strong> será atualizado somando os valores.</li>
                    <li>A comanda <strong>#{cardSecundario.numeroCard}</strong> permanecerá <strong>INTACTA</strong> para conferência.</li>
                    <li>Após conferir, você poderá excluir a comanda secundária manualmente se desejar.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700"
            disabled={unificando}
          >
            Cancelar
          </button>
          <button
            onClick={solicitarUnificacao}
            disabled={!cardSecundario || unificando}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {unificando ? 'Unificando...' : (
              <>
                <Merge className="w-4 h-4" />
                Confirmar Unificação
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Senha Interno */}
      {modalSenhaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirmação de Segurança</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta ação copiará todos os itens e pagamentos. Por segurança, digite sua senha para confirmar.
            </p>
            
            <form onSubmit={confirmarUnificacaoComSenha}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sua Senha
                </label>
                <input
                  type="password"
                  value={senhaConfirmacao}
                  onChange={(e) => setSenhaConfirmacao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Digite sua senha..."
                  autoFocus
                  autoComplete="new-password"
                  name="password-confirmation"
                  id="password-confirmation"
                />
                {erroSenha && (
                  <p className="text-red-500 text-xs mt-1">{erroSenha}</p>
                )}
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalSenhaAberto(false)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  disabled={unificando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unificando || !senhaConfirmacao}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {unificando ? 'Validando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
