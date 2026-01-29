'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { dashboardOperacionalService, type DashboardOperacionalData } from '@/services/gestaoArenaService';
import { Clock, Package, Receipt, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CardGrafico,
  DIAS_SEMANA,
  KpiCard,
  TURNOS_ORDEM,
  formatarHorasDeMinutos,
  formatarMoeda,
} from '@/components/dashboard-operacional/DashboardOperacionalWidgets';
import { FiltrosPeriodo, KpisSkeleton, ProdutosTable } from '@/components/dashboard-operacional/DashboardOperacionalSections';

function isoStartOfDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function isoEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

export default function DashboardOperacionalArenaPage() {
  const { usuario } = useAuth();

  const [dataDe, setDataDe] = useState(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 30);
    return inicio.toISOString().split('T')[0];
  });
  const [dataAte, setDataAte] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<DashboardOperacionalData | null>(null);

  const podeAplicar = Boolean(usuario?.pointIdGestor && dataDe && dataAte && dataDe <= dataAte);

  const carregar = async () => {
    if (!usuario?.pointIdGestor) return;
    
    // Validar datas antes de converter
    if (!dataDe || !dataAte) {
      return;
    }
    
    if (dataDe > dataAte) {
      setErro('Período inválido: a data inicial não pode ser maior que a data final.');
      return;
    }

    try {
      setLoading(true);
      setErro('');
      
      // Garantir datas ISO válidas
      const inicioISO = isoStartOfDay(dataDe);
      const fimISO = isoEndOfDay(dataAte);

      const res = await dashboardOperacionalService.obter(
        usuario.pointIdGestor,
        inicioISO,
        fimISO
      );
      setDados(res);
    } catch (e: any) {
      console.error('Erro ao carregar dashboard:', e);
      setErro(e?.response?.data?.mensagem || 'Erro ao carregar dashboard operacional');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuario?.pointIdGestor) return;
    if (!dataDe || !dataAte) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.pointIdGestor]);

  const view = useMemo(() => {
    const ag = dados?.agendamentos;
    const com = dados?.comandas;

    const turnos = TURNOS_ORDEM.map((t) => {
      const row = ag?.porTurno?.find((x) => x.turno === t);
      return {
        turno: t,
        quantidade: row?.quantidade || 0,
        totalMinutos: row?.totalMinutos || 0,
      };
    });

    const dows = Array.from({ length: 7 }).map((_, i) => {
      const row = ag?.porDiaSemana?.find((x) => x.diaSemana === i);
      return {
        dia: DIAS_SEMANA[i],
        quantidade: row?.quantidade || 0,
        totalMinutos: row?.totalMinutos || 0,
      };
    });

    const duracoes = (ag?.duracaoRanking || []).map((r) => ({
      duracao: `${r.duracao}m`,
      quantidade: r.quantidade,
      totalMinutos: r.totalMinutos,
    }));

    const horarios = (ag?.horariosMaisVendidos || []).map((r) => ({
      hora: `${String(r.hora).padStart(2, '0')}h`,
      quantidade: r.quantidade,
      totalMinutos: r.totalMinutos,
    }));

    const fatDows = Array.from({ length: 7 }).map((_, i) => {
      const row = com?.faturamentoPorDiaSemana?.find((x) => x.diaSemana === i);
      return {
        dia: DIAS_SEMANA[i],
        valorTotal: row?.valorTotal || 0,
      };
    });

    const topDuracao = ag?.duracaoRanking?.[0] || null;

    return {
      kpis: {
        totalAgendamentos: ag?.total || 0,
        totalMinutosAgendados: ag?.totalMinutos || 0,
        totalItens: com?.totalItens || 0,
        faturamento: com?.faturamento || 0,
        totalComandas: com?.totalComandas || 0,
        ticketMedio: com?.ticketMedio || 0,
        duracaoMaisConsumida: topDuracao?.duracao || 0,
        duracaoMaisConsumidaMinutos: topDuracao?.totalMinutos || 0,
      },
      turnos,
      dows,
      duracoes,
      horarios,
      fatDows,
      produtos: (com?.topProdutos || []).map((r: any) => ({
        produtoId: String(r.produtoId),
        produto: String(r.nome),
        categoria: String(r.categoria || ''),
        quantidade: Number(r.quantidade) || 0,
        valorTotal: Number(r.valorTotal) || 0,
      })),
    };
  }, [dados]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Operacional</h1>
          <p className="text-gray-600 mt-1">Agendamentos e comandas com filtro por período</p>
        </div>
      </div>

      <FiltrosPeriodo
        dataDe={dataDe}
        dataAte={dataAte}
        onChangeDataDe={setDataDe}
        onChangeDataAte={setDataAte}
        onLimpar={() => {
          const hoje = new Date();
          const inicio = new Date(hoje);
          inicio.setDate(hoje.getDate() - 30);
          setDataDe(inicio.toISOString().split('T')[0]);
          setDataAte(hoje.toISOString().split('T')[0]);
        }}
        onAplicar={carregar}
        loading={loading}
        podeAplicar={podeAplicar}
        erro={erro}
      />

      {loading && !dados ? (
        <KpisSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <KpiCard
              titulo="Agendamentos"
              valor={String(view.kpis.totalAgendamentos)}
              subtitulo={view.kpis.totalMinutosAgendados ? `Total: ${formatarHorasDeMinutos(view.kpis.totalMinutosAgendados)}` : '—'}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Horas agendadas"
              valor={formatarHorasDeMinutos(view.kpis.totalMinutosAgendados)}
              subtitulo={view.kpis.duracaoMaisConsumida ? `Duração líder: ${view.kpis.duracaoMaisConsumida} min` : '—'}
              icon={<Clock className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Itens (comandas)"
              valor={String(view.kpis.totalItens)}
              subtitulo={view.kpis.faturamento ? `Faturamento: ${formatarMoeda(view.kpis.faturamento)}` : '—'}
              icon={<Package className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Ticket médio (comandas)"
              valor={formatarMoeda(view.kpis.ticketMedio)}
              subtitulo={view.kpis.totalComandas ? `Comandas: ${view.kpis.totalComandas}` : '—'}
              icon={<Receipt className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Faturamento (comandas)"
              valor={formatarMoeda(view.kpis.faturamento)}
              subtitulo={view.kpis.totalComandas ? `Média: ${formatarMoeda(view.kpis.faturamento / Math.max(1, view.kpis.totalComandas))} por comanda` : '—'}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CardGrafico title="Agendamentos por turno">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.turnos} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="turno" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardGrafico>

            <CardGrafico title="Agendamentos por dia da semana">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.dows} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardGrafico>

            <CardGrafico title="Durações mais consumidas">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.duracoes} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="duracao" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardGrafico>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardGrafico title="Horários mais vendidos (top 12)">
              <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                <BarChart data={view.horarios} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardGrafico>

            <CardGrafico title="Faturamento por dia da semana (comandas)">
              <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                <BarChart data={view.fatDows} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => formatarMoeda(Number(v) || 0)} />
                  <Bar dataKey="valorTotal" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardGrafico>
          </div>

          <ProdutosTable produtos={view.produtos} />
        </>
      )}
    </div>
  );
}

