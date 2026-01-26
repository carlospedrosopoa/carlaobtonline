'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  historicoAtletaArenaService,
  AtletaHistoricoArena,
  HistoricoAtletaContaCorrente
} from '@/services/gestaoArenaService';
import FiltrosHistoricoAtleta from '@/components/historico-atleta/FiltrosHistoricoAtleta';
import TabelaContaCorrente from '@/components/historico-atleta/TabelaContaCorrente';
import { Wallet, PlusCircle, MinusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import InputMonetario from '@/components/InputMonetario';
import { Dialog } from '@headlessui/react';

export default function ContaCorrentePage() {
  const { usuario } = useAuth();
  const pointId = usuario?.pointIdGestor;

  // Estados de Filtro e Seleção
  const [atletaSelecionado, setAtletaSelecionado] = useState<AtletaHistoricoArena | null>(null);
  const [dataDe, setDataDe] = useState<string>('');
  const [dataAte, setDataAte] = useState<string>('');

  // Dados
  const [contaCorrente, setContaCorrente] = useState<HistoricoAtletaContaCorrente | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Modal de Lançamento
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
  const [valorLancamento, setValorLancamento] = useState(0);
  const [justificativaLancamento, setJustificativaLancamento] = useState('');
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  // Inicializar datas (últimos 30 dias por padrão)
  useEffect(() => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    setDataAte(hoje.toISOString().split('T')[0]);
    setDataDe(trintaDiasAtras.toISOString().split('T')[0]);
  }, []);

  const buscarAtletas = async (termo: string) => {
    if (!pointId) return [];
    return historicoAtletaArenaService.buscarAtletas(pointId, termo);
  };

  const carregarDados = async () => {
    if (!pointId || !atletaSelecionado) return;

    try {
      setCarregando(true);
      setErro('');
      
      const dados = await historicoAtletaArenaService.obterContaCorrente(
        pointId,
        atletaSelecionado.id,
        dataDe ? `${dataDe}T00:00:00` : undefined,
        dataAte ? `${dataAte}T23:59:59` : undefined
      );
      
      setContaCorrente(dados);
    } catch (err: any) {
      console.error('Erro ao carregar conta corrente:', err);
      setErro('Não foi possível carregar os dados da conta corrente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointId || !atletaSelecionado) return;

    if (valorLancamento <= 0) {
      alert('O valor deve ser maior que zero.');
      return;
    }

    if (!justificativaLancamento.trim()) {
      alert('A justificativa é obrigatória.');
      return;
    }

    try {
      setSalvandoLancamento(true);
      
      await historicoAtletaArenaService.lancarMovimentacao(pointId, atletaSelecionado.id, {
        tipo: tipoLancamento,
        valor: valorLancamento,
        justificativa: justificativaLancamento
      });

      alert('Lançamento realizado com sucesso!');
      setModalLancamentoAberto(false);
      setValorLancamento(0);
      setJustificativaLancamento('');
      
      // Recarregar dados
      carregarDados();
    } catch (err: any) {
      console.error('Erro ao realizar lançamento:', err);
      alert('Erro ao realizar lançamento: ' + (err.response?.data?.mensagem || err.message));
    } finally {
      setSalvandoLancamento(false);
    }
  };

  const abrirModal = (tipo: 'CREDITO' | 'DEBITO') => {
    setTipoLancamento(tipo);
    setValorLancamento(0);
    setJustificativaLancamento('');
    setModalLancamentoAberto(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conta Corrente</h1>
        <p className="text-gray-500">Gerencie o saldo e lançamentos dos atletas.</p>
      </div>

      <FiltrosHistoricoAtleta
        pointId={pointId || ''}
        atletaSelecionado={atletaSelecionado}
        onSelecionarAtleta={(atleta) => {
          setAtletaSelecionado(atleta);
          // Limpa dados anteriores ao trocar de atleta
          setContaCorrente(null); 
        }}
        buscarAtletas={buscarAtletas}
        dataDe={dataDe}
        setDataDe={setDataDe}
        dataAte={dataAte}
        setDataAte={setDataAte}
        onLimpar={() => {
          setAtletaSelecionado(null);
          setContaCorrente(null);
        }}
        onAplicar={carregarDados}
      />

      {erro && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {!atletaSelecionado && !carregando && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Nenhum atleta selecionado</h3>
          <p className="text-gray-500">Pesquise e selecione um atleta acima para visualizar sua conta corrente.</p>
        </div>
      )}

      {atletaSelecionado && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Card de Saldo e Ações */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-1">Saldo Atual</h2>
                <div className={`text-4xl font-bold ${
                  (contaCorrente?.saldo || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contaCorrente?.saldo || 0)}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Atleta: <span className="font-medium text-gray-700">{atletaSelecionado.nome}</span>
                </p>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => abrirModal('CREDITO')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
                >
                  <PlusCircle className="w-5 h-5" />
                  Adicionar Crédito
                </button>
                <button
                  onClick={() => abrirModal('DEBITO')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm font-medium"
                >
                  <MinusCircle className="w-5 h-5" />
                  Lançar Débito
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Movimentações */}
          {carregando ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : contaCorrente ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Histórico de Movimentações</h3>
              </div>
              <TabelaContaCorrente 
                data={contaCorrente} 
                onDetalhe={() => {}} // Não precisamos de detalhes por enquanto
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Modal de Lançamento */}
      <Dialog 
        open={modalLancamentoAberto} 
        onClose={() => !salvandoLancamento && setModalLancamentoAberto(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              {tipoLancamento === 'CREDITO' ? (
                <PlusCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <MinusCircle className="w-6 h-6 text-red-600" />
              )}
              {tipoLancamento === 'CREDITO' ? 'Adicionar Crédito' : 'Lançar Débito'}
            </Dialog.Title>

            <form onSubmit={handleLancamento} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor
                </label>
                <InputMonetario
                  value={valorLancamento}
                  onChange={setValorLancamento}
                  className={`text-xl font-bold ${
                    tipoLancamento === 'CREDITO' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Justificativa
                </label>
                <textarea
                  value={justificativaLancamento}
                  onChange={(e) => setJustificativaLancamento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[100px]"
                  placeholder="Descreva o motivo do lançamento..."
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setModalLancamentoAberto(false)}
                  disabled={salvandoLancamento}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoLancamento}
                  className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${
                    tipoLancamento === 'CREDITO' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {salvandoLancamento ? 'Salvando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
