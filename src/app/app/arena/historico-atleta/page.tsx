'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  historicoAtletaArenaService,
  type AtletaHistoricoArena,
  type HistoricoAtletaAgendamento,
  type HistoricoAtletaConsumoItem,
  type HistoricoAtletaContaCorrente,
  type HistoricoAtletaPagamento,
  type HistoricoAtletaResumo,
} from '@/services/gestaoArenaService';
import { agendamentoService } from '@/services/agendamentoService';
import type { Agendamento } from '@/types/agendamento';
import type { CardCliente } from '@/types/gestaoArena';
import FiltrosHistoricoAtleta from '@/components/historico-atleta/FiltrosHistoricoAtleta';
import DetalheModal from '@/components/historico-atleta/DetalheModal';
import HistoricoTabs, { type AbaHistoricoAtleta } from '@/components/historico-atleta/HistoricoTabs';
import ResumoKpis from '@/components/historico-atleta/ResumoKpis';
import TabelaAgendamentos from '@/components/historico-atleta/TabelaAgendamentos';
import TabelaConsumo from '@/components/historico-atleta/TabelaConsumo';
import TabelaContaCorrente from '@/components/historico-atleta/TabelaContaCorrente';
import TabelaPagamentos from '@/components/historico-atleta/TabelaPagamentos';
import GerenciarCardModal from '@/components/GerenciarCardModal';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';

function isoInicioDia(dateYYYYMMDD: string) {
  if (!dateYYYYMMDD) return undefined;
  const d = new Date(`${dateYYYYMMDD}T00:00:00`);
  return d.toISOString();
}

function isoFimDia(dateYYYYMMDD: string) {
  if (!dateYYYYMMDD) return undefined;
  const d = new Date(`${dateYYYYMMDD}T23:59:59.999`);
  return d.toISOString();
}

export default function HistoricoAtletaArenaPage() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();

  const [atletaSelecionado, setAtletaSelecionado] = useState<AtletaHistoricoArena | null>(null);

  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [aplicadoDe, setAplicadoDe] = useState<string>('');
  const [aplicadoAte, setAplicadoAte] = useState<string>('');

  const [aba, setAba] = useState<AbaHistoricoAtleta>(() => {
    const abaParam = searchParams.get('aba');
    if (abaParam === 'pagamentos' || abaParam === 'contaCorrente' || abaParam === 'agendamentos' || abaParam === 'historico') {
      return abaParam as AbaHistoricoAtleta;
    }
    return 'consumo';
  });

  useEffect(() => {
    const abaParam = searchParams.get('aba');
    if (abaParam && (abaParam === 'pagamentos' || abaParam === 'contaCorrente' || abaParam === 'agendamentos' || abaParam === 'historico')) {
      setAba(abaParam as AbaHistoricoAtleta);
    }
  }, [searchParams]);
  const [resumo, setResumo] = useState<HistoricoAtletaResumo | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState<string>('');

  const [consumo, setConsumo] = useState<HistoricoAtletaConsumoItem[]>([]);
  const [pagamentos, setPagamentos] = useState<HistoricoAtletaPagamento[]>([]);
  const [contaCorrente, setContaCorrente] = useState<HistoricoAtletaContaCorrente | null>(null);
  const [agendamentos, setAgendamentos] = useState<HistoricoAtletaAgendamento[]>([]);

  const [loadingAba, setLoadingAba] = useState(false);
  const [erroAba, setErroAba] = useState<string>('');

  const [detalhe, setDetalhe] = useState<{ titulo: string; payload: any } | null>(null);

  const [modalComandaAberto, setModalComandaAberto] = useState(false);
  const [comandaParaAbrir, setComandaParaAbrir] = useState<CardCliente | null>(null);

  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [agendamentoParaAbrir, setAgendamentoParaAbrir] = useState<Agendamento | null>(null);
  const [abrindoAgendamento, setAbrindoAgendamento] = useState(false);

  const pointId = usuario?.pointIdGestor || '';

  useEffect(() => {
    const hoje = new Date();
    const ate = hoje.toISOString().slice(0, 10);
    const deDate = new Date(hoje);
    deDate.setDate(deDate.getDate() - 30);
    const de = deDate.toISOString().slice(0, 10);
    setDataDe(de);
    setDataAte(ate);
    setAplicadoDe(de);
    setAplicadoAte(ate);
  }, []);

  const dataInicioISO = useMemo(() => isoInicioDia(aplicadoDe), [aplicadoDe]);
  const dataFimISO = useMemo(() => isoFimDia(aplicadoAte), [aplicadoAte]);

  const validarPeriodo = () => {
    if (!dataDe || !dataAte) return 'Informe o período completo';
    if (dataDe > dataAte) return 'Data inicial não pode ser maior que a final';
    return '';
  };

  const aplicarFiltros = async () => {
    const erro = validarPeriodo();
    if (erro) {
      setErroResumo(erro);
      return;
    }
    setErroResumo('');
    setAplicadoDe(dataDe);
    setAplicadoAte(dataAte);
  };

  const limpar = () => {
    setAtletaSelecionado(null);
    setResumo(null);
    setConsumo([]);
    setPagamentos([]);
    setContaCorrente(null);
    setAgendamentos([]);
    setErroResumo('');
    setErroAba('');
    setDetalhe(null);
  };

  const carregarResumo = async (atletaId: string) => {
    if (!pointId) return;
    try {
      setLoadingResumo(true);
      setErroResumo('');
      const r = await historicoAtletaArenaService.obterResumo(pointId, atletaId, dataInicioISO, dataFimISO);
      setResumo(r);
    } catch (e: any) {
      setResumo(null);
      setErroResumo(e?.response?.data?.mensagem || 'Erro ao carregar resumo');
    } finally {
      setLoadingResumo(false);
    }
  };

  const carregarAba = async (atletaId: string, abaAtual: AbaHistoricoAtleta) => {
    if (!pointId) return;
    try {
      setLoadingAba(true);
      setErroAba('');
      if (abaAtual === 'consumo') {
        const r = await historicoAtletaArenaService.listarConsumo(pointId, atletaId, dataInicioISO, dataFimISO);
        setConsumo(r);
      } else if (abaAtual === 'pagamentos') {
        const r = await historicoAtletaArenaService.listarPagamentos(pointId, atletaId, dataInicioISO, dataFimISO);
        setPagamentos(r);
      } else if (abaAtual === 'contaCorrente') {
        const r = await historicoAtletaArenaService.obterContaCorrente(pointId, atletaId, dataInicioISO, dataFimISO);
        setContaCorrente(r);
      } else {
        const r = await historicoAtletaArenaService.listarAgendamentos(pointId, atletaId, dataInicioISO, dataFimISO);
        setAgendamentos(r);
      }
    } catch (e: any) {
      setErroAba(e?.response?.data?.mensagem || 'Erro ao carregar dados');
      if (abaAtual === 'consumo') setConsumo([]);
      if (abaAtual === 'pagamentos') setPagamentos([]);
      if (abaAtual === 'contaCorrente') setContaCorrente(null);
      if (abaAtual === 'agendamentos') setAgendamentos([]);
    } finally {
      setLoadingAba(false);
    }
  };

  const abrirComanda = async (cardId: string) => {
    setComandaParaAbrir({ id: cardId } as any);
    setModalComandaAberto(true);
  };

  const abrirAgendamento = async (agendamentoId: string) => {
    try {
      setAbrindoAgendamento(true);
      const a = await agendamentoService.obter(agendamentoId);
      setAgendamentoParaAbrir(a);
      setModalAgendamentoAberto(true);
    } catch (e: any) {
      alert(e?.response?.data?.mensagem || 'Erro ao abrir agendamento');
    } finally {
      setAbrindoAgendamento(false);
    }
  };

  useEffect(() => {
    if (!atletaSelecionado?.id) return;
    carregarResumo(atletaSelecionado.id);
    carregarAba(atletaSelecionado.id, aba);
  }, [atletaSelecionado?.id, aplicadoDe, aplicadoAte]);

  useEffect(() => {
    if (!atletaSelecionado?.id) return;
    carregarAba(atletaSelecionado.id, aba);
  }, [aba]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {aba === 'contaCorrente' ? 'Conta Corrente' : 'Histórico do Atleta'}
          </h1>
          <p className="text-gray-600 mt-1">
            {aba === 'contaCorrente' 
              ? 'Gerencie o saldo e as movimentações financeiras do atleta' 
              : 'Consumo, pagamentos, conta corrente e agendamentos na sua arena'}
          </p>
        </div>
      </div>

      <FiltrosHistoricoAtleta
        pointId={pointId}
        atletaSelecionado={atletaSelecionado}
        onSelecionarAtleta={(a) => {
          setAtletaSelecionado(a);
          setDetalhe(null);
        }}
        buscarAtletas={(q) => historicoAtletaArenaService.buscarAtletas(pointId, q)}
        dataDe={dataDe}
        setDataDe={setDataDe}
        dataAte={dataAte}
        setDataAte={setDataAte}
        onLimpar={limpar}
        onAplicar={aplicarFiltros}
      />

      {erroResumo && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erroResumo}</div>
      )}

      {atletaSelecionado && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResumoKpis resumo={resumo} loading={loadingResumo} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <HistoricoTabs aba={aba} setAba={setAba} disabled={!atletaSelecionado} />

        <div className="p-4">
          {!atletaSelecionado ? (
            <div className="text-sm text-gray-600">Selecione um atleta para visualizar os dados.</div>
          ) : erroAba ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erroAba}</div>
          ) : loadingAba ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          ) : aba === 'consumo' ? (
            <TabelaConsumo
              itens={consumo}
              onDetalhe={(i) => {
                if (i.cardId) {
                  abrirComanda(i.cardId);
                  return;
                }
                setDetalhe({ titulo: 'Detalhe do Consumo', payload: i });
              }}
            />
          ) : aba === 'pagamentos' ? (
            <TabelaPagamentos
              itens={pagamentos}
              onDetalhe={(p) => {
                if (p.cardId) {
                  abrirComanda(p.cardId);
                  return;
                }
                setDetalhe({ titulo: 'Detalhe do Pagamento', payload: p });
              }}
            />
          ) : aba === 'contaCorrente' ? (
            <TabelaContaCorrente data={contaCorrente} onDetalhe={(m) => setDetalhe({ titulo: 'Detalhe da Movimentação', payload: m })} />
          ) : (
            <TabelaAgendamentos
              itens={agendamentos}
              onDetalhe={(a) => {
                if (a.id) {
                  abrirAgendamento(a.id);
                  return;
                }
                setDetalhe({ titulo: 'Detalhe do Agendamento', payload: a });
              }}
            />
          )}
        </div>
      </div>

      <DetalheModal
        aberto={!!detalhe}
        titulo={detalhe?.titulo || ''}
        payload={detalhe?.payload}
        onClose={() => setDetalhe(null)}
      />

      {modalComandaAberto && (
        <GerenciarCardModal
          isOpen={modalComandaAberto}
          card={comandaParaAbrir}
          readOnly
          onClose={() => {
            setModalComandaAberto(false);
            setComandaParaAbrir(null);
          }}
          onSuccess={() => {}}
        />
      )}

      {modalAgendamentoAberto && (
        <EditarAgendamentoModal
          isOpen={modalAgendamentoAberto}
          agendamento={agendamentoParaAbrir}
          readOnly
          onClose={() => {
            setModalAgendamentoAberto(false);
            setAgendamentoParaAbrir(null);
          }}
          onSuccess={() => {}}
        />
      )}

      {abrindoAgendamento && null}
    </div>
  );
}

