// components/CriarEditarCardModal.tsx - Modal para criar/editar card com seleção de cliente
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService } from '@/services/gestaoArenaService';
import { api } from '@/lib/api';
import type { CardCliente, CriarCardClientePayload, AtualizarCardClientePayload } from '@/types/gestaoArena';
import { X, User, UserPlus, Search, Trash2 } from 'lucide-react';

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

type VinculoPreview =
  | {
      tipo: 'existente_com_usuario';
      atletaId: string;
      usuarioId: string;
      nome: string;
      telefone: string;
      email: string | null;
    }
  | {
      tipo: 'existente_sem_usuario';
      atletaId: string;
      nome: string;
      telefone: string;
      email: string | null;
    }
  | {
      tipo: 'novo';
      nome: string;
      telefone: string;
    };

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
  const [mostrarModalExcluir, setMostrarModalExcluir] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [vinculandoCliente, setVinculandoCliente] = useState(false);
  const [vinculoPreview, setVinculoPreview] = useState<VinculoPreview | null>(null);
  const [nomeAvulsoAntesPreview, setNomeAvulsoAntesPreview] = useState<string | null>(null);

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
      setVinculoPreview(null);
      setNomeAvulsoAntesPreview(null);
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

  const normalizarTelefone = (telefone: string) => telefone.replace(/\D/g, '');

  const prepararVinculo = async () => {
    if (!usuario?.pointIdGestor) return;

    const telefoneNormalizado = normalizarTelefone(telefoneAvulso);
    if (telefoneNormalizado.length < 10) {
      setErro('Informe um telefone válido para criar/vincular o atleta');
      return;
    }

    if (!nomeAvulso.trim()) {
      setErro('Informe o nome do cliente avulso antes de criar/vincular');
      return;
    }

    try {
      setVinculandoCliente(true);
      setErro('');

      try {
        const resBusca = await api.post('/user/atleta/buscar-por-telefone', {
          telefone: telefoneNormalizado,
        });
        const atletaId = resBusca.data?.id as string | undefined;
        const usuarioId = resBusca.data?.usuarioId as string | null | undefined;
        const nome = (resBusca.data?.nome as string | undefined) || nomeAvulso.trim();
        const telefone = (resBusca.data?.telefone as string | undefined) || telefoneNormalizado;
        const email = (resBusca.data?.email as string | null | undefined) ?? null;

        if (!nomeAvulsoAntesPreview) {
          setNomeAvulsoAntesPreview(nomeAvulso);
        }
        setNomeAvulso(nome);

        if (usuarioId) {
          setVinculoPreview({
            tipo: 'existente_com_usuario',
            atletaId: atletaId || '',
            usuarioId,
            nome,
            telefone,
            email,
          });
        } else {
          setVinculoPreview({
            tipo: 'existente_sem_usuario',
            atletaId: atletaId || '',
            nome,
            telefone,
            email,
          });
        }
      } catch (err: any) {
        const codigo = err?.response?.data?.codigo;
        const status = err?.response?.status;
        if (codigo === 'ATLETA_NAO_ENCONTRADO' || status === 404) {
          setVinculoPreview({
            tipo: 'novo',
            nome: nomeAvulso.trim(),
            telefone: telefoneNormalizado,
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao criar/vincular atleta');
    } finally {
      setVinculandoCliente(false);
    }
  };

  const cancelarPreviewVinculo = () => {
    setVinculoPreview(null);
    if (nomeAvulsoAntesPreview !== null) {
      setNomeAvulso(nomeAvulsoAntesPreview);
      setNomeAvulsoAntesPreview(null);
    }
  };

  const confirmarVinculo = async () => {
    if (!usuario?.pointIdGestor) return;
    if (!vinculoPreview) return;

    try {
      setVinculandoCliente(true);
      setErro('');

      const telefoneNormalizado = normalizarTelefone(telefoneAvulso);
      if (telefoneNormalizado.length < 10) {
        setErro('Informe um telefone válido');
        return;
      }

      let usuarioId: string | null = null;
      let atletaId: string | null = null;

      if (vinculoPreview.tipo === 'existente_com_usuario') {
        usuarioId = vinculoPreview.usuarioId;
        atletaId = vinculoPreview.atletaId || null;
      }

      if (vinculoPreview.tipo === 'existente_sem_usuario' || vinculoPreview.tipo === 'novo') {
        const resCriar = await api.post('/user/criar-incompleto', {
          name: nomeAvulso.trim(),
          telefone: telefoneNormalizado,
        });
        usuarioId = resCriar.data?.usuario?.id ?? null;
        atletaId = resCriar.data?.usuario?.atletaId ?? null;
      }

      if (!usuarioId) {
        setErro('Não foi possível obter o usuário para vincular');
        return;
      }

      if (atletaId) {
        try {
          await api.post(`/atleta/${atletaId}/vincular-arena`);
        } catch (err: any) {
          const codigo = err?.response?.data?.codigo;
          if (codigo !== 'ATLETA_JA_VINCULADO') {
            throw err;
          }
        }
      }

      if (card) {
        await cardClienteService.atualizar(card.id, {
          usuarioId,
          nomeAvulso: null,
          telefoneAvulso: null,
        });
        onSuccess();
        onClose();
        return;
      }

      await carregarAtletas();
      setVinculoPreview(null);
      setNomeAvulsoAntesPreview(null);
      setTipoCliente('cadastrado');
      setAtletaSelecionado(usuarioId);
      setBuscaAtleta('');
      setNomeAvulso('');
      setTelefoneAvulso('');
      alert('Cliente vinculado e comanda atualizada!');
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao confirmar vínculo');
    } finally {
      setVinculandoCliente(false);
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

  const excluirCard = async () => {
    if (!card) return;

    if (!senhaExclusao) {
      setErro('Por favor, informe sua senha para excluir o card');
      return;
    }

    const confirmacao = confirm(
      '⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL.\n\n' +
      'Tem certeza que deseja excluir esta comanda?\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    if (!confirmacao) {
      setSenhaExclusao('');
      setMostrarModalExcluir(false);
      return;
    }

    try {
      setExcluindo(true);
      setErro('');
      await cardClienteService.deletar(card.id, senhaExclusao);
      alert('Card excluído com sucesso');
      onSuccess(); // Recarregar lista
      onClose();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao excluir card');
    } finally {
      setExcluindo(false);
      setSenhaExclusao('');
      setMostrarModalExcluir(false);
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
            {card ? 'Editar Comanda' : 'Nova Comanda'}
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={telefoneAvulso}
                    onChange={(e) => setTelefoneAvulso(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={prepararVinculo}
                    disabled={
                      vinculandoCliente ||
                      salvando ||
                      excluindo ||
                      normalizarTelefone(telefoneAvulso).length < 10 ||
                      !nomeAvulso.trim()
                    }
                    className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Criar/vincular atleta e converter para cliente cadastrado"
                  >
                    {vinculandoCliente ? '...' : 'Buscar'}
                  </button>
                </div>

                {vinculoPreview && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    {vinculoPreview.tipo === 'existente_com_usuario' && (
                      <div className="text-sm text-emerald-900">
                        <div className="font-semibold">Atleta encontrado</div>
                        <div>{vinculoPreview.nome}</div>
                        {vinculoPreview.email && <div className="text-emerald-800">{vinculoPreview.email}</div>}
                        <div className="mt-2 text-emerald-800">Converter esta comanda para cliente cadastrado?</div>
                      </div>
                    )}

                    {vinculoPreview.tipo === 'existente_sem_usuario' && (
                      <div className="text-sm text-emerald-900">
                        <div className="font-semibold">Atleta encontrado (sem usuário do app)</div>
                        <div>{vinculoPreview.nome}</div>
                        <div className="mt-2 text-emerald-800">Será criado um usuário para este telefone e a comanda será convertida.</div>
                      </div>
                    )}

                    {vinculoPreview.tipo === 'novo' && (
                      <div className="text-sm text-emerald-900">
                        <div className="font-semibold">Nenhum atleta encontrado</div>
                        <div className="mt-2 text-emerald-800">Será criado um novo atleta/usuário com:</div>
                        <div className="mt-1">{vinculoPreview.nome}</div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={cancelarPreviewVinculo}
                        disabled={vinculandoCliente}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-white disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={confirmarVinculo}
                        disabled={vinculandoCliente}
                        className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
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
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              {card && (
                <button
                  onClick={() => setMostrarModalExcluir(true)}
                  disabled={salvando || excluindo}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Comanda
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || excluindo}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Modal de confirmação de exclusão */}
            {mostrarModalExcluir && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">Confirmar Exclusão</h3>
                  <p className="text-sm text-red-700 mb-3">
                    Para excluir esta comanda, por favor, informe sua senha:
                  </p>
                  <input
                    type="password"
                    value={senhaExclusao}
                    onChange={(e) => setSenhaExclusao(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3"
                    disabled={excluindo}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setMostrarModalExcluir(false);
                        setSenhaExclusao('');
                        setErro('');
                      }}
                      disabled={excluindo}
                      className="flex-1 px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={excluirCard}
                      disabled={excluindo || !senhaExclusao}
                      className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {excluindo ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

