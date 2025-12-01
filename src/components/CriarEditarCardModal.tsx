// components/CriarEditarCardModal.tsx - Modal para criar/editar card com seleção de cliente
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import { api } from '@/lib/api';
import type { CardCliente, CriarCardClientePayload, AtualizarCardClientePayload } from '@/types/gestaoArena';
import { X, User, UserPlus, Search } from 'lucide-react';

interface CriarEditarCardModalProps {
  isOpen: boolean;
  card: CardCliente | null;
  onClose: () => void;
  onSuccess: (cardCriado?: CardCliente) => void; // Retorna o card criado para abrir o modal de venda
}

interface Atleta {
  id: string;
  nome: string;
  fone?: string;
  usuarioId: string;
}

export default function CriarEditarCardModal({ isOpen, card, onClose, onSuccess }: CriarEditarCardModalProps) {
  const { usuario } = useAuth();
  const [tipoCliente, setTipoCliente] = useState<'cadastrado' | 'avulso'>('cadastrado');
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [atletaSelecionado, setAtletaSelecionado] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telefoneAvulso, setTelefoneAvulso] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (card) {
        // Modo edição
        if (card.usuarioId) {
          setTipoCliente('cadastrado');
          setAtletaSelecionado(card.usuarioId);
        } else {
          setTipoCliente('avulso');
          setNomeAvulso(card.nomeAvulso || '');
          setTelefoneAvulso(card.telefoneAvulso || '');
        }
        setObservacoes(card.observacoes || '');
      } else {
        // Modo criação
        setTipoCliente('cadastrado');
        setAtletaSelecionado('');
        setNomeAvulso('');
        setTelefoneAvulso('');
        setObservacoes('');
        setBuscaAtleta('');
      }
      setErro('');
      carregarAtletas();
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

  const carregarAtletas = async () => {
    try {
      setCarregandoAtletas(true);
      const { data } = await api.get('/atleta/listarAtletas');
      const atletasList = Array.isArray(data) ? data : (data.atletas || []);
      setAtletas(atletasList);
    } catch (error) {
      console.error('Erro ao carregar atletas:', error);
    } finally {
      setCarregandoAtletas(false);
    }
  };

  const salvar = async () => {
    if (!usuario?.pointIdGestor) return;

    // Validações
    if (tipoCliente === 'cadastrado' && !atletaSelecionado) {
      setErro('Selecione um cliente');
      return;
    }

    if (tipoCliente === 'avulso') {
      if (!nomeAvulso) {
        setErro('Nome é obrigatório para cliente avulso');
        return;
      }
    }

    try {
      setSalvando(true);
      setErro('');

      if (card) {
        // Editar card
        const payload: AtualizarCardClientePayload = {
          observacoes: observacoes || undefined,
          usuarioId: tipoCliente === 'cadastrado' ? atletaSelecionado : null,
          nomeAvulso: tipoCliente === 'avulso' ? nomeAvulso : null,
          telefoneAvulso: tipoCliente === 'avulso' ? telefoneAvulso : null,
        };
        await cardClienteService.atualizar(card.id, payload);
      } else {
        // Criar card
        const payload: CriarCardClientePayload = {
          pointId: usuario.pointIdGestor,
          observacoes: observacoes || undefined,
          usuarioId: tipoCliente === 'cadastrado' ? atletaSelecionado : undefined,
          nomeAvulso: tipoCliente === 'avulso' ? nomeAvulso : undefined,
          telefoneAvulso: tipoCliente === 'avulso' ? telefoneAvulso : undefined,
        };
        const cardCriado = await cardClienteService.criar(payload);
        onSuccess(cardCriado); // Retorna o card criado
        onClose();
        return; // Não executar o código abaixo
      }

      onSuccess(); // Para edição, não retorna card
      onClose();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar card');
    } finally {
      setSalvando(false);
    }
  };

  const atletasFiltrados = atletas.filter((atleta) => {
    const matchBusca =
      buscaAtleta === '' ||
      atleta.nome.toLowerCase().includes(buscaAtleta.toLowerCase()) ||
      atleta.fone?.includes(buscaAtleta);
    return matchBusca;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {card ? 'Editar Card' : 'Novo Card'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        )}

        <div className="space-y-4">
          {/* Tipo de Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cliente</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipoCliente('cadastrado');
                  setNomeAvulso('');
                  setTelefoneAvulso('');
                  setErro('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  tipoCliente === 'cadastrado'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <User className="w-5 h-5" />
                  <span>Cliente Cadastrado</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoCliente('avulso');
                  setAtletaSelecionado('');
                  setErro('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  tipoCliente === 'avulso'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  <span>Cliente Avulso</span>
                </div>
              </button>
            </div>
          </div>

          {/* Seleção de Cliente Cadastrado */}
          {tipoCliente === 'cadastrado' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={buscaAtleta}
                  onChange={(e) => setBuscaAtleta(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-2"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                {carregandoAtletas ? (
                  <div className="p-4 text-center text-gray-500">Carregando...</div>
                ) : atletasFiltrados.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">Nenhum cliente encontrado</div>
                ) : (
                  atletasFiltrados.map((atleta) => (
                    <button
                      key={atleta.id}
                      type="button"
                      onClick={() => setAtletaSelecionado(atleta.usuarioId)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        atletaSelecionado === atleta.usuarioId ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{atleta.nome}</div>
                      {atleta.fone && (
                        <div className="text-sm text-gray-600">{atleta.fone}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Dados do Cliente Avulso */}
          {tipoCliente === 'avulso' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={nomeAvulso}
                  onChange={(e) => setNomeAvulso(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={telefoneAvulso}
                  onChange={(e) => setTelefoneAvulso(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Observações sobre o card..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

