// app/app/arena/bloqueios/page.tsx - Bloqueios de agenda da arena
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { bloqueioAgendaService, quadraService } from '@/services/agendamentoService';
import type { BloqueioAgenda, CriarBloqueioAgendaPayload, Quadra } from '@/types/agendamento';
import { Plus, Edit, Trash2, Calendar, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

// Converter minutos desde 00:00 para formato "HH:mm"
function minutosParaHora(minutos: number | null): string {
  if (minutos === null) return '';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Converter formato "HH:mm" para minutos desde 00:00
function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export default function ArenaBloqueiosPage() {
  const { usuario } = useAuth();
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [bloqueioEditando, setBloqueioEditando] = useState<BloqueioAgenda | null>(null);
  const [form, setForm] = useState<CriarBloqueioAgendaPayload>({
    pointId: usuario?.pointIdGestor || '',
    quadraIds: null,
    titulo: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    horaInicio: null,
    horaFim: null,
  });
  const [tipoBloqueio, setTipoBloqueio] = useState<'geral' | 'especifico'>('geral');
  const [quadrasSelecionadas, setQuadrasSelecionadas] = useState<string[]>([]);
  const [bloqueioDiaInteiro, setBloqueioDiaInteiro] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [bloqueiosData, quadrasData] = await Promise.all([
        bloqueioAgendaService.listar({ apenasAtivos: false }),
        quadraService.listar(),
      ]);
      setBloqueios(bloqueiosData);
      setQuadras(quadrasData.filter(q => q.ativo));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (bloqueio?: BloqueioAgenda) => {
    if (bloqueio) {
      setBloqueioEditando(bloqueio);
      const dataInicio = new Date(bloqueio.dataInicio).toISOString().split('T')[0];
      const dataFim = new Date(bloqueio.dataFim).toISOString().split('T')[0];
      const temHorario = bloqueio.horaInicio !== null && bloqueio.horaFim !== null;
      
      setForm({
        pointId: bloqueio.pointId || '',
        quadraIds: bloqueio.quadraIds,
        titulo: bloqueio.titulo,
        descricao: bloqueio.descricao || '',
        dataInicio,
        dataFim,
        horaInicio: temHorario ? minutosParaHora(bloqueio.horaInicio!) : null,
        horaFim: temHorario ? minutosParaHora(bloqueio.horaFim!) : null,
      });
      setTipoBloqueio(bloqueio.quadraIds === null ? 'geral' : 'especifico');
      setQuadrasSelecionadas(bloqueio.quadraIds || []);
      setBloqueioDiaInteiro(!temHorario);
    } else {
      setBloqueioEditando(null);
      setForm({
        pointId: usuario?.pointIdGestor || '',
        quadraIds: null,
        titulo: '',
        descricao: '',
        dataInicio: '',
        dataFim: '',
        horaInicio: null,
        horaFim: null,
      });
      setTipoBloqueio('geral');
      setQuadrasSelecionadas([]);
      setBloqueioDiaInteiro(true);
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setBloqueioEditando(null);
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // Validações
    if (!form.titulo.trim()) {
      setErro('Título é obrigatório');
      return;
    }

    if (!form.dataInicio || !form.dataFim) {
      setErro('Data de início e fim são obrigatórias');
      return;
    }

    if (new Date(form.dataInicio) > new Date(form.dataFim)) {
      setErro('Data de início deve ser anterior ou igual à data de fim');
      return;
    }

    if (!bloqueioDiaInteiro) {
      if (!form.horaInicio || !form.horaFim) {
        setErro('Horário de início e fim são obrigatórios quando não é dia inteiro');
        return;
      }

      if (form.horaInicio >= form.horaFim) {
        setErro('Horário de início deve ser anterior ao horário de fim');
        return;
      }
    }

    if (tipoBloqueio === 'especifico' && quadrasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma quadra');
      return;
    }

    setSalvando(true);

    try {
      const payload: CriarBloqueioAgendaPayload = {
        pointId: form.pointId,
        quadraIds: tipoBloqueio === 'geral' ? null : quadrasSelecionadas,
        titulo: form.titulo,
        descricao: form.descricao || null,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        horaInicio: bloqueioDiaInteiro ? null : form.horaInicio!,
        horaFim: bloqueioDiaInteiro ? null : form.horaFim!,
      };

      if (bloqueioEditando) {
        await bloqueioAgendaService.atualizar(bloqueioEditando.id, payload);
      } else {
        await bloqueioAgendaService.criar(payload);
      }
      fecharModal();
      carregarDados();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao salvar bloqueio');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este bloqueio?')) return;

    try {
      await bloqueioAgendaService.deletar(id);
      carregarDados();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar bloqueio');
    }
  };

  const handleToggleAtivo = async (bloqueio: BloqueioAgenda) => {
    try {
      await bloqueioAgendaService.atualizar(bloqueio.id, { ativo: !bloqueio.ativo });
      carregarDados();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao atualizar bloqueio');
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarPeriodo = (bloqueio: BloqueioAgenda) => {
    const dataInicio = formatarData(bloqueio.dataInicio);
    const dataFim = formatarData(bloqueio.dataFim);
    
    if (dataInicio === dataFim) {
      if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
        return `${dataInicio} das ${minutosParaHora(bloqueio.horaInicio)} às ${minutosParaHora(bloqueio.horaFim)}`;
      }
      return dataInicio;
    }
    
    if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
      return `${dataInicio} a ${dataFim} das ${minutosParaHora(bloqueio.horaInicio)} às ${minutosParaHora(bloqueio.horaFim)}`;
    }
    
    return `${dataInicio} a ${dataFim}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bloqueios de Agenda</h1>
          <p className="text-gray-600">Gerencie bloqueios para eventos e manutenções</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Novo Bloqueio
        </button>
      </div>

      {/* Lista de Bloqueios */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {bloqueios.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Nenhum bloqueio cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Título</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Período</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Quadras</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bloqueios.map((bloqueio) => (
                  <tr key={bloqueio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{bloqueio.titulo}</div>
                      {bloqueio.descricao && (
                        <div className="text-sm text-gray-500 mt-1">{bloqueio.descricao}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatarPeriodo(bloqueio)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {bloqueio.quadraIds === null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Todas as quadras
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {bloqueio.quadraIds.map((quadraId) => {
                            const quadra = quadras.find(q => q.id === quadraId);
                            return (
                              <span
                                key={quadraId}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {quadra?.nome || quadraId}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAtivo(bloqueio)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bloqueio.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {bloqueio.ativo ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirModal(bloqueio)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletar(bloqueio.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deletar"
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
      </div>

      {/* Modal de Criar/Editar */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {bloqueioEditando ? 'Editar Bloqueio' : 'Novo Bloqueio'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{erro}</p>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Ex: Evento de Fim de Ano"
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={form.descricao || ''}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  placeholder="Descrição opcional do bloqueio"
                />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Fim *
                  </label>
                  <input
                    type="date"
                    value={form.dataFim}
                    onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              {/* Tipo de Bloqueio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Bloqueio *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoBloqueio"
                      value="geral"
                      checked={tipoBloqueio === 'geral'}
                      onChange={(e) => {
                        setTipoBloqueio('geral');
                        setForm({ ...form, quadraIds: null });
                        setQuadrasSelecionadas([]);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Todas as quadras</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoBloqueio"
                      value="especifico"
                      checked={tipoBloqueio === 'especifico'}
                      onChange={(e) => setTipoBloqueio('especifico')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Quadras específicas</span>
                  </label>
                </div>
              </div>

              {/* Seleção de Quadras */}
              {tipoBloqueio === 'especifico' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quadras *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {quadras.map((quadra) => (
                      <label key={quadra.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={quadrasSelecionadas.includes(quadra.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setQuadrasSelecionadas([...quadrasSelecionadas, quadra.id]);
                            } else {
                              setQuadrasSelecionadas(quadrasSelecionadas.filter(id => id !== quadra.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">{quadra.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Dia Inteiro ou Horário */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bloqueioDiaInteiro}
                    onChange={(e) => {
                      setBloqueioDiaInteiro(e.target.checked);
                      if (e.target.checked) {
                        setForm({ ...form, horaInicio: null, horaFim: null });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Bloquear dia inteiro</span>
                </label>
              </div>

              {/* Horários */}
              {!bloqueioDiaInteiro && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário de Início *
                    </label>
                    <input
                      type="time"
                      value={form.horaInicio || ''}
                      onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required={!bloqueioDiaInteiro}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário de Fim *
                    </label>
                    <input
                      type="time"
                      value={form.horaFim || ''}
                      onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required={!bloqueioDiaInteiro}
                    />
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : bloqueioEditando ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

