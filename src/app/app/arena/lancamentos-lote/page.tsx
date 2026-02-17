'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { produtoService, cardClienteService, historicoAtletaArenaService } from '@/services/gestaoArenaService';
import type { Produto, AtletaHistoricoArena } from '@/types/gestaoArena';
import { Search, Plus, Trash2, CheckCircle, AlertCircle, ShoppingCart, Users, CheckSquare, Square } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';
import { normalizeSearchText } from '@/lib/search';

export default function LancamentoLotePage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Dados
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  // Formulário Produto
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnitario, setValorUnitario] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [criarNovasComandas, setCriarNovasComandas] = useState(false);

  // Seleção de Atletas
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [atletasEncontrados, setAtletasEncontrados] = useState<AtletaHistoricoArena[]>([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<AtletaHistoricoArena[]>([]);
  const [buscandoAtletas, setBuscandoAtletas] = useState(false);

  useEffect(() => {
    carregarProdutos();
  }, [usuario?.pointIdGestor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (buscaAtleta.length >= 3) {
        buscarAtletas();
      } else {
        setAtletasEncontrados([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [buscaAtleta]);

  const carregarProdutos = async () => {
    if (!usuario?.pointIdGestor) return;
    try {
      setLoading(true);
      const data = await produtoService.listar(usuario.pointIdGestor, true);
      setProdutos(data);
    } catch (err) {
      console.error(err);
      setErro('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const buscarAtletas = async () => {
    if (!usuario?.pointIdGestor || !buscaAtleta) return;
    try {
      setBuscandoAtletas(true);
      const resultados = await historicoAtletaArenaService.buscarAtletas(usuario.pointIdGestor, buscaAtleta);
      // Filtrar atletas já selecionados
      const disponiveis = resultados.filter(a => !atletasSelecionados.some(s => s.id === a.id));
      setAtletasEncontrados(disponiveis);
    } catch (err) {
      console.error(err);
    } finally {
      setBuscandoAtletas(false);
    }
  };

  const selecionarAtleta = (atleta: AtletaHistoricoArena) => {
    setAtletasSelecionados([...atletasSelecionados, atleta]);
    setAtletasEncontrados(atletasEncontrados.filter(a => a.id !== atleta.id));
    setBuscaAtleta('');
  };

  const removerAtleta = (atletaId: string) => {
    setAtletasSelecionados(atletasSelecionados.filter(a => a.id !== atletaId));
  };

  const selecionarProduto = (produto: Produto) => {
    setProdutoSelecionado(produto);
    setValorUnitario(parseFloat(produto.precoVenda.toString()));
    setBuscaProduto(produto.nome);
  };

  const handleSubmit = async () => {
    if (!usuario?.pointIdGestor) return;
    if (!produtoSelecionado) {
      setErro('Selecione um produto');
      return;
    }
    if (atletasSelecionados.length === 0) {
      setErro('Selecione pelo menos um atleta');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      setSucesso('');

      const resultado = await cardClienteService.lancamentoLote({
        pointId: usuario.pointIdGestor,
        produtoId: produtoSelecionado.id,
        quantidade,
        valorUnitario: valorUnitario || undefined,
        observacao,
        criarNovasComandas,
        atletas: atletasSelecionados.map(a => ({ id: a.id, nome: a.nome })),
      });

      setSucesso(`Lançamento realizado com sucesso! ${resultado.resultados.sucesso} processados, ${resultado.resultados.falha} falhas.`);
      
      // Limpar formulário parcial
      setAtletasSelecionados([]);
      setBuscaAtleta('');
      
    } catch (err: any) {
      console.error(err);
      setErro(err.response?.data?.mensagem || 'Erro ao realizar lançamento em lote');
    } finally {
      setSalvando(false);
    }
  };

  // Filtrar produtos na busca
  const produtosFiltrados = buscaProduto 
    ? produtos.filter(p => normalizeSearchText(p.nome).includes(normalizeSearchText(buscaProduto)))
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Lançamento em Lote</h1>
        <p className="text-gray-600 mt-1">Lance itens para múltiplos atletas de uma vez (Eventos)</p>
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {sucesso}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Configuração do Lançamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Detalhes do Item</h2>
          </div>

          <div className="space-y-4">
            {/* Busca de Produto */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={buscaProduto}
                  onChange={(e) => {
                    setBuscaProduto(e.target.value);
                    if (!e.target.value) {
                      setProdutoSelecionado(null);
                      setValorUnitario(null);
                    }
                  }}
                  placeholder="Buscar produto..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              {/* Dropdown de produtos */}
              {buscaProduto && !produtoSelecionado && produtosFiltrados.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {produtosFiltrados.map(produto => (
                    <button
                      key={produto.id}
                      onClick={() => selecionarProduto(produto)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{produto.nome}</div>
                      <div className="text-xs text-emerald-600 font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(produto.precoVenda))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {produtoSelecionado && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-800 flex justify-between items-center">
                <span>Produto selecionado: <strong>{produtoSelecionado.nome}</strong></span>
                <button 
                  onClick={() => {
                    setProdutoSelecionado(null);
                    setBuscaProduto('');
                    setValorUnitario(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-800"
                >
                  Alterar
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <InputMonetario
                  label="Valor Unitário"
                  value={valorUnitario}
                  onChange={setValorUnitario}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                placeholder="Ex: Evento Corporativo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            <div 
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setCriarNovasComandas(!criarNovasComandas)}
            >
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                criarNovasComandas ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-400'
              }`}>
                {criarNovasComandas && <CheckCircle className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1">
                <span className="font-medium text-gray-900 block">Criar Novas Comandas</span>
                <span className="text-xs text-gray-500 block">
                  Se marcado, sempre criará uma nova comanda. Se desmarcado, tentará usar uma comanda aberta existente.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Seleção de Atletas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Atletas ({atletasSelecionados.length})</h2>
            </div>
            {atletasSelecionados.length > 0 && (
              <button 
                onClick={() => setAtletasSelecionados([])}
                className="text-xs text-red-600 hover:text-red-800 hover:underline"
              >
                Limpar todos
              </button>
            )}
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={buscaAtleta}
              onChange={(e) => setBuscaAtleta(e.target.value)}
              placeholder="Buscar atleta para adicionar..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {buscandoAtletas && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* Resultados da Busca */}
          {atletasEncontrados.length > 0 && (
            <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
              {atletasEncontrados.map(atleta => (
                <button
                  key={atleta.id}
                  onClick={() => selecionarAtleta(atleta)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between group"
                >
                  <span className="text-gray-900">{atleta.nome}</span>
                  <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                </button>
              ))}
            </div>
          )}

          {/* Lista de Selecionados */}
          <div className="flex-1 overflow-y-auto min-h-[200px] border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-2">
            {atletasSelecionados.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p>Nenhum atleta selecionado</p>
              </div>
            ) : (
              atletasSelecionados.map(atleta => (
                <div key={atleta.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {atleta.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-gray-900 font-medium">{atleta.nome}</span>
                  </div>
                  <button
                    onClick={() => removerAtleta(atleta.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={salvando || !produtoSelecionado || atletasSelecionados.length === 0}
          className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
        >
          {salvando ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              Processando...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Gerar Lançamentos ({atletasSelecionados.length})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
