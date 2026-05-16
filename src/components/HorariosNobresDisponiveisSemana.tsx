'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, MapPin, Plus } from 'lucide-react';
import {
  agendamentoService,
  bloqueioAgendaService,
  horarioAtendimentoService,
  quadraService,
} from '@/services/agendamentoService';
import type {
  Agendamento,
  BloqueioAgenda,
  HorarioAtendimentoPoint,
  Quadra,
} from '@/types/agendamento';

const HORARIO_NOBRE_INICIO_MIN = 18 * 60;
const HORARIO_NOBRE_FIM_MIN = 20 * 60 + 30;
const DIAS_NA_SEMANA = 7;

type SlotNobreDisponivel = {
  horaInicio: string;
  horaFim: string;
  quadrasLivres: Quadra[];
};

type DiaHorarioNobre = {
  data: string;
  dataObj: Date;
  slots: SlotNobreDisponivel[];
};

interface HorariosNobresDisponiveisSemanaProps {
  pointId?: string;
  inicioSemana: Date;
  duracaoMinutos?: number;
  onAbrirAgendamento?: (data: string, hora: string) => void;
}

function formatarDataLocal(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarHora(minutos: number): string {
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

function parseDateUTC(value: string) {
  const normalizado = String(value || '');
  if (/[zZ]|[+-]\d\d:\d\d$/.test(normalizado)) {
    return new Date(normalizado);
  }
  return new Date(`${normalizado}Z`);
}

function normalizarInicioDia(date: Date): Date {
  const novaData = new Date(date);
  novaData.setHours(0, 0, 0, 0);
  return novaData;
}

function gerarDiasDaSemana(inicioSemana: Date): Date[] {
  const inicio = normalizarInicioDia(inicioSemana);
  return Array.from({ length: DIAS_NA_SEMANA }, (_, index) => {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + index);
    return data;
  });
}

function gerarSlotsNobres(duracaoMinutos: number) {
  const slots: Array<{ inicioMin: number; fimMin: number }> = [];
  for (
    let inicioMin = HORARIO_NOBRE_INICIO_MIN;
    inicioMin + duracaoMinutos <= HORARIO_NOBRE_FIM_MIN;
    inicioMin += 30
  ) {
    slots.push({
      inicioMin,
      fimMin: inicioMin + duracaoMinutos,
    });
  }
  return slots;
}

function montarMapaHorariosAtendimento(
  horarios: HorarioAtendimentoPoint[]
): Record<string, Record<number, Array<{ inicioMin: number; fimMin: number }>>> {
  const mapa: Record<string, Record<number, Array<{ inicioMin: number; fimMin: number }>>> = {};

  for (const horario of horarios) {
    if (!mapa[horario.pointId]) {
      mapa[horario.pointId] = {};
    }
    if (!mapa[horario.pointId][horario.diaSemana]) {
      mapa[horario.pointId][horario.diaSemana] = [];
    }
    mapa[horario.pointId][horario.diaSemana].push({
      inicioMin: horario.inicioMin,
      fimMin: horario.fimMin,
    });
  }

  for (const pointId of Object.keys(mapa)) {
    for (const diaSemana of Object.keys(mapa[pointId])) {
      mapa[pointId][Number(diaSemana)].sort((a, b) => a.inicioMin - b.inicioMin);
    }
  }

  return mapa;
}

function quadraAceitaSlotNoHorarioAtendimento(
  quadra: Quadra,
  diaSemana: number,
  slotInicioMin: number,
  slotFimMin: number,
  mapaHorariosAtendimento: Record<string, Record<number, Array<{ inicioMin: number; fimMin: number }>>>
): boolean {
  const horariosPoint = mapaHorariosAtendimento[quadra.pointId];
  if (!horariosPoint) {
    return true;
  }

  const intervalos = horariosPoint[diaSemana] || [];
  if (intervalos.length === 0) {
    return false;
  }

  return intervalos.some(
    (intervalo) => slotInicioMin >= intervalo.inicioMin && slotFimMin <= intervalo.fimMin
  );
}

function bloqueioAfetaQuadra(bloqueio: BloqueioAgenda, quadra: Quadra): boolean {
  if (!bloqueio.ativo) {
    return false;
  }

  if (bloqueio.quadraIds && bloqueio.quadraIds.length > 0) {
    return bloqueio.quadraIds.includes(quadra.id);
  }

  return !bloqueio.pointId || bloqueio.pointId === quadra.pointId;
}

function existeConflitoBloqueio(
  quadra: Quadra,
  slotInicio: Date,
  slotFim: Date,
  bloqueios: BloqueioAgenda[]
): boolean {
  return bloqueios.some((bloqueio) => {
    if (!bloqueioAfetaQuadra(bloqueio, quadra)) {
      return false;
    }

    const bloqueioInicio = parseDateUTC(bloqueio.dataInicio);
    const bloqueioFim = parseDateUTC(bloqueio.dataFim);
    const bloqueioInicioDia = new Date(
      Date.UTC(
        bloqueioInicio.getUTCFullYear(),
        bloqueioInicio.getUTCMonth(),
        bloqueioInicio.getUTCDate()
      )
    );
    const bloqueioFimDia = new Date(
      Date.UTC(
        bloqueioFim.getUTCFullYear(),
        bloqueioFim.getUTCMonth(),
        bloqueioFim.getUTCDate()
      )
    );

    const slotInicioDia = new Date(
      Date.UTC(slotInicio.getUTCFullYear(), slotInicio.getUTCMonth(), slotInicio.getUTCDate())
    );
    const slotFimDia = new Date(
      Date.UTC(slotFim.getUTCFullYear(), slotFim.getUTCMonth(), slotFim.getUTCDate())
    );

    const diaIteracao = new Date(slotInicioDia);
    while (diaIteracao <= slotFimDia) {
      if (diaIteracao >= bloqueioInicioDia && diaIteracao <= bloqueioFimDia) {
        const inicioMin = bloqueio.horaInicio != null ? bloqueio.horaInicio : 0;
        const fimMin = bloqueio.horaFim != null ? bloqueio.horaFim : 1440;
        const inicioBloqueioNoDia = new Date(diaIteracao.getTime() + inicioMin * 60_000);
        const fimBloqueioNoDia = new Date(diaIteracao.getTime() + fimMin * 60_000);
        if (inicioBloqueioNoDia < slotFim && fimBloqueioNoDia > slotInicio) {
          return true;
        }
      }
      diaIteracao.setUTCDate(diaIteracao.getUTCDate() + 1);
    }

    return false;
  });
}

function existeConflitoAgendamento(
  quadra: Quadra,
  slotInicio: Date,
  slotFim: Date,
  agendamentos: Agendamento[]
): boolean {
  return agendamentos.some((agendamento) => {
    if (agendamento.quadraId !== quadra.id || !agendamento.dataHora) {
      return false;
    }

    const inicioAgendamento = parseDateUTC(agendamento.dataHora);
    const fimAgendamento = new Date(
      inicioAgendamento.getTime() + (agendamento.duracao || 60) * 60_000
    );

    return inicioAgendamento < slotFim && fimAgendamento > slotInicio;
  });
}

export default function HorariosNobresDisponiveisSemana({
  pointId,
  inicioSemana,
  duracaoMinutos = 60,
  onAbrirAgendamento,
}: HorariosNobresDisponiveisSemanaProps) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [diasDisponiveis, setDiasDisponiveis] = useState<DiaHorarioNobre[]>([]);

  useEffect(() => {
    let ativo = true;

    const carregarDisponibilidade = async () => {
      if (!pointId) {
        setDiasDisponiveis([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErro('');

        const inicio = normalizarInicioDia(inicioSemana);
        const ano = inicio.getFullYear();
        const mes = inicio.getMonth();
        const dia = inicio.getDate();

        const dataInicio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
        const dataFim = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));
        dataFim.setUTCDate(dataFim.getUTCDate() + (DIAS_NA_SEMANA - 1));

        const [quadrasData, horariosAtendimentoData, agendamentosData, bloqueiosData] =
          await Promise.all([
            quadraService.listar(pointId),
            horarioAtendimentoService.listar({ pointId }),
            agendamentoService.listar({
              pointId,
              dataInicio: dataInicio.toISOString(),
              dataFim: dataFim.toISOString(),
              status: 'CONFIRMADO',
            }),
            bloqueioAgendaService.listar({
              pointId,
              dataInicio: dataInicio.toISOString(),
              dataFim: dataFim.toISOString(),
              apenasAtivos: true,
            }),
          ]);

        if (!ativo) {
          return;
        }

        const quadrasAtivas = quadrasData.filter((quadra) => quadra.ativo);
        const mapaHorarios = montarMapaHorariosAtendimento(horariosAtendimentoData);
        const diasSemana = gerarDiasDaSemana(inicioSemana);
        const slotsNobres = gerarSlotsNobres(duracaoMinutos);

        const resumoSemana = diasSemana.map((data) => {
          const dataStr = formatarDataLocal(data);
          const diaSemana = new Date(
            Date.UTC(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0)
          ).getUTCDay();

          const slotsDisponiveis = slotsNobres
            .map((slot) => {
              const slotInicio = new Date(`${dataStr}T${formatarHora(slot.inicioMin)}:00Z`);
              const slotFim = new Date(`${dataStr}T${formatarHora(slot.fimMin)}:00Z`);

              const quadrasLivres = quadrasAtivas.filter((quadra) => {
                if (
                  !quadraAceitaSlotNoHorarioAtendimento(
                    quadra,
                    diaSemana,
                    slot.inicioMin,
                    slot.fimMin,
                    mapaHorarios
                  )
                ) {
                  return false;
                }

                if (existeConflitoAgendamento(quadra, slotInicio, slotFim, agendamentosData)) {
                  return false;
                }

                if (existeConflitoBloqueio(quadra, slotInicio, slotFim, bloqueiosData)) {
                  return false;
                }

                return true;
              });

              if (quadrasLivres.length === 0) {
                return null;
              }

              return {
                horaInicio: formatarHora(slot.inicioMin),
                horaFim: formatarHora(slot.fimMin),
                quadrasLivres,
              };
            })
            .filter(Boolean) as SlotNobreDisponivel[];

          return {
            data: dataStr,
            dataObj: data,
            slots: slotsDisponiveis,
          };
        });

        setDiasDisponiveis(resumoSemana);
      } catch (error) {
        console.error('Erro ao carregar horarios nobres disponiveis:', error);
        if (ativo) {
          setErro('Nao foi possivel carregar os horarios nobres disponiveis.');
          setDiasDisponiveis([]);
        }
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };

    carregarDisponibilidade();

    return () => {
      ativo = false;
    };
  }, [duracaoMinutos, inicioSemana, pointId]);

  const totalSlotsLivres = useMemo(
    () => diasDisponiveis.reduce((total, dia) => total + dia.slots.length, 0),
    [diasDisponiveis]
  );

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            Horarios Nobres Disponiveis
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Mostra slots livres no intervalo nobre da arena, com inicio a partir das 18:00 e
            encerramento ate 20:30 nos proximos 7 dias da agenda.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{totalSlotsLivres} slots livres na semana</span>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: DIAS_NA_SEMANA }).map((_, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-10 bg-gray-100 rounded-lg" />
                <div className="h-10 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!loading && !erro && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {diasDisponiveis.map((dia) => (
            <div
              key={dia.data}
              className="border border-gray-200 rounded-xl p-4 bg-gradient-to-b from-white to-gray-50"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">
                    {dia.dataObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {dia.dataObj.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                  {dia.slots.length} livre{dia.slots.length === 1 ? '' : 's'}
                </span>
              </div>

              {dia.slots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 text-center">
                  Nenhum horario nobre livre neste dia.
                </div>
              ) : (
                <div className="space-y-3">
                  {dia.slots.map((slot) => (
                    <div
                      key={`${dia.data}-${slot.horaInicio}`}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {slot.horaInicio} - {slot.horaFim}
                        </span>
                        <span className="text-xs font-medium text-amber-800">
                          {slot.quadrasLivres.length} quadra
                          {slot.quadrasLivres.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start gap-2 text-xs text-gray-600">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                        <span>{slot.quadrasLivres.map((quadra) => quadra.nome).join(', ')}</span>
                      </div>

                      {onAbrirAgendamento && (
                        <button
                          type="button"
                          onClick={() => onAbrirAgendamento(dia.data, slot.horaInicio)}
                          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors text-xs font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Abrir agendamento
                        </button>
                      )}
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
