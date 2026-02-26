'use client';

// components/QuadrasDisponiveisPorHorarioModal.tsx - Mostrar apenas horários disponíveis em uma data

import { useEffect, useState } from 'react';
import { agendamentoService, bloqueioAgendaService, horarioAtendimentoService, quadraService } from '@/services/agendamentoService';
import type { Agendamento, BloqueioAgenda, Quadra } from '@/types/agendamento';
import { Calendar, CheckCircle, Clock, X } from 'lucide-react';

interface QuadrasDisponiveisPorHorarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataInicial?: string;
  duracaoInicial?: number;
  onSelecionarHorario: (data: string, hora: string, duracao: number) => void;
  pointIdsPermitidos?: string[];
  ignorarHorarioAtendimento?: boolean;
}

const INICIO_DIA_MINUTOS = 6 * 60; // 06:00
const FIM_DIA_MINUTOS = 23 * 60; // 23:00
const STEP_MINUTOS = 30;

export default function QuadrasDisponiveisPorHorarioModal({
  isOpen,
  onClose,
  dataInicial,
  duracaoInicial,
  onSelecionarHorario,
  pointIdsPermitidos,
  ignorarHorarioAtendimento,
}: QuadrasDisponiveisPorHorarioModalProps) {
  const [data, setData] = useState('');
  const [duracao, setDuracao] = useState(60);
  const [carregando, setCarregando] = useState(false);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const hoje = new Date();
      const dataDefault = hoje.toISOString().split('T')[0];
      setData(dataInicial || dataDefault);
      setDuracao(duracaoInicial ?? 60);
      setHorariosDisponiveis([]);
    }
  }, [isOpen, dataInicial, duracaoInicial]);

  const gerarSlots = () => {
    const slots: string[] = [];
    for (let m = INICIO_DIA_MINUTOS; m <= FIM_DIA_MINUTOS; m += STEP_MINUTOS) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
    return slots;
  };

  const verificarHorariosDisponiveis = async () => {
    if (!data) {
      alert('Selecione uma data para ver horários disponíveis.');
      return;
    }

    setCarregando(true);
    setHorariosDisponiveis([]);

    try {
      // Carrega todas as quadras ativas, filtrando pelas arenas permitidas
      const todasQuadras = await quadraService.listar();
      let quadrasAtivas = todasQuadras.filter((q) => q.ativo);
      if (pointIdsPermitidos && pointIdsPermitidos.length > 0) {
        quadrasAtivas = quadrasAtivas.filter((q) => pointIdsPermitidos.includes(q.pointId));
      }
      if (quadrasAtivas.length === 0) {
        setHorariosDisponiveis([]);
        return;
      }

      const map: Record<string, Record<number, { inicioMin: number; fimMin: number }[]>> = {};
      if (!ignorarHorarioAtendimento) {
        const pointIds = Array.from(new Set(quadrasAtivas.map((q) => q.pointId)));
        const horarios = await horarioAtendimentoService.listar({ pointIds });
        for (const h of horarios) {
          if (!map[h.pointId]) map[h.pointId] = {};
          if (!map[h.pointId][h.diaSemana]) map[h.pointId][h.diaSemana] = [];
          map[h.pointId][h.diaSemana].push({ inicioMin: h.inicioMin, fimMin: h.fimMin });
        }
        for (const pid of Object.keys(map)) {
          for (const dia of Object.keys(map[pid])) {
            map[pid][Number(dia)].sort((a, b) => a.inicioMin - b.inicioMin);
          }
        }
      }

      const inicioDiaUTC = new Date(`${data}T00:00:00.000Z`);
      const proximoDiaUTC = new Date(inicioDiaUTC);
      proximoDiaUTC.setUTCDate(proximoDiaUTC.getUTCDate() + 1);
      const dataProximoDia = proximoDiaUTC.toISOString().slice(0, 10);

      const dataInicioBusca = `${data}T00:00:00.000Z`;
      const dataFimBusca = `${dataProximoDia}T23:59:59.999Z`;

      const [agendamentosDia, bloqueiosDia] = await Promise.all([
        agendamentoService.listar({
          dataInicio: dataInicioBusca,
          dataFim: dataFimBusca,
          status: 'CONFIRMADO',
        }),
        bloqueioAgendaService.listar({
          dataInicio: dataInicioBusca,
          dataFim: dataFimBusca,
          apenasAtivos: true,
        }),
      ]);

      const slots = gerarSlots();
      const horariosLivres: string[] = [];

      for (const horaStr of slots) {
        const [hStr, mStr] = horaStr.split(':');
        const slotInicioMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

        const existeQuadraLivre = quadrasAtivas.some((quadra) =>
          quadraEstaLivreNoHorario(quadra, slotInicioMin, agendamentosDia, bloqueiosDia, duracao, map),
        );

        if (existeQuadraLivre) {
          horariosLivres.push(horaStr);
        }
      }

      setHorariosDisponiveis(horariosLivres);
    } catch (error) {
      console.error('Erro ao verificar horários disponíveis:', error);
      alert('Erro ao verificar horários disponíveis.');
    } finally {
      setCarregando(false);
    }
  };

  const quadraEstaLivreNoHorario = (
    quadra: Quadra,
    slotInicioMin: number,
    agendamentos: Agendamento[],
    bloqueios: BloqueioAgenda[],
    duracaoMin: number,
    horariosAtendimentoMap: Record<string, Record<number, { inicioMin: number; fimMin: number }[]>>,
  ): boolean => {
    const diaStr = data;
    const [anoStr, mesStr, diaStrNum] = diaStr.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const dia = parseInt(diaStrNum, 10);

    const slotInicio = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0) + slotInicioMin * 60_000);
    const slotFim = new Date(slotInicio.getTime() + duracaoMin * 60_000);
    const diaSemana = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0)).getUTCDay();

      const horariosPoint = horariosAtendimentoMap[quadra.pointId];
      if (horariosPoint) {
        const intervalos = horariosPoint[diaSemana] || [];
        if (intervalos.length === 0) return false;
        const fimMin = slotInicioMin + duracaoMin;
        const permitido = intervalos.some((i) => slotInicioMin >= i.inicioMin && fimMin <= i.fimMin);
        if (!permitido) return false;
      }

    const parseDateUTC = (value: string) => {
      const v = String(value || '');
      if (/[zZ]|[+-]\d\d:\d\d$/.test(v)) return new Date(v);
      return new Date(`${v}Z`);
    };

    const temAgendamento = agendamentos.some((ag) => {
      if (ag.quadraId !== quadra.id || !ag.dataHora) return false;
      const agInicio = parseDateUTC(ag.dataHora);
      const agFim = new Date(agInicio.getTime() + ag.duracao * 60_000);
      return agInicio < slotFim && agFim > slotInicio;
    });
    if (temAgendamento) return false;

    const temBloqueio = bloqueios.some((bloqueio) => {
      if (!bloqueio.ativo) return false;

      const afetaQuadra =
        bloqueio.quadraIds === null ? quadra.pointId === bloqueio.pointId : bloqueio.quadraIds.includes(quadra.id);
      if (!afetaQuadra) return false;

      const bloqInicio = parseDateUTC(bloqueio.dataInicio);
      const bloqFim = parseDateUTC(bloqueio.dataFim);
      const bloqInicioDia = new Date(Date.UTC(bloqInicio.getUTCFullYear(), bloqInicio.getUTCMonth(), bloqInicio.getUTCDate()));
      const bloqFimDia = new Date(Date.UTC(bloqFim.getUTCFullYear(), bloqFim.getUTCMonth(), bloqFim.getUTCDate()));

      const slotInicioDia = new Date(Date.UTC(slotInicio.getUTCFullYear(), slotInicio.getUTCMonth(), slotInicio.getUTCDate()));
      const slotFimDia = new Date(Date.UTC(slotFim.getUTCFullYear(), slotFim.getUTCMonth(), slotFim.getUTCDate()));

      const diaIter = new Date(slotInicioDia);
      while (diaIter <= slotFimDia) {
        if (diaIter >= bloqInicioDia && diaIter <= bloqFimDia) {
          const inicioMin = bloqueio.horaInicio != null ? bloqueio.horaInicio : 0;
          const fimMin = bloqueio.horaFim != null ? bloqueio.horaFim : 1440;
          const bloqueioInicio = new Date(diaIter.getTime() + inicioMin * 60_000);
          const bloqueioFim = new Date(diaIter.getTime() + fimMin * 60_000);
          if (bloqueioInicio < slotFim && bloqueioFim > slotInicio) return true;
        }
        diaIter.setUTCDate(diaIter.getUTCDate() + 1);
      }

      return false;
    });

    return !temBloqueio;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Horários Disponíveis</h2>
            <p className="text-xs text-gray-600 mt-1">
              Escolha um horário livre na data selecionada. A quadra será escolhida na próxima etapa.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos)</label>
            <select
              value={duracao}
              onChange={(e) => setDuracao(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1h30</option>
              <option value={120}>2 horas</option>
              <option value={180}>3 horas</option>
            </select>
          </div>
          <button
            onClick={verificarHorariosDisponiveis}
            disabled={carregando || !data}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {carregando ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Verificando...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Ver horários disponíveis
              </>
            )}
          </button>
        </div>

        <div className="p-6">
          {carregando ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-3 text-gray-600 text-sm">Calculando horários disponíveis...</p>
            </div>
          ) : horariosDisponiveis.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 text-sm">
                Nenhum horário disponível encontrado para esta data com a duração selecionada.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Horários livres ({horariosDisponiveis.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {horariosDisponiveis.map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => onSelecionarHorario(data, hora, duracao)}
                    className="px-3 py-2 text-sm rounded-lg border border-green-200 bg-green-50 text-green-800 hover:bg-green-100 font-medium"
                  >
                    {hora}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
