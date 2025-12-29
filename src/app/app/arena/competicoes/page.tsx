// app/app/arena/competicoes/page.tsx - Lista de Competições
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { competicaoService } from '@/services/competicaoService';
import { pointService } from '@/services/agendamentoService';
import type { Competicao } from '@/types/competicao';
import { Trophy, Plus, Edit, Trash2, Users, Calendar, MapPin, PlayCircle, BarChart3, CalendarCheck, Image } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ModalAgendarQuadrasCompeticao from '@/components/ModalAgendarQuadrasCompeticao';
import { api } from '@/lib/api';
import { useMemo, useEffect } from 'react';

export default function CompeticoesPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [competicaoSelecionada, setCompeticaoSelecionada] = useState<Competicao | null>(null);
  const [showCardId, setShowCardId] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

  // Limpa o blob URL quando o componente desmonta ou o card fecha
  useEffect(() => {
    return () => {
      if (cardImageUrl) {
        URL.revokeObjectURL(cardImageUrl);
      }
    };
  }, [cardImageUrl]);

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

  const handleVerCard = async (competicao: Competicao) => {
    if (!competicao.cardDivulgacaoUrl) {
      alert('Esta competição não possui card de divulgação cadastrado.');
      return;
    }

    setShowCardId(competicao.id);
    setCardLoading(true);
    setCardError(false);
    setCardImageUrl(null);

    try {
      const response = await api.get(`/card/competicao/${competicao.id}?refresh=true`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(blob);
      setCardImageUrl(imageUrl);
      setCardLoading(false);
    } catch (error: any) {
      console.error('Erro ao carregar card:', error);
      setCardError(true);
      setCardLoading(false);
    }
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
                {competicao.cardDivulgacaoUrl && (
                  <button
                    onClick={() => handleVerCard(competicao)}
                    className="w-full py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <Image className="w-4 h-4" />
                    Ver Card
                  </button>
                )}
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

      {/* Modal do Card */}
      {showCardId && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCardId(null);
              setCardError(false);
              setCardLoading(false);
              if (cardImageUrl) {
                URL.revokeObjectURL(cardImageUrl);
                setCardImageUrl(null);
              }
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 relative max-w-[95vw] max-h-[95vh] overflow-auto animate-in zoom-in-95 duration-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all z-10"
              onClick={() => {
                setShowCardId(null);
                setCardError(false);
                setCardLoading(false);
                if (cardImageUrl) {
                  URL.revokeObjectURL(cardImageUrl);
                  setCardImageUrl(null);
                }
              }}
              aria-label="Fechar"
            >
              ×
            </button>
            
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Card da Competição</h3>
                  <p className="text-sm text-gray-500">Compartilhe nas redes sociais</p>
                </div>
              </div>
              
              <div className="relative min-h-[400px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-200">
                {cardLoading && !cardError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                    <div className="text-center">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <p className="text-gray-700 font-medium">Gerando card...</p>
                      <p className="text-sm text-gray-500 mt-1">Aguarde um momento</p>
                    </div>
                  </div>
                )}
                {cardImageUrl && (
                  <img
                    src={cardImageUrl}
                    alt="Card da Competição"
                    className="max-w-full max-h-[65vh] rounded-xl shadow-2xl mx-auto border-4 border-white opacity-100 scale-100 transition-all duration-300"
                    onLoad={() => {
                      setCardLoading(false);
                      setCardError(false);
                    }}
                    onError={(e) => {
                      setCardLoading(false);
                      setCardError(true);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                {cardError && (
                  <div className="text-center py-12 w-full">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                      <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-800 font-semibold text-lg mb-2">Erro ao carregar o card</p>
                    <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                      O backend pode estar tendo problemas para gerar o card. Verifique se a competição possui card de divulgação e atletas cadastrados.
                    </p>
                    <button
                      onClick={async () => {
                        if (!showCardId) return;
                        setCardError(false);
                        setCardLoading(true);
                        setCardImageUrl(null);
                        
                        try {
                          const response = await api.get(`/card/competicao/${showCardId}?refresh=true`, {
                            responseType: 'blob',
                          });
                          const blob = new Blob([response.data], { type: 'image/png' });
                          const imageUrl = URL.createObjectURL(blob);
                          setCardImageUrl(imageUrl);
                          setCardLoading(false);
                        } catch (error: any) {
                          console.error('Erro ao carregar card:', error);
                          setCardError(true);
                          setCardLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
              
              {cardImageUrl && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <a
                    href={cardImageUrl}
                    download={`card_competicao_${showCardId}.png`}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Baixar Card
                  </a>
                  <button
                    onClick={() => {
                      if (cardImageUrl) {
                        const link = document.createElement('a');
                        link.href = cardImageUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.click();
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir em Nova Aba
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


