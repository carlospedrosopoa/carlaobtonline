// components/QuadrasDisponiveisPorHorarioModal.tsx - Modal para buscar quadras disponíveis em um horário específico
'use client';

import { useState, useEffect } from 'react';
import { quadraService, agendamentoService, bloqueioAgendaService } from '@/services/agendamentoService';
import type { Quadra, Agendamento, BloqueioAgenda } from '@/types/agendamento';
import { X, Clock, Calendar, CheckCircle, XCircle, MapPin } from 'lucide-react';

interface QuadrasDisponiveisPorHorarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  quadras: Quadra[];
  onSelecionarQuadra?: (quadraId: string, data: string, hora: string) => void;
}

export default function QuadrasDisponiveisPorHorarioModal({
  isOpen,
  onClose,
  quadras,
  onSelecionarQuadra,
}: QuadrasDisponiveisPorHorarioModalProps) {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState(60); // Duração padrão de 60 minutos
  const [carregando, setCarregando] = useState(false);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<Quadra[]>([]);
  const [quadrasIndisponiveis, setQuadrasIndisponiveis] = useState<Array<{ quadra: Quadra; motivo: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      // Inicializar com data e hora atual
      const agora = new Date();
      const dataStr = agora.toISOString().split('T')[0];
      const horaStr = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
      setData(dataStr);
      setHora(horaStr);
      setQuadrasDisponiveis([]);
      setQuadrasIndisponiveis([]);
    }
  }, [isOpen]);

  const verificarDisponibilidade = async () => {
    if (!data || !hora) {
      alert('Por favor, selecione data e horário');
      return;
    }

    setCarregando(true);
    setQuadrasDisponiveis([]);
    setQuadrasIndisponiveis([]);

    try {
      // Criar data/hora de início e fim em UTC
      const [horaStr, minutoStr] = hora.split(':');
      const ano = parseInt(data.split('-')[0]);
      const mes = parseInt(data.split('-')[1]) - 1;
      const dia = parseInt(data.split('-')[2]);
      const horaNum = parseInt(horaStr);
      const minutoNum = parseInt(minutoStr);

      // Criar data/hora de início em UTC
      const dataHoraInicio = new Date(Date.UTC(ano, mes, dia, horaNum, minutoNum, 0));
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60000);

      const dataInicioISO = dataHoraInicio.toISOString();
      const dataFimISO = dataHoraFim.toISOString();

      // Buscar agendamentos e bloqueios no período
      const [agendamentos, bloqueios] = await Promise.all([
        agendamentoService.listar({
          dataInicio: dataInicioISO,
          dataFim: dataFimISO,
          status: 'CONFIRMADO',
        }),
        bloqueioAgendaService.listar({
          dataInicio: dataInicioISO,
          dataFim: dataFimISO,
          apenasAtivos: true,
        }),
      ]);

      const disponiveis: Quadra[] = [];
      const indisponiveis: Array<{ quadra: Quadra; motivo: string }> = [];

      // Verificar cada quadra
      for (const quadra of quadras) {
        // Verificar se há agendamento confirmado nesta quadra no horário
        const temAgendamento = agendamentos.some((ag) => {
          if (ag.quadraId !== quadra.id) return false;
          
          // Verificar se há sobreposição de horários
          const agDataHora = new Date(ag.dataHora);
          const agDataHoraFim = new Date(agDataHora.getTime() + ag.duracao * 60000);
          
          // Há sobreposição se o início ou fim do agendamento está dentro do período solicitado
          return (
            (agDataHora >= dataHoraInicio && agDataHora < dataHoraFim) ||
            (agDataHoraFim > dataHoraInicio && agDataHoraFim <= dataHoraFim) ||
            (agDataHora <= dataHoraInicio && agDataHoraFim >= dataHoraFim)
          );
        });

        if (temAgendamento) {
          indisponiveis.push({ quadra, motivo: 'Agendamento confirmado neste horário' });
          continue;
        }

        // Verificar bloqueios
        const temBloqueio = bloqueios.some((bloqueio) => {
          if (!bloqueio.ativo) return false;

          // Verificar se o bloqueio afeta esta quadra
          if (bloqueio.quadraIds === null) {
            // Bloqueio geral - verificar se a quadra pertence ao mesmo point
            return quadra.pointId === bloqueio.pointId;
          } else {
            // Bloqueio específico - verificar se a quadra está na lista
            return bloqueio.quadraIds.includes(quadra.id);
          }
        });

        if (temBloqueio) {
          // Verificar se o bloqueio cobre o horário específico
          const bloqueioCobreHorario = bloqueios.some((bloqueio) => {
            if (!bloqueio.ativo) return false;
            
            // Verificar se afeta a quadra
            const afetaQuadra = bloqueio.quadraIds === null
              ? quadra.pointId === bloqueio.pointId
              : bloqueio.quadraIds.includes(quadra.id);
            
            if (!afetaQuadra) return false;

            // Verificar se o horário está dentro do período do bloqueio
            const bloqueioInicio = new Date(bloqueio.dataInicio);
            const bloqueioFim = new Date(bloqueio.dataFim);
            
            // Verificar se há sobreposição de datas
            if (dataHoraFim <= bloqueioInicio || dataHoraInicio >= bloqueioFim) {
              return false;
            }

            // Se o bloqueio tem horário específico, verificar
            if (bloqueio.horaInicio !== null && bloqueio.horaInicio !== undefined && 
                bloqueio.horaFim !== null && bloqueio.horaFim !== undefined) {
              const minutosInicio = horaNum * 60 + minutoNum;
              const minutosFim = minutosInicio + duracao;
              
              // Verificar sobreposição de horários
              return !(minutosFim <= bloqueio.horaInicio || minutosInicio >= bloqueio.horaFim);
            }

            // Bloqueio de dia inteiro
            return true;
          });

          if (bloqueioCobreHorario) {
            indisponiveis.push({ quadra, motivo: 'Bloqueio de agenda' });
            continue;
          }
        }

        // Quadra disponível
        disponiveis.push(quadra);
      }

      setQuadrasDisponiveis(disponiveis);
      setQuadrasIndisponiveis(indisponiveis);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      alert('Erro ao verificar disponibilidade das quadras');
    } finally {
      setCarregando(false);
    }
  };

  const handleSelecionarQuadra = (quadraId: string) => {
    if (onSelecionarQuadra && data && hora) {
      onSelecionarQuadra(quadraId, data, hora);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quadras Disponíveis</h2>
            <p className="text-sm text-gray-600 mt-1">Selecione data e horário para verificar disponibilidade</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Formulário de busca */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Horário
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duração (minutos)
              </label>
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
            <div className="flex items-end">
              <button
                onClick={verificarDisponibilidade}
                disabled={carregando || !data || !hora}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {carregando ? 'Verificando...' : 'Verificar'}
              </button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="p-6">
          {carregando ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Verificando disponibilidade...</p>
            </div>
          ) : quadrasDisponiveis.length === 0 && quadrasIndisponiveis.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Selecione data e horário para verificar disponibilidade</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quadras Disponíveis */}
              {quadrasDisponiveis.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Quadras Disponíveis ({quadrasDisponiveis.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quadrasDisponiveis.map((quadra) => (
                      <div
                        key={quadra.id}
                        className="border-2 border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">{quadra.nome}</h4>
                            {quadra.tipo && (
                              <p className="text-sm text-gray-600 mb-1">Tipo: {quadra.tipo}</p>
                            )}
                            {quadra.capacidade && (
                              <p className="text-sm text-gray-600">
                                Capacidade: {quadra.capacidade} pessoa{quadra.capacidade !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          {onSelecionarQuadra && (
                            <button
                              onClick={() => handleSelecionarQuadra(quadra.id)}
                              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Selecionar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quadras Indisponíveis */}
              {quadrasIndisponiveis.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    Quadras Indisponíveis ({quadrasIndisponiveis.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quadrasIndisponiveis.map(({ quadra, motivo }) => (
                      <div
                        key={quadra.id}
                        className="border-2 border-red-200 bg-red-50 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">{quadra.nome}</h4>
                            <p className="text-sm text-red-600 font-medium">{motivo}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

