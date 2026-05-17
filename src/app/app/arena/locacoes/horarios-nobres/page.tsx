'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import HorariosNobresDisponiveisSemana from '@/components/HorariosNobresDisponiveisSemana';

function normalizarInicioDia(date: Date): Date {
  const novaData = new Date(date);
  novaData.setHours(0, 0, 0, 0);
  return novaData;
}

export default function HorariosNobresPage() {
  const { usuario } = useAuth();
  const [inicioSemana, setInicioSemana] = useState(() => normalizarInicioDia(new Date()));
  const [duracaoMinutos, setDuracaoMinutos] = useState(60);
  const [ocultarFimDeSemana, setOcultarFimDeSemana] = useState(false);

  const periodoTexto = useMemo(() => {
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);

    return `${inicioSemana.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })} - ${fimSemana.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })}`;
  }, [inicioSemana]);

  const navegarSemana = (direcao: 'anterior' | 'proxima') => {
    setInicioSemana((atual) => {
      const novaData = new Date(atual);
      novaData.setDate(novaData.getDate() + (direcao === 'proxima' ? 7 : -7));
      return normalizarInicioDia(novaData);
    });
  };

  const irParaHoje = () => {
    setInicioSemana(normalizarInicioDia(new Date()));
  };

  const handleDataSelecionada = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      return;
    }

    const [ano, mes, dia] = event.target.value.split('-').map(Number);
    setInicioSemana(normalizarInicioDia(new Date(ano, mes - 1, dia)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Horarios Nobres Disponiveis</h1>
          <p className="text-gray-600 max-w-3xl">
            Consulte os horarios livres da semana no intervalo nobre da arena, com inicio minimo
            as 18:00 e inicio maximo as 21:00.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 w-fit">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Gestao de horarios nobres da semana</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={() => navegarSemana('anterior')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex-1 text-center space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">{periodoTexto}</h2>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={irParaHoje}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ir para hoje
              </button>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={inicioSemana.toISOString().split('T')[0]}
                  onChange={handleDataSelecionada}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  title="Selecione uma data para iniciar a consulta"
                />
              </div>
              <select
                value={duracaoMinutos}
                onChange={(event) => setDuracaoMinutos(Number(event.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                title="Selecione o intervalo"
              >
                <option value={60}>Intervalo de 1h</option>
                <option value={90}>Intervalo de 1h30</option>
                <option value={120}>Intervalo de 2h</option>
              </select>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ocultarFimDeSemana}
                  onChange={(event) => setOcultarFimDeSemana(event.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Ocultar sabado e domingo
              </label>
            </div>
          </div>

          <button
            onClick={() => navegarSemana('proxima')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <HorariosNobresDisponiveisSemana
        pointId={usuario?.pointIdGestor ?? undefined}
        inicioSemana={inicioSemana}
        duracaoMinutos={duracaoMinutos}
        ocultarFimDeSemana={ocultarFimDeSemana}
      />
    </div>
  );
}
