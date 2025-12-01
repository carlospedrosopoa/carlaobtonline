// app/app/arena/produtos/page.tsx - Produtos
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { produtoService } from '@/services/gestaoArenaService';
import type { Produto, CriarProdutoPayload, AtualizarProdutoPayload } from '@/types/gestaoArena';
import { Plus, Search, Package, Edit, Trash2, CheckCircle, XCircle, DollarSign } from 'lucide-react';

export default function ProdutosPage() {
  const { usuario } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<CriarProdutoPayload>({
    pointId: '',
    nome: '',
    descricao: '',
    precoVenda: 0,
    precoCusto: undefined,
    categoria: '',
    ativo: true,
  });

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      setForm((prev) => ({ ...prev, pointId: usuario.pointIdGestor! }));
      carregarProdutos();
    }
  }, [usuario?.pointIdGestor, apenasAtivos]);

  const carregarProdutos = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const data = await produtoService.listar(usuario.pointIdGestor, apenasAtivos);
      setProdutos(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (produto?: Produto) => {
    if (produto) {
      setProdutoEditando(produto);
      setForm({
        pointId: produto.pointId,
        nome: produto.nome,
        descricao: produto.descricao || '',
        precoVenda: produto.precoVenda,
        precoCusto: produto.precoCusto || undefined,
        categoria: produto.categoria || '',
        ativo: produto.ativo,
      });
    } else {
      setProdutoEditando(null);
      setForm({
        pointId: usuario?.pointIdGestor || '',
        nome: '',
        descricao: '',
        precoVenda: 0,
        precoCusto: undefined,
        categoria: '',
        ativo: true,
      });
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setProdutoEditando(null);
    setErro('');
  };

  const salvar = async () => {
    if (!form.nome || !form.precoVenda || form.precoVenda <= 0) {
      setErro('Nome e preço de venda são obrigatórios');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      if (produtoEditando) {
        const payload: AtualizarProdutoPayload = {
          nome: form.nome,
          descricao: form.descricao || undefined,
          precoVenda: form.precoVenda,
          precoCusto: form.precoCusto || undefined,
          categoria: form.categoria || undefined,
          ativo: form.ativo,
        };
        await produtoService.atualizar(produtoEditando.id, payload);
      } else {
        await produtoService.criar(form);
      }

      await carregarProdutos();
      fecharModal();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar produto');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (produto: Produto) => {
    if (!confirm(`Tem certeza que deseja deletar o produto "${produto.nome}"?`)) return;

    try {
      await produtoService.deletar(produto.id);
      await carregarProdutos();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar produto');
    }
  };

  const produtosFiltrados = produtos.filter((produto) => {
    const matchBusca = busca === '' || produto.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = filtroCategoria === '' || produto.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const categorias = Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean)));

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-600 mt-1">Gerencie os produtos do bar/copa</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
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

      {/* Lista de Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtosFiltrados.map((produto) => (
          <div key={produto.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">{produto.nome}</h3>
                </div>
                {produto.ativo ? (
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
                  onClick={() => abrirModal(produto)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deletar(produto)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {produto.descricao && (
              <p className="text-sm text-gray-600 mb-3">{produto.descricao}</p>
            )}

            {produto.categoria && (
              <div className="mb-3">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  {produto.categoria}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Preço de Venda:</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatarMoeda(produto.precoVenda)}
                </span>
              </div>
              {produto.precoCusto && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Preço de Custo:</span>
                  <span className="font-semibold text-gray-700">{formatarMoeda(produto.precoCusto)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {produtosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum produto encontrado</p>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {produtoEditando ? 'Editar Produto' : 'Novo Produto'}
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
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Descrição do produto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoVenda}
                    onChange={(e) => setForm({ ...form, precoVenda: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoCusto || ''}
                    onChange={(e) => setForm({ ...form, precoCusto: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Ex: Bebidas, Lanches, etc."
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
                  Produto ativo
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

