'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { agendamentoService, quadraService } from '@/services/agendamentoService';
import { api } from '@/lib/api';
import type { Agendamento, Quadra } from '@/types/agendamento';
import { Calendar, Clock, RefreshCw, Search, Wrench } from 'lucide-react';

function formatDateToInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function toUtcStartIso(dateInput: string) {
  return new Date(`${dateInput}T00:00:00`).toISOString();
}

function toUtcEndIso(dateInput: string) {
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}

export default function ManutencaoAgendaPage() {
  const { usuario } = useAuth();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(formatDateToInput(hoje));
  const [dataFim, setDataFim] = useState(formatDateToInput(hoje));
  const [busca, setBusca] = useState('');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [novaQuadraId, setNovaQuadraId] = useState('');
  const [novoDataHora, setNovoDataHora] = useState('');
  const [aplicarARecorrencia, setAplicarARecorrencia] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      setErro('');
      setMensagem('');

      const [quadrasData, agendamentosData] = await Promise.all([
        quadraService.listar(usuario?.pointIdGestor || undefined),
        agendamentoService.listar({
          pointId: usuario?.pointIdGestor || undefined,
          dataInicio: toUtcStartIso(dataInicio),
          dataFim: toUtcEndIso(dataFim),
        }),
      ]);

      const ordenados = [...agendamentosData]
        .filter((a) => a.status !== 'CANCELADO')
        .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

      setQuadras(quadrasData);
      setAgendamentos(ordenados);
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuario?.role === 'ADMIN' || usuario?.role === 'ORGANIZER') {
      carregar();
    }
  }, [usuario?.id]);

  const agendamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return agendamentos;
    return agendamentos.filter((a) => {
      const cliente = a.atleta?.nome || a.usuario?.name || a.nomeAvulso || '';
      const quadra = a.quadra?.nome || '';
      return cliente.toLowerCase().includes(termo) || quadra.toLowerCase().includes(termo);
    });
  }, [agendamentos, busca]);

  const abrirManutencao = (agendamento: Agendamento) => {
    setAgendamentoSelecionado(agendamento);
    setNovaQuadraId(agendamento.quadraId);
    setNovoDataHora(formatDateTimeLocal(agendamento.dataHora));
    setAplicarARecorrencia(false);
    setMensagem('');
    setErro('');
  };

  const fecharManutencao = () => {
    setAgendamentoSelecionado(null);
    setNovaQuadraId('');
    setNovoDataHora('');
    setAplicarARecorrencia(false);
  };

  const executarManutencao = async () => {
    if (!agendamentoSelecionado) return;
    if (!novaQuadraId || !novoDataHora) {
      setErro('Selecione quadra e data/hora');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      setMensagem('');

      const { data } = await api.put(
        `/gestao-arena/agendamentos-manutencao/${agendamentoSelecionado.id}`,
        {
          quadraId: novaQuadraId,
          dataHora: novoDataHora,
          aplicarARecorrencia,
        }
      );

      setMensagem(data?.mensagem || 'Manutenção aplicada');
      fecharManutencao();
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao aplicar manutenção');
    } finally {
      setSalvando(false);
    }
  };

  if (usuario?.role !== 'ADMIN' && usuario?.role !== 'ORGANIZER') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <p className="text-gray-700">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Manutenção da Agenda</h1>
          <p className="text-gray-600">Troque quadra e horário de agendamentos, inclusive recorrentes</p>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Buscar cliente ou quadra</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome do cliente ou quadra"
                className="w-full border rounded-lg pl-9 pr-3 py-2"
              />
            </div>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Aplicar filtros
        </button>
      </div>

      {erro && <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">{erro}</div>}
      {mensagem && <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg">{mensagem}</div>}

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Cliente</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Quadra</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Data/Hora</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Duração</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Recorrente</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Ação</th>
            </tr>
          </thead>
          <tbody>
            {agendamentosFiltrados.map((agendamento) => (
              <tr key={agendamento.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{agendamento.atleta?.nome || agendamento.usuario?.name || agendamento.nomeAvulso || '—'}</td>
                <td className="py-3 px-4">{agendamento.quadra?.nome || '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{new Date(agendamento.dataHora).toLocaleDateString('pt-BR')}</span>
                    <Clock className="w-4 h-4 text-gray-500 ml-2" />
                    <span>{new Date(agendamento.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </td>
                <td className="py-3 px-4">{agendamento.duracao} min</td>
                <td className="py-3 px-4">{agendamento.status}</td>
                <td className="py-3 px-4">{agendamento.recorrenciaId ? 'Sim' : 'Não'}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => abrirManutencao(agendamento)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <Wrench className="w-4 h-4" />
                    Manutenção
                  </button>
                </td>
              </tr>
            ))}
            {agendamentosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Nenhum agendamento encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {agendamentoSelecionado && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Manutenção de Agendamento</h2>
            <div className="text-sm text-gray-600">
              {agendamentoSelecionado.atleta?.nome || agendamentoSelecionado.usuario?.name || agendamentoSelecionado.nomeAvulso || 'Cliente'}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nova quadra</label>
              <select
                value={novaQuadraId}
                onChange={(e) => setNovaQuadraId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Selecione</option>
                {quadras.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Novo horário</label>
              <input
                type="datetime-local"
                value={novoDataHora}
                onChange={(e) => setNovoDataHora(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {agendamentoSelecionado.recorrenciaId && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={aplicarARecorrencia}
                  onChange={(e) => setAplicarARecorrencia(e.target.checked)}
                />
                Aplicar para este e todos os futuros da recorrência
              </label>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
              Esta manutenção ignora conflitos de horário para permitir ajustes operacionais da agenda.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={fecharManutencao}
                disabled={salvando}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executarManutencao}
                disabled={salvando}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Aplicar manutenção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
