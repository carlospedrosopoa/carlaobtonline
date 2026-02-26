'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { horarioAtendimentoService } from '@/services/agendamentoService';
import type { HorarioAtendimentoPoint } from '@/types/agendamento';
import { Plus, Trash2, Save, AlertCircle, CheckCircle } from 'lucide-react';

const diasSemana = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

function minutosParaHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export default function ConfiguracaoArenaPage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [itens, setItens] = useState<HorarioAtendimentoPoint[]>([]);
  const [edit, setEdit] = useState<Record<string, { inicio: string; fim: string; ativo: boolean }>>({});
  const [novo, setNovo] = useState<Record<number, { inicio: string; fim: string }>>(() => {
    const init: Record<number, { inicio: string; fim: string }> = {};
    for (const d of diasSemana) init[d.value] = { inicio: '07:00', fim: '12:00' };
    return init;
  });

  const pointId = usuario?.pointIdGestor || null;

  const itensPorDia = useMemo(() => {
    const map: Record<number, HorarioAtendimentoPoint[]> = {};
    for (const d of diasSemana) map[d.value] = [];
    for (const i of itens) {
      if (!map[i.diaSemana]) map[i.diaSemana] = [];
      map[i.diaSemana].push(i);
    }
    for (const d of diasSemana) {
      map[d.value].sort((a, b) => a.inicioMin - b.inicioMin);
    }
    return map;
  }, [itens]);

  useEffect(() => {
    const carregar = async () => {
      if (!pointId) return;
      try {
        setLoading(true);
        setErro('');
        setSucesso('');
        const data = await horarioAtendimentoService.listar({ pointId });
        setItens(data);
        const e: Record<string, { inicio: string; fim: string; ativo: boolean }> = {};
        for (const item of data) {
          e[item.id] = {
            inicio: minutosParaHora(item.inicioMin),
            fim: minutosParaHora(item.fimMin),
            ativo: item.ativo,
          };
        }
        setEdit(e);
      } catch (err: any) {
        setErro(err?.response?.data?.mensagem || 'Erro ao carregar horários de atendimento');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [pointId]);

  const adicionar = async (diaSemana: number) => {
    if (!pointId) return;
    try {
      setLoading(true);
      setErro('');
      setSucesso('');
      const inicioMin = horaParaMinutos(novo[diaSemana].inicio);
      const fimMin = horaParaMinutos(novo[diaSemana].fim);
      const criado = await horarioAtendimentoService.criar({
        pointId,
        diaSemana,
        inicioMin,
        fimMin,
        ativo: true,
      });
      setItens((prev) => [...prev, criado]);
      setEdit((prev) => ({
        ...prev,
        [criado.id]: { inicio: minutosParaHora(criado.inicioMin), fim: minutosParaHora(criado.fimMin), ativo: criado.ativo },
      }));
      setSucesso('Intervalo adicionado');
    } catch (err: any) {
      setErro(err?.response?.data?.mensagem || 'Erro ao adicionar intervalo');
    } finally {
      setLoading(false);
    }
  };

  const salvar = async (id: string) => {
    try {
      setLoading(true);
      setErro('');
      setSucesso('');
      const dados = edit[id];
      const atualizado = await horarioAtendimentoService.atualizar(id, {
        inicioMin: horaParaMinutos(dados.inicio),
        fimMin: horaParaMinutos(dados.fim),
        ativo: dados.ativo,
      });
      setItens((prev) => prev.map((i) => (i.id === id ? atualizado : i)));
      setSucesso('Alterações salvas');
    } catch (err: any) {
      setErro(err?.response?.data?.mensagem || 'Erro ao salvar alterações');
    } finally {
      setLoading(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este intervalo?')) return;
    try {
      setLoading(true);
      setErro('');
      setSucesso('');
      await horarioAtendimentoService.deletar(id);
      setItens((prev) => prev.filter((i) => i.id !== id));
      setEdit((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSucesso('Intervalo removido');
    } catch (err: any) {
      setErro(err?.response?.data?.mensagem || 'Erro ao remover intervalo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuração</h1>
        <p className="text-gray-600 mt-1">Defina em quais horários é permitido iniciar agendamentos por dia da semana.</p>
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

      {!pointId && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
          Usuário não vinculado a uma arena.
        </div>
      )}

      {pointId && (
        <div className="space-y-4">
          {diasSemana.map((dia) => (
            <div key={dia.value} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="text-lg font-semibold text-gray-900">{dia.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={novo[dia.value].inicio}
                    onChange={(e) => setNovo((prev) => ({ ...prev, [dia.value]: { ...prev[dia.value], inicio: e.target.value } }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={loading}
                  />
                  <span className="text-gray-500">até</span>
                  <input
                    type="time"
                    value={novo[dia.value].fim}
                    onChange={(e) => setNovo((prev) => ({ ...prev, [dia.value]: { ...prev[dia.value], fim: e.target.value } }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => adicionar(dia.value)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>

              {itensPorDia[dia.value].length === 0 ? (
                <div className="text-sm text-gray-500">Sem intervalos configurados para este dia.</div>
              ) : (
                <div className="space-y-2">
                  {itensPorDia[dia.value].map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={edit[item.id]?.inicio || minutosParaHora(item.inicioMin)}
                          onChange={(e) => setEdit((prev) => ({ ...prev, [item.id]: { ...prev[item.id], inicio: e.target.value } }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          disabled={loading}
                        />
                        <span className="text-gray-500">até</span>
                        <input
                          type="time"
                          value={edit[item.id]?.fim || minutosParaHora(item.fimMin)}
                          onChange={(e) => setEdit((prev) => ({ ...prev, [item.id]: { ...prev[item.id], fim: e.target.value } }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          disabled={loading}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-700 ml-2">
                          <input
                            type="checkbox"
                            checked={edit[item.id]?.ativo ?? item.ativo}
                            onChange={(e) => setEdit((prev) => ({ ...prev, [item.id]: { ...prev[item.id], ativo: e.target.checked } }))}
                            disabled={loading}
                          />
                          Ativo
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => salvar(item.id)}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => remover(item.id)}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

