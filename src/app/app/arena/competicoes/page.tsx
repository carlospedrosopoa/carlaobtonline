// app/app/arena/competicoes/page.tsx - Lista de Competições
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import { pointService } from '@/services/agendamentoService';
import type { Competicao } from '@/types/competicao';
import { Trophy, Plus, Edit, Trash2, Users, Calendar, MapPin, PlayCircle, BarChart3, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ModalAgendarQuadrasCompeticao from '@/components/ModalAgendarQuadrasCompeticao';

export default function CompeticoesPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [competicaoSelecionada, setCompeticaoSelecionada] = useState<Competicao | null>(null);

  useEffect(() => {
    carregarCompeticoes();
  }, [filtroStatus]);

  const carregarCompeticoes = async () => {
    try {
      setLoading(true);
      const pointId = usuario?.pointIdGestor || undefined;
      const competicoesData = await competicaoService.listar(pointId, filtroStatus || undefined);
      setCompeticoes(competicoesData);
    } catch (error: any) {
      console.error('Erro ao carregar competições:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao carregar competições');
    } finally {
      setLoading(false);
    }
  };

  const handleCriar = () => {
    router.push('/app/arena/competicoes/nova');
  };

  const handleEditar = (competicao: Competicao) => {
    router.push(`/app/arena/competicoes/${competicao.id}`);
  };

  const handleVerJogos = (competicao: Competicao) => {
    router.push(`/app/arena/competicoes/${competicao.id}/jogos`);
  };

  const handleVerClassificacao = (competicao: Competicao) => {
    router.push(`/app/arena/competicoes/${competicao.id}/classificacao`);
  };

  const handleAgendarQuadras = (competicao: Competicao) => {
    setCompeticaoSelecionada(competicao);
    setModalAgendamentoAberto(true);
  };

  const handleFecharModalAgendamento = () => {
    setModalAgendamentoAberto(false);
    setCompeticaoSelecionada(null);
    carregarCompeticoes(); // Recarregar para atualizar dados
  };

  const handleDeletar = async (competicao: Competicao) => {
    if (!confirm(`Tem certeza que deseja deletar a competição "${competicao.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await competicaoService.deletar(competicao.id);
      alert('Competição deletada com sucesso!');
      carregarCompeticoes();
    } catch (error: any) {
      console.error('Erro ao deletar competição:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao deletar competição');
    }
  };

  const formatarData = (data: string | null) => {
    if (!data) return '—';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      CRIADA: { label: 'Criada', className: 'bg-gray-100 text-gray-800' },
      EM_ANDAMENTO: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800' },
      CONCLUIDA: { label: 'Concluída', className: 'bg-green-100 text-green-800' },
      CANCELADA: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || statusConfig.CRIADA;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getFormatoLabel = (formato: string) => {
    return formato === 'DUPLAS' ? 'Duplas' : 'Individual';
  };

  const getTipoLabel = (tipo: string) => {
    return tipo === 'SUPER_8' ? 'Super 8' : tipo;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Competições
          </h1>
          <p className="mt-2 text-gray-600">Gerencie as competições da sua arena</p>
        </div>
        <button
          onClick={handleCriar}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Nova Competição
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filtrar por status:</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="">Todos</option>
            <option value="CRIADA">Criada</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Lista de Competições */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando competições...</p>
        </div>
      ) : competicoes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma competição encontrada</h3>
          <p className="text-gray-600 mb-6">Crie uma nova competição para começar</p>
          <button
            onClick={handleCriar}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            Criar Competição
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competicoes.map((competicao) => (
            <div
              key={competicao.id}
              className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{competicao.nome}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(competicao.status)}
                    <span className="text-xs text-gray-500">
                      {getTipoLabel(competicao.tipo)} • {getFormatoLabel(competicao.formato)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditar(competicao)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeletar(competicao)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Deletar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {competicao.point && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{competicao.point.nome}</span>
                  </div>
                )}
                {competicao.quadra && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{competicao.quadra.nome}</span>
                  </div>
                )}
                {competicao.dataInicio && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatarData(competicao.dataInicio)}</span>
                  </div>
                )}
                {competicao.atletasParticipantes && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{competicao.atletasParticipantes.length} participante{competicao.atletasParticipantes.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {competicao.valorInscricao && (
                  <div className="text-emerald-600 font-semibold">
                    Inscrição: R$ {competicao.valorInscricao.toFixed(2)}
                  </div>
                )}
              </div>

              {competicao.descricao && (
                <p className="mt-4 text-sm text-gray-700 line-clamp-2">{competicao.descricao}</p>
              )}

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => handleEditar(competicao)}
                  className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-semibold text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleAgendarQuadras(competicao)}
                  className="w-full py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <CalendarCheck className="w-4 h-4" />
                  Agendar Quadras
                </button>
                {competicao.status === 'EM_ANDAMENTO' && (
                  <>
                    <button
                      onClick={() => handleVerJogos(competicao)}
                      className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Jogos
                    </button>
                    <button
                      onClick={() => handleVerClassificacao(competicao)}
                      className="w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Classificação
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Agendamento */}
      {modalAgendamentoAberto && competicaoSelecionada && (
        <ModalAgendarQuadrasCompeticao
          isOpen={modalAgendamentoAberto}
          onClose={handleFecharModalAgendamento}
          competicaoId={competicaoSelecionada.id}
          competicaoNome={competicaoSelecionada.nome}
          onAgendamentoCriado={handleFecharModalAgendamento}
        />
      )}
    </div>
  );
}


