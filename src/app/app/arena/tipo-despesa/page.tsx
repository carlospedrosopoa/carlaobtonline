// app/app/arena/tipo-despesa/page.tsx - Tipo de Despesa
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { tipoDespesaService } from '@/services/gestaoArenaService';
import type { TipoDespesa, CriarTipoDespesaPayload, AtualizarTipoDespesaPayload } from '@/types/gestaoArena';
import { Plus, Search, Receipt, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function TipoDespesaPage() {
  const { usuario } = useAuth();
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoDespesaEditando, setTipoDespesaEditando] = useState<TipoDespesa | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<CriarTipoDespesaPayload>({
    pointId: '',
    nome: '',
    descricao: '',
    ativo: true,
  });

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      setForm((prev) => ({ ...prev, pointId: usuario.pointIdGestor! }));
      carregarTiposDespesa();
    }
  }, [usuario?.pointIdGestor, apenasAtivos]);

  const carregarTiposDespesa = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const data = await tipoDespesaService.listar(usuario.pointIdGestor, apenasAtivos);
      setTiposDespesa(data);
    } catch (error) {
      console.error('Erro ao carregar tipos de despesa:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (tipoDespesa?: TipoDespesa) => {
    if (tipoDespesa) {
      setTipoDespesaEditando(tipoDespesa);
      setForm({
        pointId: tipoDespesa.pointId,
        nome: tipoDespesa.nome,
        descricao: tipoDespesa.descricao || '',
        ativo: tipoDespesa.ativo,
      });
    } else {
      setTipoDespesaEditando(null);
      setForm({
        pointId: usuario?.pointIdGestor || '',
        nome: '',
        descricao: '',
        ativo: true,
      });
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setTipoDespesaEditando(null);
    setErro('');
  };

  const salvar = async () => {
    if (!form.nome) {
      setErro('Nome é obrigatório');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      if (tipoDespesaEditando) {
        const payload: AtualizarTipoDespesaPayload = {
          nome: form.nome,
          descricao: form.descricao || undefined,
          ativo: form.ativo,
        };
        await tipoDespesaService.atualizar(tipoDespesaEditando.id, payload);
      } else {
        await tipoDespesaService.criar(form);
      }

      await carregarTiposDespesa();
      fecharModal();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar tipo de despesa');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (tipoDespesa: TipoDespesa) => {
    if (!confirm(`Tem certeza que deseja deletar o tipo de despesa "${tipoDespesa.nome}"?`)) return;

    try {
      await tipoDespesaService.deletar(tipoDespesa.id);
      await carregarTiposDespesa();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar tipo de despesa');
    }
  };

  const tiposDespesaFiltrados = tiposDespesa.filter((tipo) => {
    const matchBusca = busca === '' || tipo.nome.toLowerCase().includes(busca.toLowerCase());
    return matchBusca;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando tipos de despesa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tipo de Despesa</h1>
          <p className="text-gray-600 mt-1">Gerencie os tipos de despesa da sua arena</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Tipo de Despesa
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar tipos de despesa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={apenasAtivos}
            onChange={(e) => setApenasAtivos(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Apenas ativos</span>
        </label>
      </div>

      {/* Lista de Tipos de Despesa */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiposDespesaFiltrados.map((tipo) => (
          <div key={tipo.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">{tipo.nome}</h3>
                </div>
                {tipo.ativo ? (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                    <CheckCircle className="w-3 h-3" /> Ativo
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                    <XCircle className="w-3 h-3" /> Inativo
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModal(tipo)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deletar(tipo)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tipo.descricao && (
              <p className="text-sm text-gray-600">{tipo.descricao}</p>
            )}
          </div>
        ))}
      </div>

      {tiposDespesaFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum tipo de despesa encontrado</p>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {tipoDespesaEditando ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}
            </h2>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {erro}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Ex: Aluguel, Salários, Manutenção..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Descrição do tipo de despesa (opcional)"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="rounded"
                  id="ativo"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Tipo de despesa ativo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={fecharModal}
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
      )}
    </div>
  );
}

