// app/app/arena/panelinhas/page.tsx - Panelinhas dos Atletas da Arena
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Users, Trophy, Calendar, MapPin, Search, Eye, Plus } from 'lucide-react';
import Link from 'next/link';

interface Panelinha {
  id: string;
  nome: string;
  descricao?: string;
  esporte?: string;
  atletaIdCriador: string;
  criadorNome?: string;
  ehCriador: boolean;
  totalMembros: number;
  membros: Array<{
    id: string;
    nome: string;
    fotoUrl?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function PanelinhasArenaPage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [panelinhas, setPanelinhas] = useState<Panelinha[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarPanelinhas();
  }, []);

  const carregarPanelinhas = async () => {
    try {
      setLoading(true);
      setErro('');
      
      const { data } = await api.get('/user/panelinha');
      setPanelinhas(data.panelinhas || []);
    } catch (error: any) {
      console.error('Erro ao carregar panelinhas:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar panelinhas');
    } finally {
      setLoading(false);
    }
  };

  const panelinhasFiltradas = panelinhas.filter((panelinha) =>
    panelinha.nome.toLowerCase().includes(busca.toLowerCase()) ||
    panelinha.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    panelinha.esporte?.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">Panelinhas dos Atletas</h1>
          </div>
        </div>

        {erro && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {erro}
          </div>
        )}

        {/* Busca */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar panelinhas por nome, descrição ou esporte..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
          {panelinhasFiltradas.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {panelinhasFiltradas.length} panelinha{panelinhasFiltradas.length !== 1 ? 's' : ''} encontrada{panelinhasFiltradas.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Lista de Panelinhas */}
        {panelinhasFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              {busca ? 'Nenhuma panelinha encontrada com o termo buscado' : 'Nenhuma panelinha encontrada'}
            </p>
            {!busca && (
              <p className="text-sm text-gray-500">
                As panelinhas dos atletas da sua arena aparecerão aqui
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panelinhasFiltradas.map((panelinha) => (
              <Link
                key={panelinha.id}
                href={`/app/arena/panelinhas/${panelinha.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white hover:border-emerald-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">{panelinha.nome}</h3>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {panelinha.esporte && (
                        <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                          {panelinha.esporte}
                        </span>
                      )}
                      {panelinha.criadorNome && (
                        <span className="text-xs text-gray-500">
                          Criado por {panelinha.criadorNome}
                        </span>
                      )}
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                </div>

                {panelinha.descricao && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{panelinha.descricao}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{panelinha.totalMembros} membro{panelinha.totalMembros !== 1 ? 's' : ''}</span>
                  </div>
                  {panelinha.membros && panelinha.membros.length > 0 && (
                    <div className="flex -space-x-2">
                      {panelinha.membros.slice(0, 4).map((membro, idx) => (
                        <div
                          key={membro.id}
                          className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center overflow-hidden"
                          style={{ zIndex: 4 - idx }}
                          title={membro.nome}
                        >
                          {membro.fotoUrl ? (
                            <img src={membro.fotoUrl} alt={membro.nome} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-gray-600">
                              {membro.nome.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                      {panelinha.totalMembros > 4 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          +{panelinha.totalMembros - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

