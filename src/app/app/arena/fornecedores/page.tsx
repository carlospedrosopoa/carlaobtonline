// app/app/arena/fornecedores/page.tsx - Fornecedores
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fornecedorService } from '@/services/gestaoArenaService';
import type { Fornecedor, CriarFornecedorPayload, AtualizarFornecedorPayload } from '@/types/gestaoArena';
import { Plus, Search, Truck, Edit, Trash2, CheckCircle, XCircle, Phone, Mail, MapPin } from 'lucide-react';

export default function FornecedoresPage() {
  const { usuario } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Fornecedor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<CriarFornecedorPayload>({
    pointId: '',
    nome: '',
    nomeFantasia: '',
    cnpj: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    observacoes: '',
    ativo: true,
  });

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      setForm((prev) => ({ ...prev, pointId: usuario.pointIdGestor! }));
      carregarFornecedores();
    }
  }, [usuario?.pointIdGestor, apenasAtivos]);

  const carregarFornecedores = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const data = await fornecedorService.listar(usuario.pointIdGestor, apenasAtivos);
      setFornecedores(data);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (fornecedor?: Fornecedor) => {
    if (fornecedor) {
      setFornecedorEditando(fornecedor);
      setForm({
        pointId: fornecedor.pointId,
        nome: fornecedor.nome,
        nomeFantasia: fornecedor.nomeFantasia || '',
        cnpj: fornecedor.cnpj || '',
        cpf: fornecedor.cpf || '',
        telefone: fornecedor.telefone || '',
        email: fornecedor.email || '',
        endereco: fornecedor.endereco || '',
        observacoes: fornecedor.observacoes || '',
        ativo: fornecedor.ativo,
      });
    } else {
      setFornecedorEditando(null);
      setForm({
        pointId: usuario?.pointIdGestor || '',
        nome: '',
        nomeFantasia: '',
        cnpj: '',
        cpf: '',
        telefone: '',
        email: '',
        endereco: '',
        observacoes: '',
        ativo: true,
      });
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setFornecedorEditando(null);
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

      if (fornecedorEditando) {
        const payload: AtualizarFornecedorPayload = {
          nome: form.nome,
          nomeFantasia: form.nomeFantasia || undefined,
          cnpj: form.cnpj || undefined,
          cpf: form.cpf || undefined,
          telefone: form.telefone || undefined,
          email: form.email || undefined,
          endereco: form.endereco || undefined,
          observacoes: form.observacoes || undefined,
          ativo: form.ativo,
        };
        await fornecedorService.atualizar(fornecedorEditando.id, payload);
      } else {
        await fornecedorService.criar(form);
      }

      await carregarFornecedores();
      fecharModal();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar fornecedor');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (fornecedor: Fornecedor) => {
    if (!confirm(`Tem certeza que deseja deletar o fornecedor "${fornecedor.nome}"?`)) return;

    try {
      await fornecedorService.deletar(fornecedor.id);
      await carregarFornecedores();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar fornecedor');
    }
  };

  const fornecedoresFiltrados = fornecedores.filter((fornecedor) => {
    const matchBusca =
      busca === '' ||
      fornecedor.nome.toLowerCase().includes(busca.toLowerCase()) ||
      fornecedor.nomeFantasia?.toLowerCase().includes(busca.toLowerCase()) ||
      fornecedor.cnpj?.includes(busca) ||
      fornecedor.cpf?.includes(busca);
    return matchBusca;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando fornecedores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-gray-600 mt-1">Gerencie os fornecedores da arena</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Fornecedor
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar fornecedores..."
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

      {/* Lista de Fornecedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fornecedoresFiltrados.map((fornecedor) => (
          <div key={fornecedor.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">{fornecedor.nome}</h3>
                </div>
                {fornecedor.nomeFantasia && (
                  <p className="text-sm text-gray-600 mb-2">{fornecedor.nomeFantasia}</p>
                )}
                {fornecedor.ativo ? (
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
                  onClick={() => abrirModal(fornecedor)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deletar(fornecedor)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {fornecedor.cnpj && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-medium">CNPJ:</span>
                  <span>{fornecedor.cnpj}</span>
                </div>
              )}
              {fornecedor.cpf && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-medium">CPF:</span>
                  <span>{fornecedor.cpf}</span>
                </div>
              )}
              {fornecedor.telefone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{fornecedor.telefone}</span>
                </div>
              )}
              {fornecedor.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{fornecedor.email}</span>
                </div>
              )}
              {fornecedor.endereco && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <span>{fornecedor.endereco}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {fornecedoresFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum fornecedor encontrado</p>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {fornecedorEditando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
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
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  value={form.nomeFantasia}
                  onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Nome fantasia"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Endereço completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Observações sobre o fornecedor"
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
                  Fornecedor ativo
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

