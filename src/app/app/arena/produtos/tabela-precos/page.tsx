'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { produtoService } from '@/services/gestaoArenaService';
import type { Produto } from '@/types/gestaoArena';
import { Search, Save, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import InputMonetario from '@/components/InputMonetario';
import { normalizeSearchText } from '@/lib/search';

export default function TabelaPrecosPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [alteracoes, setAlteracoes] = useState<Map<string, number>>(new Map());
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarProdutos();
    }
  }, [usuario?.pointIdGestor]);

  const carregarProdutos = async () => {
    if (!usuario?.pointIdGestor) return;

    try {
      setLoading(true);
      const data = await produtoService.listar(usuario.pointIdGestor, true); // Apenas ativos
      setProdutos(data);
      setAlteracoes(new Map());
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar produtos' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrecoChange = (id: string, novoPreco: number) => {
    setAlteracoes((prev) => {
      const newMap = new Map(prev);
      const produtoOriginal = produtos.find((p) => p.id === id);
      
      // Se o preço for igual ao original, remove da lista de alterações
      if (produtoOriginal && produtoOriginal.precoVenda === novoPreco) {
        newMap.delete(id);
      } else {
        newMap.set(id, novoPreco);
      }
      return newMap;
    });
  };

  const salvarAlteracoes = async () => {
    if (alteracoes.size === 0) return;

    try {
      setSalvando(true);
      setMensagem(null);

      const updates = Array.from(alteracoes.entries()).map(([id, precoVenda]) => ({
        id,
        precoVenda,
      }));

      await produtoService.atualizarEmMassa(updates);
      
      setMensagem({ tipo: 'sucesso', texto: `${updates.length} produtos atualizados com sucesso!` });
      await carregarProdutos();
    } catch (error: any) {
      console.error('Erro ao salvar alterações:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: error?.response?.data?.mensagem || 'Erro ao salvar alterações' 
      });
    } finally {
      setSalvando(false);
    }
  };

  const buscaNorm = normalizeSearchText(busca);
  const produtosFiltrados = produtos.filter((produto) => {
    const matchBusca = buscaNorm === '' || normalizeSearchText(produto.nome).includes(buscaNorm);
    const matchCategoria = filtroCategoria === '' || produto.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const categorias = Array.from(new Set(produtos.map((p) => p.categoria).filter((cat): cat is string => Boolean(cat))));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando tabela de preços...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Tabela de Preços</h1>
          <p className="text-gray-600 mt-1">Atualize os preços dos produtos em massa</p>
        </div>
        
        {alteracoes.size > 0 && (
          <div className="flex items-center gap-4 animate-fadeIn">
            <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              {alteracoes.size} {alteracoes.size === 1 ? 'alteração pendente' : 'alterações pendentes'}
            </span>
            <button
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70"
            >
              {salvando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Salvar Alterações
            </button>
          </div>
        )}
      </div>

      {mensagem && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mensagem.tipo === 'sucesso' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {mensagem.texto}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4 sticky top-0 z-10 border-b border-gray-100">
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-w-[200px]"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                <th className="px-6 py-4 w-[40%]">Produto</th>
                <th className="px-6 py-4 w-[30%]">Categoria</th>
                <th className="px-6 py-4 w-[30%] text-right">Preço de Venda (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produtosFiltrados.map((produto) => {
                const precoAtual = alteracoes.has(produto.id) ? alteracoes.get(produto.id)! : produto.precoVenda;
                const modificado = alteracoes.has(produto.id);

                return (
                  <tr key={produto.id} className={`hover:bg-gray-50 transition-colors ${modificado ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{produto.nome}</div>
                      {produto.descricao && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{produto.descricao}</div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {produto.categoria ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          {produto.categoria}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end">
                        <div className={`w-32 ${modificado ? 'ring-2 ring-amber-400 rounded-lg' : ''}`}>
                          <InputMonetario
                            value={precoAtual}
                            onChange={(val) => handlePrecoChange(produto.id, val || 0)}
                            min={0}
                            className="text-right font-medium"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {produtosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    Nenhum produto encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
