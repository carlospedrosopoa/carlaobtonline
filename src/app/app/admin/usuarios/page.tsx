// app/app/admin/usuarios/page.tsx - Usuários admin (igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { userService } from '@/services/userService';
import { pointService } from '@/services/agendamentoService';
import type { Point } from '@/types/agendamento';
import { RefreshCcw, User as UserIcon } from 'lucide-react';

type UsuarioAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
  pointIdGestor?: string | null;
  createdAt?: string;
};

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<'' | 'ADMIN' | 'USER' | 'ORGANIZER'>('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro('');
      const [users, pointsData] = await Promise.all([
        userService.listar(),
        pointService.listar(),
      ]);
      setUsuarios(users);
      setPoints(pointsData);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      setErro(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao carregar usuários'
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter((user) => {
        const nomeMatch =
          user.name.toLowerCase().includes(busca.toLowerCase()) ||
          user.email.toLowerCase().includes(busca.toLowerCase());
        const roleMatch = filtroRole ? user.role === filtroRole : true;
        return nomeMatch && roleMatch;
      }),
    [usuarios, busca, filtroRole]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Usuários</h1>
          <p className="text-sm text-gray-600">
            Gerencie perfis, permissões e vínculo de arena (gestores).
          </p>
        </div>
        <button
          onClick={carregarDados}
          disabled={carregando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Buscar por nome ou email
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite parte do nome ou email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filtrar por perfil
            </label>
            <select
              value={filtroRole}
              onChange={(e) => setFiltroRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              <option value="">Todos</option>
              <option value="ADMIN">ADMIN</option>
              <option value="ORGANIZER">ORGANIZER</option>
              <option value="USER">USER</option>
            </select>
          </div>
        </div>

        {erro && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {erro}
          </div>
        )}

        {usuariosFiltrados.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">
            Nenhum usuário encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Usuário
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Perfil
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Arena (Point)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Criado em
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((user) => {
                  const point = user.pointIdGestor
                    ? points.find((p) => p.id === user.pointIdGestor)
                    : undefined;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-2 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-600">
                            <UserIcon className="w-4 h-4" />
                          </span>
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold uppercase">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {point ? point.nome : user.pointIdGestor ? 'Arena não encontrada' : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            // Modal será implementado quando necessário
                            alert('Funcionalidade de edição será implementada em breve');
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
