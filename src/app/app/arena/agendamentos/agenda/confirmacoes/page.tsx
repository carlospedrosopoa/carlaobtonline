'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { agendamentoService } from '@/services/agendamentoService';
import type { Agendamento, InteracaoAgendamento } from '@/types/agendamento';
import { ArrowLeft, Calendar, CheckCircle, ChevronLeft, ChevronRight, MessageCircle, RotateCw, Search } from 'lucide-react';

type ItemPainel = {
  agendamento: Agendamento;
  interacao: InteracaoAgendamento;
};

type FiltroStatusPainel =
  | 'TODOS'
  | 'AGUARDANDO_RESPOSTA'
  | 'CONFIRMADO_RECEBIMENTO'
  | 'SOLICITOU_CONTATO'
  | 'FALHA_ENVIO';

function formatarDataHoraCurta(dataHora: string) {
  return dataHora.slice(0, 16).replace('T', ' ');
}

function getStatusInteracaoConfig(interacao: InteracaoAgendamento | null) {
  if (!interacao) {
    return null;
  }

  const confirmadoManualmente = Boolean(interacao.metadata?.confirmadoManualmente);

  switch (interacao.status) {
    case 'AGUARDANDO_ENVIO':
      return {
        label: 'Preparando envio',
        resumo: 'Preparando envio',
        className: 'bg-slate-100 text-slate-700',
        dotClassName: 'bg-slate-500',
      };
    case 'AGUARDANDO_RESPOSTA':
      return {
        label: 'Aguardando resposta',
        resumo: 'Aguardando',
        className: 'bg-amber-100 text-amber-700',
        dotClassName: 'bg-amber-500',
      };
    case 'CONFIRMADO_RECEBIMENTO':
      return {
        label: confirmadoManualmente ? 'Confirmado manualmente' : 'Confirmado no WhatsApp',
        resumo: confirmadoManualmente ? 'Confirmado manual' : 'Confirmado',
        className: 'bg-emerald-100 text-emerald-700',
        dotClassName: 'bg-emerald-500',
      };
    case 'SOLICITOU_CONTATO':
      return {
        label: 'Solicitou contato',
        resumo: 'Pediu contato',
        className: 'bg-sky-100 text-sky-700',
        dotClassName: 'bg-sky-500',
      };
    case 'FALHA_ENVIO':
      return {
        label: 'Falha no envio',
        resumo: 'Falha envio',
        className: 'bg-rose-100 text-rose-700',
        dotClassName: 'bg-rose-500',
      };
    default:
      return {
        label: interacao.status,
        resumo: interacao.status,
        className: 'bg-gray-100 text-gray-700',
        dotClassName: 'bg-gray-500',
      };
  }
}

export default function AgendaConfirmacoesPage() {
  const router = useRouter();
  const { isAdmin, isOrganizer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inicioPeriodo, setInicioPeriodo] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusPainel>('TODOS');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [interacoesPorAgendamento, setInteracoesPorAgendamento] = useState<Record<string, InteracaoAgendamento>>({});
  const [salvandoConfirmacaoManualId, setSalvandoConfirmacaoManualId] = useState<string | null>(null);

  useEffect(() => {
    carregarConfirmacoes();
  }, [inicioPeriodo]);

  const carregarConfirmacoes = async () => {
    try {
      setLoading(true);

      const ano = inicioPeriodo.getFullYear();
      const mes = inicioPeriodo.getMonth();
      const dia = inicioPeriodo.getDate();

      const dataInicio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
      const dataFim = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));

      const agendamentosData = await agendamentoService.listar({
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        status: 'CONFIRMADO',
      });

      const interacoesData = agendamentosData.length > 0
        ? await agendamentoService.listarInteracoes(agendamentosData.map((agendamento) => agendamento.id))
        : [];

      setAgendamentos(agendamentosData);
      setInteracoesPorAgendamento(
        Object.fromEntries(interacoesData.map((interacao) => [interacao.agendamentoId, interacao]))
      );
    } catch (error) {
      console.error('Erro ao carregar confirmações:', error);
      setAgendamentos([]);
      setInteracoesPorAgendamento({});
    } finally {
      setLoading(false);
    }
  };

  const getInteracaoAgendamento = (agendamentoId: string) => interacoesPorAgendamento[agendamentoId] || null;

  const podeMarcarConfirmacaoManual = (agendamento: Agendamento) => {
    if (agendamento.status !== 'CONFIRMADO') {
      return false;
    }

    const interacao = getInteracaoAgendamento(agendamento.id);
    if (!interacao) {
      return true;
    }

    return interacao.status !== 'CONFIRMADO_RECEBIMENTO';
  };

  const handleConfirmarManual = async (agendamento: Agendamento) => {
    setSalvandoConfirmacaoManualId(agendamento.id);

    try {
      await agendamentoService.confirmarInteracaoManual(
        agendamento.id,
        'Confirmado manualmente pelo gestor na tela de confirmações'
      );
      await carregarConfirmacoes();
    } catch (error: any) {
      console.error('Erro ao registrar confirmação manual:', error);
      const mensagemErro =
        error?.response?.data?.mensagem ||
        error?.message ||
        'Erro ao registrar confirmação manual';
      alert(`Erro ao registrar confirmação manual: ${mensagemErro}`);
    } finally {
      setSalvandoConfirmacaoManualId(null);
    }
  };

  const navegarPeriodo = (direcao: 'anterior' | 'proximo') => {
    const novaData = new Date(inicioPeriodo);
    novaData.setDate(inicioPeriodo.getDate() + (direcao === 'proximo' ? 1 : -1));
    novaData.setHours(0, 0, 0, 0);
    setInicioPeriodo(novaData);
  };

  const irParaHoje = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    setInicioPeriodo(hoje);
  };

  const alternarFiltroStatus = (status: FiltroStatusPainel) => {
    setFiltroStatus((atual) => (atual === status ? 'TODOS' : status));
  };

  const resumoConfirmacoes = useMemo(() => {
    const termoBusca = filtroNome.trim().toLowerCase();
    const termoBuscaNumerico = termoBusca.replace(/\D/g, '');

    const itens = agendamentos
      .map((agendamento) => ({
        agendamento,
        interacao: getInteracaoAgendamento(agendamento.id),
      }))
      .filter((item): item is ItemPainel => Boolean(item.interacao))
      .filter((item) => item.interacao.status !== 'SUBSTITUIDA')
      .filter((item) => {
        if (!termoBusca) {
          return true;
        }

        const nome =
          item.agendamento.atleta?.nome ||
          item.agendamento.nomeAvulso ||
          item.agendamento.usuario?.name ||
          '';
        const telefone =
          item.agendamento.atleta?.fone ||
          item.agendamento.telefoneAvulso ||
          '';

        return (
          nome.toLowerCase().includes(termoBusca) ||
          (termoBuscaNumerico && telefone.replace(/\D/g, '').includes(termoBuscaNumerico))
        );
      })
      .sort((a, b) => {
        const dataA = new Date(
          a.interacao.respostaRecebidaEm ||
          a.interacao.updatedAt ||
          a.interacao.createdAt
        ).getTime();
        const dataB = new Date(
          b.interacao.respostaRecebidaEm ||
          b.interacao.updatedAt ||
          b.interacao.createdAt
        ).getTime();

        return dataB - dataA;
      });

    const itensFiltrados =
      filtroStatus === 'TODOS'
        ? itens
        : itens.filter((item) => item.interacao.status === filtroStatus);

    return {
      aguardando: itens.filter((item) => item.interacao.status === 'AGUARDANDO_RESPOSTA').length,
      confirmados: itens.filter((item) => item.interacao.status === 'CONFIRMADO_RECEBIMENTO').length,
      solicitouContato: itens.filter((item) => item.interacao.status === 'SOLICITOU_CONTATO').length,
      falhaEnvio: itens.filter((item) => item.interacao.status === 'FALHA_ENVIO').length,
      itens,
      itensFiltrados,
    };
  }, [agendamentos, interacoesPorAgendamento, filtroNome, filtroStatus]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/app/arena/agendamentos/agenda')}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a agenda
          </button>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Acompanhar Confirmações</h1>
          <p className="text-gray-600">
            Acompanhe as interações do WhatsApp sem ocupar espaço da agenda principal.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={irParaHoje}
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={carregarConfirmacoes}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 font-medium"
          >
            <RotateCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navegarPeriodo('anterior')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-sm font-semibold text-gray-900">
              {inicioPeriodo.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <button
              type="button"
              onClick={() => navegarPeriodo('proximo')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => alternarFiltroStatus('AGUARDANDO_RESPOSTA')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            filtroStatus === 'AGUARDANDO_RESPOSTA'
              ? 'border-amber-300 bg-amber-100 ring-2 ring-amber-200'
              : 'border-amber-100 bg-amber-50 hover:bg-amber-100'
          }`}
        >
          <div className="text-xs font-medium text-amber-700">Aguardando</div>
          <div className="text-2xl font-bold text-amber-900">{resumoConfirmacoes.aguardando}</div>
        </button>
        <button
          type="button"
          onClick={() => alternarFiltroStatus('CONFIRMADO_RECEBIMENTO')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            filtroStatus === 'CONFIRMADO_RECEBIMENTO'
              ? 'border-emerald-300 bg-emerald-100 ring-2 ring-emerald-200'
              : 'border-emerald-100 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          <div className="text-xs font-medium text-emerald-700">Confirmados</div>
          <div className="text-2xl font-bold text-emerald-900">{resumoConfirmacoes.confirmados}</div>
        </button>
        <button
          type="button"
          onClick={() => alternarFiltroStatus('SOLICITOU_CONTATO')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            filtroStatus === 'SOLICITOU_CONTATO'
              ? 'border-sky-300 bg-sky-100 ring-2 ring-sky-200'
              : 'border-sky-100 bg-sky-50 hover:bg-sky-100'
          }`}
        >
          <div className="text-xs font-medium text-sky-700">Solicitou contato</div>
          <div className="text-2xl font-bold text-sky-900">{resumoConfirmacoes.solicitouContato}</div>
        </button>
        <button
          type="button"
          onClick={() => alternarFiltroStatus('FALHA_ENVIO')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            filtroStatus === 'FALHA_ENVIO'
              ? 'border-rose-300 bg-rose-100 ring-2 ring-rose-200'
              : 'border-rose-100 bg-rose-50 hover:bg-rose-100'
          }`}
        >
          <div className="text-xs font-medium text-rose-700">Falha envio</div>
          <div className="text-2xl font-bold text-rose-900">{resumoConfirmacoes.falhaEnvio}</div>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {filtroStatus === 'TODOS'
              ? `Exibindo ${resumoConfirmacoes.itensFiltrados.length} interações do dia`
              : `Exibindo ${resumoConfirmacoes.itensFiltrados.length} interações filtradas`}
          </div>
          {filtroStatus !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setFiltroStatus('TODOS')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Limpar filtro
            </button>
          )}
        </div>
        {resumoConfirmacoes.itensFiltrados.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {resumoConfirmacoes.itensFiltrados.map(({ agendamento, interacao }) => {
              const statusConfig = getStatusInteracaoConfig(interacao);
              const nome =
                agendamento.atleta?.nome ||
                agendamento.nomeAvulso ||
                agendamento.usuario?.name ||
                'Atleta';

              return (
                <div
                  key={`confirmacao-${agendamento.id}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{nome}</div>
                      <div className="text-xs text-gray-600">
                        {agendamento.quadra?.nome || 'Quadra'} | {formatarDataHoraCurta(agendamento.dataHora)}
                      </div>
                    </div>
                    {statusConfig && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusConfig.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClassName}`}></span>
                        {statusConfig.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      {interacao.respostaRecebidaEm
                        ? `Atualizado em ${new Date(interacao.respostaRecebidaEm).toLocaleString('pt-BR')}`
                        : 'Aguardando retorno do atleta'}
                    </div>
                    {podeMarcarConfirmacaoManual(agendamento) && (isAdmin || isOrganizer) && (
                      <button
                        type="button"
                        onClick={() => handleConfirmarManual(agendamento)}
                        disabled={salvandoConfirmacaoManualId === agendamento.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {salvandoConfirmacaoManualId === agendamento.id ? 'Salvando...' : 'Confirmar manualmente'}
                      </button>
                    )}
                  </div>

                  {interacao.respostaRecebida && (
                    <div className="text-xs text-gray-600 border-t border-gray-200 pt-3">
                      <span className="font-medium text-gray-700">Resposta:</span> {interacao.respostaRecebida}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-600">
            Nenhuma interação encontrada para o filtro selecionado.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.push('/app/arena/agendamentos/agenda')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
        >
          <Calendar className="w-4 h-4" />
          Voltar para a agenda
        </button>
      </div>
    </div>
  );
}
