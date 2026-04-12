// app/app/arena/produtos/page.tsx - Produtos
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cardClienteService, produtoService } from '@/services/gestaoArenaService';
import type { CardCliente, Produto, CriarProdutoPayload, AtualizarProdutoPayload, HistoricoVendaProdutoItem } from '@/types/gestaoArena';
import GerenciarCardModal from '@/components/GerenciarCardModal';
import { Plus, Search, Package, Edit, Trash2, CheckCircle, XCircle, DollarSign, Zap, Clock, Calendar, X, ArrowUpDown, ArrowUp, ArrowDown, Printer } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';
import { normalizeSearchText } from '@/lib/search';

function isoStartOfDay(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00.000Z`);
  const tzPart = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;

  const m = tzPart ? tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/) : null;
  const hh = m ? String(Math.abs(parseInt(m[1], 10))).padStart(2, '0') : '03';
  const mm = m && m[2] ? m[2] : '00';
  const sign = m ? (parseInt(m[1], 10) >= 0 ? '+' : '-') : '-';
  return new Date(`${dateStr}T00:00:00.000${sign}${hh}:${mm}`).toISOString();
}

function isoEndOfDay(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00.000Z`);
  const tzPart = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;

  const m = tzPart ? tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/) : null;
  const hh = m ? String(Math.abs(parseInt(m[1], 10))).padStart(2, '0') : '03';
  const mm = m && m[2] ? m[2] : '00';
  const sign = m ? (parseInt(m[1], 10) >= 0 ? '+' : '-') : '-';
  return new Date(`${dateStr}T23:59:59.999${sign}${hh}:${mm}`).toISOString();
}

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
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [produtoHistorico, setProdutoHistorico] = useState<Produto | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoErro, setHistoricoErro] = useState('');
  const [historicoItens, setHistoricoItens] = useState<HistoricoVendaProdutoItem[]>([]);
  const [modalCardAberto, setModalCardAberto] = useState(false);
  const [cardParaAbrir, setCardParaAbrir] = useState<CardCliente | null>(null);
  const [abrindoCard, setAbrindoCard] = useState(false);
  const [filtroSituacaoComanda, setFiltroSituacaoComanda] = useState<'TODAS' | 'PAGAS' | 'EM_ABERTO'>('TODAS');
  type SortFieldHistorico =
    | 'numeroCard'
    | 'cliente'
    | 'dataVenda'
    | 'quantidade'
    | 'valorItem'
    | 'valorTotalComanda'
    | 'valorPagoComanda'
    | 'saldoComanda';
  type SortOrderHistorico = 'asc' | 'desc';
  const [sortFieldHistorico, setSortFieldHistorico] = useState<SortFieldHistorico>('dataVenda');
  const [sortOrderHistorico, setSortOrderHistorico] = useState<SortOrderHistorico>('desc');
  const [dataInicioHistorico, setDataInicioHistorico] = useState(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 30);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(inicio);
  });
  const [dataFimHistorico, setDataFimHistorico] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  });
  const [form, setForm] = useState<CriarProdutoPayload>({
    pointId: '',
    nome: '',
    descricao: '',
    precoVenda: 0,
    precoCusto: undefined,
    categoria: '',
    ativo: true,
    acessoRapido: false,
    autoAtendimento: true,
    barcode: '',
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
        acessoRapido: produto.acessoRapido ?? false,
        autoAtendimento: produto.autoAtendimento ?? true,
        barcode: produto.barcode || '',
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
        acessoRapido: false,
        autoAtendimento: true,
        barcode: '',
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

  const abrirHistorico = async (produto: Produto) => {
    if (!usuario?.pointIdGestor) return;
    setProdutoHistorico(produto);
    setHistoricoErro('');
    setHistoricoItens([]);
    setModalHistoricoAberto(true);
    try {
      setHistoricoLoading(true);
      const itens = await produtoService.historicoVendas(
        produto.id,
        usuario.pointIdGestor,
        dataInicioHistorico ? isoStartOfDay(dataInicioHistorico) : undefined,
        dataFimHistorico ? isoEndOfDay(dataFimHistorico) : undefined
      );
      setHistoricoItens(Array.isArray(itens) ? itens : []);
    } catch (e: any) {
      setHistoricoErro(e?.response?.data?.mensagem || 'Erro ao carregar histórico de vendas');
    } finally {
      setHistoricoLoading(false);
    }
  };

  const aplicarFiltroHistorico = async () => {
    if (!usuario?.pointIdGestor || !produtoHistorico) return;
    try {
      setHistoricoLoading(true);
      setHistoricoErro('');
      const itens = await produtoService.historicoVendas(
        produtoHistorico.id,
        usuario.pointIdGestor,
        dataInicioHistorico ? isoStartOfDay(dataInicioHistorico) : undefined,
        dataFimHistorico ? isoEndOfDay(dataFimHistorico) : undefined
      );
      setHistoricoItens(Array.isArray(itens) ? itens : []);
    } catch (e: any) {
      setHistoricoErro(e?.response?.data?.mensagem || 'Erro ao carregar histórico de vendas');
    } finally {
      setHistoricoLoading(false);
    }
  };

  const handleSortHistorico = (field: SortFieldHistorico) => {
    if (sortFieldHistorico === field) {
      setSortOrderHistorico((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortFieldHistorico(field);
      setSortOrderHistorico('asc');
    }
  };

  const getSortIconHistorico = (field: SortFieldHistorico) => {
    if (sortFieldHistorico !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortOrderHistorico === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
    );
  };

  const abrirComanda = async (cardId: string) => {
    try {
      setAbrindoCard(true);
      const card = await cardClienteService.obter(cardId, true, true, true);
      setCardParaAbrir(card);
      setModalCardAberto(true);
    } catch (e: any) {
      alert(e?.response?.data?.mensagem || 'Erro ao abrir comanda');
    } finally {
      setAbrindoCard(false);
    }
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
          acessoRapido: form.acessoRapido,
          autoAtendimento: form.autoAtendimento,
          barcode: form.barcode || undefined,
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

  const buscaNorm = normalizeSearchText(busca);
  const produtosFiltrados = produtos.filter((produto) => {
    const matchBusca = buscaNorm === '' || normalizeSearchText(produto.nome).includes(buscaNorm);
    const matchCategoria = filtroCategoria === '' || produto.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const categorias = Array.from(new Set(produtos.map((p) => p.categoria).filter((cat): cat is string => Boolean(cat))));
  const produtosAcessoRapido = produtos.filter((p) => p.acessoRapido);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarDataHora = (dataISO: string) => {
    const d = new Date(dataISO);
    if (Number.isNaN(d.getTime())) {
      const alt = new Date(String(dataISO).replace(' ', 'T'));
      if (Number.isNaN(alt.getTime())) return String(dataISO);
      return alt.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const historicoFiltrado = historicoItens.filter((i) => {
    if (filtroSituacaoComanda === 'PAGAS') return (Number(i.saldoComanda) || 0) <= 0;
    if (filtroSituacaoComanda === 'EM_ABERTO') return (Number(i.saldoComanda) || 0) > 0;
    return true;
  });

  const historicoOrdenado = [...historicoFiltrado].sort((a, b) => {
    const factor = sortOrderHistorico === 'asc' ? 1 : -1;
    const valA: any =
      sortFieldHistorico === 'cliente'
        ? (a.cliente || '').toLowerCase()
        : sortFieldHistorico === 'dataVenda'
          ? new Date(a.dataVenda).getTime()
          : Number((a as any)[sortFieldHistorico]) || 0;
    const valB: any =
      sortFieldHistorico === 'cliente'
        ? (b.cliente || '').toLowerCase()
        : sortFieldHistorico === 'dataVenda'
          ? new Date(b.dataVenda).getTime()
          : Number((b as any)[sortFieldHistorico]) || 0;
    if (valA < valB) return -1 * factor;
    if (valA > valB) return 1 * factor;
    return 0;
  });

  const totaisHistorico = historicoOrdenado.reduce(
    (acc, i) => {
      acc.totalVendido += Number(i.valorItem) || 0;
      acc.totalPago += Number(i.valorPagoItem) || 0;
      acc.totalAberto += Number(i.saldoItem) || 0;
      acc.quantidade += Number(i.quantidade) || 0;
      return acc;
    },
    { totalVendido: 0, totalPago: 0, totalAberto: 0, quantidade: 0 }
  );

  const imprimirHistorico = () => {
    if (!produtoHistorico) return;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;

    const titulo = `Histórico de Vendas - ${produtoHistorico.nome}`;
    const periodo = `${dataInicioHistorico} até ${dataFimHistorico}`;
    const situacao =
      filtroSituacaoComanda === 'PAGAS'
        ? 'Pagas'
        : filtroSituacaoComanda === 'EM_ABERTO'
          ? 'Em aberto'
          : 'Todas';

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const rowsHtml = historicoOrdenado
      .map((i) => {
        return `<tr>
          <td>#${escapeHtml(String(i.numeroCard))}</td>
          <td>${escapeHtml(String(i.cliente || ''))}</td>
          <td>${escapeHtml(formatarDataHora(i.dataVenda))}</td>
          <td style="text-align:right;">${escapeHtml(String(i.quantidade))}</td>
          <td style="text-align:right;">${escapeHtml(formatarMoeda(i.valorItem))}</td>
          <td style="text-align:right;">${escapeHtml(formatarMoeda(i.valorTotalComanda))}</td>
          <td style="text-align:right;">${escapeHtml(formatarMoeda(i.valorPagoComanda))}</td>
          <td style="text-align:right;">${escapeHtml(formatarMoeda(i.saldoComanda))}</td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(titulo)}</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
            h1{font-size:18px;margin:0 0 6px}
            .meta{font-size:12px;color:#555;margin:0 0 14px}
            .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
            .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px}
            .kpi .label{font-size:11px;color:#6b7280}
            .kpi .value{font-size:13px;font-weight:700;margin-top:4px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #e5e7eb;padding:8px;font-size:12px}
            th{background:#f9fafb;text-align:left}
            @media print { body{padding:0} }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(titulo)}</h1>
          <p class="meta">Período: ${escapeHtml(periodo)} | Situação: ${escapeHtml(situacao)} | Total registros: ${historicoOrdenado.length}</p>
          <div class="kpis">
            <div class="kpi"><div class="label">Total vendido</div><div class="value">${escapeHtml(formatarMoeda(totaisHistorico.totalVendido))}</div></div>
            <div class="kpi"><div class="label">Total pago (rateado)</div><div class="value">${escapeHtml(formatarMoeda(totaisHistorico.totalPago))}</div></div>
            <div class="kpi"><div class="label">Em aberto (rateado)</div><div class="value">${escapeHtml(formatarMoeda(totaisHistorico.totalAberto))}</div></div>
            <div class="kpi"><div class="label">Qtd vendida</div><div class="value">${escapeHtml(String(totaisHistorico.quantidade))}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Comanda</th>
                <th>Cliente</th>
                <th>Data da venda</th>
                <th style="text-align:right;">Qtd</th>
                <th style="text-align:right;">Valor item</th>
                <th style="text-align:right;">Total comanda</th>
                <th style="text-align:right;">Pago</th>
                <th style="text-align:right;">Saldo</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>
            window.addEventListener('load', function () {
              setTimeout(function () {
                try { window.focus(); } catch (e) {}
                try { window.print(); } catch (e) {}
              }, 200);
            });
          </script>
        </body>
      </html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => {
      setTimeout(() => {
        try {
          w.focus();
        } catch {}
        try {
          w.print();
        } catch {}
      }, 200);
    };
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
        <div className="flex gap-2">
          <Link
            href="/app/arena/produtos/tabela-precos"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Tabela de Preços
          </Link>
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        </div>
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
                  onClick={() => abrirHistorico(produto)}
                  className="p-2 text-gray-700 hover:bg-gray-50 rounded"
                  title="Histórico de vendas"
                >
                  <Clock className="w-4 h-4" />
                </button>
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

            <div className="space-y-3">
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

              {produto.dataUltimaAlteracaoPreco && (
                <div className="text-xs text-gray-400 mt-1 pt-1 border-t border-gray-50">
                  Preço alterado em: {new Date(produto.dataUltimaAlteracaoPreco).toLocaleDateString('pt-BR')}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Acesso rápido
                </span>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={produto.acessoRapido ?? false}
                    onChange={async (e) => {
                      const novoValor = e.target.checked;
                      if (novoValor) {
                        // Limitar a no máximo 5 produtos com acesso rápido
                        const totalAtual = produtosAcessoRapido.length;
                        if (totalAtual >= 5) {
                          alert('Você pode marcar no máximo 5 produtos como acesso rápido.');
                          return;
                        }
                      }
                      try {
                        await produtoService.atualizar(produto.id, { acessoRapido: novoValor });
                        await carregarProdutos();
                      } catch (error: any) {
                        alert(error?.response?.data?.mensagem || 'Erro ao atualizar acesso rápido do produto');
                      }
                    }}
                    className="rounded"
                  />
                  <span>{(produto.acessoRapido ?? false) ? 'Ativado' : 'Desativado'}</span>
                </label>
              </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                  <span className="text-xs text-gray-600">Autoatendimento</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      (produto.autoAtendimento ?? true) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {(produto.autoAtendimento ?? true) ? 'Liberado' : 'Bloqueado'}
                  </span>
                </div>
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
                  <InputMonetario
                    value={form.precoVenda}
                    onChange={(valor) => setForm({ ...form, precoVenda: valor || 0 })}
                    placeholder="0,00"
                    min={0.01}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo</label>
                  <InputMonetario
                    value={form.precoCusto ?? null}
                    onChange={(valor) =>
                      setForm({
                        ...form,
                        precoCusto: valor === null ? undefined : valor,
                      })
                    }
                    placeholder="0,00"
                    min={0}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                <input
                  type="text"
                  value={form.barcode || ''}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="EAN / Código de barras do produto"
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoAtendimento ?? true}
                  onChange={(e) => setForm({ ...form, autoAtendimento: e.target.checked })}
                  className="rounded"
                  id="autoAtendimento"
                />
                <label htmlFor="autoAtendimento" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Liberar no autoatendimento (quiosque)
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

      {modalHistoricoAberto && produtoHistorico && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-auto max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 flex-none">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Histórico de Vendas</h2>
                <p className="text-sm text-gray-600 mt-1">{produtoHistorico.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalHistoricoAberto(false);
                  setProdutoHistorico(null);
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 flex-none">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="w-full sm:w-52">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dataInicioHistorico}
                    onChange={(e) => setDataInicioHistorico(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="w-full sm:w-52">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dataFimHistorico}
                    onChange={(e) => setDataFimHistorico(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={aplicarFiltroHistorico}
                disabled={historicoLoading || !dataInicioHistorico || !dataFimHistorico || dataInicioHistorico > dataFimHistorico}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Filtrar
              </button>
              <div className="w-full sm:w-44">
                <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
                <select
                  value={filtroSituacaoComanda}
                  onChange={(e) => setFiltroSituacaoComanda(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                >
                  <option value="TODAS">Todas</option>
                  <option value="PAGAS">Pagas</option>
                  <option value="EM_ABERTO">Em aberto</option>
                </select>
              </div>
              <button
                type="button"
                onClick={imprimirHistorico}
                disabled={historicoLoading || historicoOrdenado.length === 0}
                className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-2"
                title="Imprimir"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
            </div>

            {historicoErro && (
              <div className="px-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-none">
                {historicoErro}
              </div>
            )}

            {!historicoLoading && !historicoErro && (
              <div className="px-6 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 flex-none">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total vendido</div>
                  <div className="text-sm font-semibold text-gray-900">{formatarMoeda(totaisHistorico.totalVendido)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total pago (rateado)</div>
                  <div className="text-sm font-semibold text-gray-900">{formatarMoeda(totaisHistorico.totalPago)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Em aberto (rateado)</div>
                  <div className="text-sm font-semibold text-gray-900">{formatarMoeda(totaisHistorico.totalAberto)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Qtd vendida</div>
                  <div className="text-sm font-semibold text-gray-900">{totaisHistorico.quantidade}</div>
                </div>
              </div>
            )}

            <div className="p-6 pt-4 flex-1 overflow-auto">
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('numeroCard')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Comanda {getSortIconHistorico('numeroCard')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('cliente')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Cliente {getSortIconHistorico('cliente')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('dataVenda')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Data da venda {getSortIconHistorico('dataVenda')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('quantidade')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Qtd {getSortIconHistorico('quantidade')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('valorItem')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Valor item {getSortIconHistorico('valorItem')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('valorTotalComanda')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Total comanda {getSortIconHistorico('valorTotalComanda')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('valorPagoComanda')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Pago {getSortIconHistorico('valorPagoComanda')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSortHistorico('saldoComanda')} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Saldo {getSortIconHistorico('saldoComanda')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historicoLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : historicoOrdenado.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                        Nenhuma venda encontrada no período
                      </td>
                    </tr>
                  ) : (
                    historicoOrdenado.map((i) => (
                      <tr key={i.itemId}>
                        <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                          <button
                            type="button"
                            onClick={() => abrirComanda(i.cardId)}
                            disabled={abrindoCard}
                            className="text-emerald-700 hover:underline disabled:opacity-60"
                            title="Abrir comanda"
                          >
                            #{i.numeroCard}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{i.cliente}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatarDataHora(i.dataVenda)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{i.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatarMoeda(i.valorItem)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatarMoeda(i.valorTotalComanda)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatarMoeda(i.valorPagoComanda)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-right">{formatarMoeda(i.saldoComanda)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        </div>
      )}

      {modalCardAberto && cardParaAbrir && (
        <GerenciarCardModal
          isOpen={modalCardAberto}
          card={cardParaAbrir}
          readOnly
          onClose={() => {
            setModalCardAberto(false);
            setCardParaAbrir(null);
          }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

