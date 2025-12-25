// app/app/admin/tabela-precos/page.tsx - Tabela de preços (igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pointService, quadraService, tabelaPrecoService } from '@/services/agendamentoService';
import type { Point, Quadra, TabelaPreco } from '@/types/agendamento';
import { AlertCircle, Clock, MapPin, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function AdminTabelaPrecoPage() {
  const router = useRouter();

  const [points, setPoints] = useState<Point[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [faixas, setFaixas] = useState<TabelaPreco[]>([]);

  const [pointSelecionado, setPointSelecionado] = useState('');
  const [quadraSelecionada, setQuadraSelecionada] = useState('');

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [valorHora, setValorHora] = useState('');
  const [valorHoraAula, setValorHoraAula] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    carregarPoints();
  }, []);

  useEffect(() => {
    if (pointSelecionado) {
      carregarQuadras(pointSelecionado);
    } else {
      setQuadras([]);
      setQuadraSelecionada('');
      setFaixas([]);
    }
  }, [pointSelecionado]);

  useEffect(() => {
    if (quadraSelecionada) {
      carregarFaixas(quadraSelecionada);
    } else {
      setFaixas([]);
    }
  }, [quadraSelecionada]);

  const carregarPoints = async () => {
    try {
      setLoading(true);
      const data = await pointService.listar();
      setPoints(data.filter((p) => p.ativo));
    } catch (error) {
      console.error('Erro ao carregar estabelecimentos:', error);
      setErro('Erro ao carregar estabelecimentos');
    } finally {
      setLoading(false);
    }
  };

  const carregarQuadras = async (pointId: string) => {
    try {
      setLoading(true);
      const data = await quadraService.listar(pointId);
      setQuadras(data.filter((q) => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar quadras:', error);
      setErro('Erro ao carregar quadras');
    } finally {
      setLoading(false);
    }
  };

  const carregarFaixas = async (quadraId: string) => {
    try {
      setLoading(true);
      const data = await tabelaPrecoService.listar(quadraId);
      setFaixas(data);
    } catch (error) {
      console.error('Erro ao carregar tabela de preços:', error);
      setErro('Erro ao carregar tabela de preços');
    } finally {
      setLoading(false);
    }
  };

  const resetFormulario = () => {
    setEditandoId(null);
    setHoraInicio('');
    setHoraFim('');
    setValorHora('');
    setValorHoraAula('');
    setAtivo(true);
    setErro('');
  };

  const validarFaixa = (): string | null => {
    if (!quadraSelecionada) return 'Selecione uma quadra';
    if (!horaInicio || !horaFim) return 'Informe horário de início e fim';

    const [hIni, mIni] = horaInicio.split(':').map(Number);
    const [hFim, mFim] = horaFim.split(':').map(Number);
    const minIni = hIni * 60 + mIni;
    const minFim = hFim * 60 + mFim;

    if (isNaN(minIni) || isNaN(minFim)) return 'Horário inválido';
    if (minFim <= minIni) return 'Horário final deve ser maior que o inicial';

    const valor = parseFloat(valorHora.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) return 'Informe um valor/hora válido maior que zero';

    return null;
  };

  const handleEditar = (faixa: TabelaPreco) => {
    setEditandoId(faixa.id);
    setHoraInicio(minutosParaHora(faixa.inicioMinutoDia));
    setHoraFim(minutosParaHora(faixa.fimMinutoDia));
    setValorHora(faixa.valorHora.toString().replace('.', ','));
    setValorHoraAula(faixa.valorHoraAula ? faixa.valorHoraAula.toString().replace('.', ',') : '');
    setAtivo(faixa.ativo);
    setErro('');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const erroValidacao = validarFaixa();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    if (!quadraSelecionada) return;

    const valor = parseFloat(valorHora.replace(',', '.'));
    const valorAula = valorHoraAula.trim() ? parseFloat(valorHoraAula.replace(',', '.')) : null;

    setSalvando(true);
    try {
      if (editandoId) {
        await tabelaPrecoService.atualizar(editandoId, {
          horaInicio,
          horaFim,
          valorHora: valor,
          valorHoraAula: valorAula,
          ativo,
        });
      } else {
        await tabelaPrecoService.criar({
          quadraId: quadraSelecionada,
          horaInicio,
          horaFim,
          valorHora: valor,
          valorHoraAula: valorAula,
          ativo,
        });
      }

      await carregarFaixas(quadraSelecionada);
      resetFormulario();
    } catch (error: any) {
      console.error('Erro ao salvar faixa de preço:', error);
      setErro(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao salvar faixa de preço. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (faixa: TabelaPreco) => {
    if (!window.confirm('Tem certeza que deseja excluir esta faixa de preço?')) return;

    try {
      await tabelaPrecoService.deletar(faixa.id);
      if (quadraSelecionada) {
        await carregarFaixas(quadraSelecionada);
      }
      if (editandoId === faixa.id) {
        resetFormulario();
      }
    } catch (error: any) {
      console.error('Erro ao excluir faixa de preço:', error);
      setErro(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao excluir faixa de preço. Tente novamente.'
      );
    }
  };

  const faixasOrdenadas = useMemo(
    () => [...faixas].sort((a, b) => a.inicioMinutoDia - b.inicioMinutoDia),
    [faixas]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Tabela de Preços por Quadra</h1>
          <p className="text-gray-600">
            Configure os valores por hora para cada faixa de horário das quadras
          </p>
        </div>
        <button
          onClick={() => router.push('/app/admin/quadras')}
          className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
        >
          <MapPin className="w-5 h-5" />
          Gerenciar Quadras
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
          <p className="hidden sm:flex items-center gap-1 text-[11px] text-gray-500">
            <Clock className="w-3 h-3" />
            Cada faixa define o <span className="font-semibold">valor/hora</span> aplicado nos
            agendamentos
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              Estabelecimento
            </label>
            <select
              value={pointSelecionado}
              onChange={(e) => {
                setPointSelecionado(e.target.value);
                setQuadraSelecionada('');
                resetFormulario();
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione um estabelecimento</option>
              {points.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quadra</label>
            <select
              value={quadraSelecionada}
              onChange={(e) => {
                setQuadraSelecionada(e.target.value);
                resetFormulario();
              }}
              disabled={!pointSelecionado}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Selecione uma quadra</option>
              {quadras.map((quadra) => (
                <option key={quadra.id} value={quadra.id}>
                  {quadra.nome} {quadra.tipo && `(${quadra.tipo})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Faixas de preço {quadraSelecionada && 'da quadra selecionada'}
          </h2>
          {quadraSelecionada && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              <Clock className="w-3 h-3" />
              Valores por hora
            </span>
          )}
        </div>

        {!quadraSelecionada ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
            Selecione um estabelecimento e uma quadra para configurar a tabela de preços.
          </div>
        ) : (
          <>
            {faixasOrdenadas.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                Nenhuma faixa de preço cadastrada para esta quadra.
                <p className="mt-2 text-xs text-gray-500">
                  Quando não houver faixa correspondente ao horário do agendamento, o valor poderá
                  ser informado manualmente pelo administrador.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        Início
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        Fim
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        Valor/hora (Atleta)
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        Valor/hora (Aula)
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        Ativo
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-700">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixasOrdenadas.map((faixa) => (
                      <tr key={faixa.id} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-3 py-2 text-sm text-gray-800">
                          {minutosParaHora(faixa.inicioMinutoDia)}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-sm text-gray-800">
                          {minutosParaHora(faixa.fimMinutoDia)}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-sm text-gray-800">
                          {formatCurrency(faixa.valorHora)}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-sm text-gray-800">
                          {formatCurrency(faixa.valorHoraAula || faixa.valorHora)}
                          {faixa.valorHoraAula && (
                            <span className="text-xs text-gray-500 ml-1">(personalizado)</span>
                          )}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-sm text-gray-800">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              faixa.ativo
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                faixa.ativo ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            {faixa.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                              onClick={() => handleEditar(faixa)}
                              title="Editar faixa"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                              onClick={() => handleExcluir(faixa)}
                              title="Excluir faixa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-900">
                  {editandoId ? 'Editar Faixa de Preço' : 'Nova Faixa de Preço'}
                </h3>
                {editandoId && (
                  <button
                    type="button"
                    onClick={resetFormulario}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <X className="w-3 h-3" />
                    Cancelar edição
                  </button>
                )}
              </div>

              <form onSubmit={handleSalvar} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Início (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fim (HH:mm)</label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor/hora - Atleta (R$)
                  </label>
                  <input
                    type="text"
                    value={valorHora}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d,.-]/g, '');
                      setValorHora(raw);
                    }}
                    placeholder="Ex: 80,00"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor/hora - Aula (R$) <span className="text-gray-500 text-xs">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={valorHoraAula}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d,.-]/g, '');
                      setValorHoraAula(raw);
                    }}
                    placeholder="Ex: 100,00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se vazio, usa o valor de atleta
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>Ativo</span>
                  </label>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {salvando ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editandoId ? 'Salvar alterações' : 'Adicionar faixa'}
                      </>
                    )}
                  </button>
                </div>
              </form>

              {erro && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm text-gray-700">Carregando...</span>
          </div>
        </div>
      )}
    </div>
  );
}
