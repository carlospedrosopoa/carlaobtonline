// app/app/atleta/agendamentos/agenda/page.tsx - Agenda semanal do atleta
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { agendamentoService } from '@/services/agendamentoService';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import ConfirmarCancelamentoRecorrenteModal from '@/components/ConfirmarCancelamentoRecorrenteModal';
import type { Agendamento, StatusAgendamento } from '@/types/agendamento';
import { Calendar, Clock, MapPin, X, CheckCircle, XCircle, CalendarCheck, User, Users, UserPlus, Edit, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AgendaSemanalPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaAtual, setSemanaAtual] = useState(new Date());
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [agendamentoCancelando, setAgendamentoCancelando] = useState<Agendamento | null>(null);

  // Calcular início da semana (segunda-feira)
  const inicioSemana = useMemo(() => {
    const data = new Date(semanaAtual);
    const dia = data.getDay();
    const diff = data.getDate() - dia + (dia === 0 ? -6 : 1); // Ajuste para segunda-feira
    const segunda = new Date(data);
    segunda.setDate(diff);
    segunda.setHours(0, 0, 0, 0);
    return segunda;
  }, [semanaAtual]);

  // Calcular fim da semana (domingo)
  const fimSemana = useMemo(() => {
    const domingo = new Date(inicioSemana);
    domingo.setDate(domingo.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return domingo;
  }, [inicioSemana]);

  // Gerar dias da semana
  const diasSemana = useMemo(() => {
    const dias = [];
    const nomesDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    for (let i = 0; i < 7; i++) {
      const data = new Date(inicioSemana);
      data.setDate(data.getDate() + i);
      dias.push({
        data,
        nome: nomesDias[i],
        dia: data.getDate(),
        mes: data.getMonth() + 1,
      });
    }
    return dias;
  }, [inicioSemana]);

  useEffect(() => {
    carregarAgendamentos();
  }, [semanaAtual]);

  const formatarDataLocal = (date: Date) => {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    const hora = String(date.getHours()).padStart(2, '0');
    const minuto = String(date.getMinutes()).padStart(2, '0');
    const segundo = String(date.getSeconds()).padStart(2, '0');
    return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  };

  const carregarAgendamentos = async () => {
    try {
      setLoading(true);
      const filtros: any = {
        apenasMeus: true,
        dataInicio: formatarDataLocal(inicioSemana),
        dataFim: formatarDataLocal(fimSemana),
      };

      const data = await agendamentoService.listar(filtros);
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar agendamentos por dia
  const agendamentosPorDia = useMemo(() => {
    const agrupados: { [key: string]: Agendamento[] } = {};
    diasSemana.forEach((dia) => {
      const chave = `${dia.data.getFullYear()}-${dia.mes}-${dia.dia}`;
      agrupados[chave] = [];
    });

    agendamentos.forEach((ag) => {
      const dataHoraStr = ag.dataHora;
      const dataPart = dataHoraStr.split('T')[0];
      if (agrupados[dataPart]) {
        agrupados[dataPart].push(ag);
      }
    });

    // Ordenar agendamentos por hora em cada dia
    Object.keys(agrupados).forEach((chave) => {
      agrupados[chave].sort((a, b) => {
        const horaA = a.dataHora.match(/T(\d{2}):(\d{2})/);
        const horaB = b.dataHora.match(/T(\d{2}):(\d{2})/);
        const minutosA = horaA ? parseInt(horaA[1], 10) * 60 + parseInt(horaA[2], 10) : 0;
        const minutosB = horaB ? parseInt(horaB[1], 10) * 60 + parseInt(horaB[2], 10) : 0;
        return minutosA - minutosB;
      });
    });

    return agrupados;
  }, [agendamentos, diasSemana]);

  const handleEditar = (agendamento: Agendamento) => {
    const podeEditar = agendamento.usuarioId === usuario?.id;
    
    if (!podeEditar) {
      alert('Você não tem permissão para editar este agendamento');
      return;
    }

    setAgendamentoEditando(agendamento);
    setModalEditarAberto(true);
  };

  const handleCancelar = (agendamento: Agendamento) => {
    const podeCancelar = agendamento.usuarioId === usuario?.id;
    
    if (!podeCancelar) {
      alert('Você não tem permissão para cancelar este agendamento');
      return;
    }

    setAgendamentoCancelando(agendamento);
    setModalCancelarAberto(true);
  };

  const confirmarCancelamento = async (aplicarARecorrencia: boolean) => {
    if (!agendamentoCancelando) return;

    try {
      await agendamentoService.cancelar(agendamentoCancelando.id, aplicarARecorrencia);
      setModalCancelarAberto(false);
      setAgendamentoCancelando(null);
      carregarAgendamentos();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao cancelar agendamento');
    }
  };

  const getStatusBadge = (status: StatusAgendamento) => {
    const styles = {
      CONFIRMADO: 'bg-green-100 text-green-700',
      CANCELADO: 'bg-red-100 text-red-700',
      CONCLUIDO: 'bg-gray-100 text-gray-700',
    };

    const icons = {
      CONFIRMADO: <CheckCircle className="w-4 h-4" />,
      CANCELADO: <XCircle className="w-4 h-4" />,
      CONCLUIDO: <CalendarCheck className="w-4 h-4" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const getTipoBadge = (agendamento: Agendamento) => {
    if (agendamento.atletaId && agendamento.atleta) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          <Users className="w-3 h-3" />
          Atleta
        </span>
      );
    }
    if (agendamento.nomeAvulso) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
          <UserPlus className="w-3 h-3" />
          Avulso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <User className="w-3 h-3" />
        Próprio
      </span>
    );
  };

  const formatCurrency = (v: number | null) =>
    v == null
      ? '—'
      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const semanaAnterior = () => {
    const novaData = new Date(semanaAtual);
    novaData.setDate(novaData.getDate() - 7);
    setSemanaAtual(novaData);
  };

  const semanaProxima = () => {
    const novaData = new Date(semanaAtual);
    novaData.setDate(novaData.getDate() + 7);
    setSemanaAtual(novaData);
  };

  const irParaHoje = () => {
    setSemanaAtual(new Date());
  };

  const formatarSemana = () => {
    const inicio = inicioSemana;
    const fim = fimSemana;
    return `${inicio.getDate()}/${inicio.getMonth() + 1} - ${fim.getDate()}/${fim.getMonth() + 1}/${fim.getFullYear()}`;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Agenda Semanal</h1>
          <p className="text-gray-600">Visualize sua agenda semanal de partidas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={semanaAnterior}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={irParaHoje}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Hoje
          </button>
          <button
            onClick={semanaProxima}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Próxima semana"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cabeçalho da semana */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Semana de {formatarSemana()}
          </h2>
        </div>
      </div>

      {/* Grade semanal */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {diasSemana.map((dia, index) => {
            const chave = `${dia.data.getFullYear()}-${dia.mes}-${dia.dia}`;
            const agendamentosDoDia = agendamentosPorDia[chave] || [];
            const hoje = new Date();
            const isHoje = dia.data.toDateString() === hoje.toDateString();

            return (
              <div key={index} className="bg-white min-h-[400px]">
                {/* Cabeçalho do dia */}
                <div className={`p-3 border-b border-gray-200 ${isHoje ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium text-gray-600">{dia.nome}</div>
                  <div className={`text-lg font-bold ${isHoje ? 'text-blue-600' : 'text-gray-900'}`}>
                    {dia.dia}/{dia.mes}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {agendamentosDoDia.length} agendamento{agendamentosDoDia.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Agendamentos do dia */}
                <div className="p-2 space-y-2">
                  {agendamentosDoDia.map((agendamento) => {
                    const dataHoraStr = agendamento.dataHora;
                    const match = dataHoraStr.match(/T(\d{2}):(\d{2})/);
                    const horaInicio = match ? `${match[1]}:${match[2]}` : '';
                    const minutosTotais = match
                      ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + agendamento.duracao
                      : 0;
                    const horaFim = `${Math.floor(minutosTotais / 60) % 24}`.padStart(2, '0');
                    const minutoFim = `${minutosTotais % 60}`.padStart(2, '0');

                    return (
                      <div
                        key={agendamento.id}
                        onClick={() => {
                          if (agendamento.status === 'CONFIRMADO' && agendamento.usuarioId === usuario?.id) {
                            handleEditar(agendamento);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          agendamento.status === 'CONFIRMADO' && agendamento.usuarioId === usuario?.id
                            ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 mb-1">
                          {agendamento.quadra.nome}
                        </div>
                        <div className="text-gray-600 mb-1">
                          {horaInicio} - {horaFim}:{minutoFim}
                        </div>
                        <div className="mb-1">
                          {getTipoBadge(agendamento)}
                        </div>
                        <div className="mb-1">
                          {getStatusBadge(agendamento.status)}
                        </div>
                        <div className="text-gray-700 font-medium">
                          {formatCurrency(agendamento.valorNegociado ?? agendamento.valorCalculado)}
                        </div>
                        {agendamento.quadra.point.logoUrl && (
                          <div className="mt-1">
                            <img
                              src={agendamento.quadra.point.logoUrl}
                              alt={agendamento.quadra.point.nome}
                              className="w-4 h-4 object-contain inline-block mr-1"
                            />
                            <span className="text-gray-500 text-[10px]">
                              {agendamento.quadra.point.nome}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Edição */}
      <EditarAgendamentoModal
        isOpen={modalEditarAberto}
        agendamento={agendamentoEditando}
        onClose={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
        }}
        onSuccess={() => {
          setModalEditarAberto(false);
          setAgendamentoEditando(null);
          carregarAgendamentos();
        }}
      />

      {/* Modal de Confirmação de Cancelamento */}
      <ConfirmarCancelamentoRecorrenteModal
        isOpen={modalCancelarAberto}
        agendamento={agendamentoCancelando}
        onClose={() => {
          setModalCancelarAberto(false);
          setAgendamentoCancelando(null);
        }}
        onConfirmar={confirmarCancelamento}
      />
    </div>
  );
}
