// app/app/arena/professores/page.tsx - Lista de Professores para Organizer
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { professorService } from '@/services/professorService';
import type { ProfessorAdmin } from '@/services/professorService';
import { GraduationCap, User, Mail, Phone, CheckCircle, XCircle } from 'lucide-react';

export default function ArenaProfessoresPage() {
  const [professores, setProfessores] = useState<ProfessorAdmin[]>([]);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetchProfessores();
  }, []);

  const fetchProfessores = async () => {
    try {
      setCarregando(true);
      // A API agora permite ORGANIZER listar professores da sua arena
      const data = await api.get('/professor');
      const professoresArray = Array.isArray(data.data) ? data.data : [];
      // Ordenar alfabeticamente por nome do usuário ou especialidade
      professoresArray.sort((a: ProfessorAdmin, b: ProfessorAdmin) => {
        const nomeA = a.usuario?.name || a.especialidade || '';
        const nomeB = b.usuario?.name || b.especialidade || '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
      setProfessores(professoresArray);
    } catch (err: any) {
      console.error('Erro ao buscar professores:', err);
    } finally {
      setCarregando(false);
    }
  };

  const professoresFiltrados = professores.filter((professor) => {
    // Filtro por texto (busca em nome, email, especialidade)
    if (filtroTexto) {
      const textoLower = filtroTexto.toLowerCase();
      const nome = professor.usuario?.name?.toLowerCase() || '';
      const email = professor.usuario?.email?.toLowerCase() || '';
      const especialidade = professor.especialidade?.toLowerCase() || '';
      const telefone = professor.telefoneProfissional?.toLowerCase() || '';
      
      if (
        !nome.includes(textoLower) &&
        !email.includes(textoLower) &&
        !especialidade.includes(textoLower) &&
        !telefone.includes(textoLower)
      ) {
        return false;
      }
    }

    // Filtro por status ativo
    if (filtroAtivo === 'ativo' && !professor.ativo) {
      return false;
    }
    if (filtroAtivo === 'inativo' && professor.ativo) {
      return false;
    }

    return true;
  });

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Professores</h1>
          <p className="text-gray-600">Lista de professores que atuam na sua arena</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Nome, email, especialidade ou telefone..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Status
            </label>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Professores */}
      {carregando ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-gray-500">Carregando professores...</p>
        </div>
      ) : professoresFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {professores.length === 0
              ? 'Nenhum professor encontrado na sua arena.'
              : 'Nenhum professor encontrado com os filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professoresFiltrados.map((professor) => (
            <div
              key={professor.id}
              className={`bg-white rounded-lg shadow-sm p-4 border-2 ${
                professor.ativo
                  ? 'border-gray-200 hover:border-blue-300'
                  : 'border-gray-300 bg-gray-50 opacity-75'
              } transition-colors`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  {professor.fotoUrl ? (
                    <img
                      src={professor.fotoUrl}
                      alt={professor.usuario?.name || professor.especialidade || 'Professor'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
                      {professor.usuario?.name?.charAt(0).toUpperCase() || 
                       professor.especialidade?.charAt(0).toUpperCase() || 
                       'P'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {professor.usuario?.name || 'Sem nome'}
                    </h3>
                    {professor.especialidade && (
                      <p className="text-sm text-gray-600 truncate">
                        {professor.especialidade}
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-2" title={professor.ativo ? "Ativo" : "Inativo"}>
                  {professor.ativo ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {professor.usuario?.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{professor.usuario.email}</span>
                  </div>
                )}
                {professor.telefoneProfissional && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{professor.telefoneProfissional}</span>
                  </div>
                )}
                {professor.valorHora && (
                  <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <span className="text-gray-500">Valor/hora:</span>
                    <span>{formatCurrency(professor.valorHora)}</span>
                  </div>
                )}
                {professor.aceitaNovosAlunos && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle className="w-3 h-3" />
                    Aceita novos alunos
                  </div>
                )}
              </div>

              {professor.arenasFrequentes && professor.arenasFrequentes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Arenas que atua:</p>
                  <div className="flex flex-wrap gap-1">
                    {professor.arenasFrequentes.slice(0, 3).map((arena) => (
                      <span
                        key={arena.id}
                        className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {arena.nome}
                      </span>
                    ))}
                    {professor.arenasFrequentes.length > 3 && (
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        +{professor.arenasFrequentes.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


