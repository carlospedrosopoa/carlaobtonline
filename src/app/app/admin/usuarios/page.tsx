// app/app/admin/usuarios/page.tsx - Usuários admin (igual ao cursor)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { userService, type UsuarioAdmin } from '@/services/userService';
import { pointService } from '@/services/agendamentoService';
import type { Point } from '@/types/agendamento';
import { RefreshCcw, User as UserIcon, AlertCircle, Edit3, X } from 'lucide-react';

interface EditarUsuarioForm {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER' | 'ORGANIZER';
  pointIdGestor: string;
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<'' | 'ADMIN' | 'USER' | 'ORGANIZER'>('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdmin | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroEdit, setErroEdit] = useState('');
  const [formEdit, setFormEdit] = useState<EditarUsuarioForm>({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    pointIdGestor: '',
  });

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

  const abrirModalEditar = (usuario: UsuarioAdmin) => {
    setUsuarioEditando(usuario);
    setFormEdit({
      name: usuario.name,
      email: usuario.email,
      password: '',
      role: usuario.role as 'ADMIN' | 'USER' | 'ORGANIZER',
      pointIdGestor: usuario.pointIdGestor || '',
    });
    setErroEdit('');
    setModalEditarAberto(true);
  };

  const fecharModalEditar = () => {
    setModalEditarAberto(false);
    setUsuarioEditando(null);
    setFormEdit({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      pointIdGestor: '',
    });
    setErroEdit('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;

    setErroEdit('');
    setSalvando(true);

    try {
      const payload: any = {
        name: formEdit.name,
        email: formEdit.email,
        role: formEdit.role,
        pointIdGestor: formEdit.pointIdGestor || null,
      };
      
      // Só envia senha se foi preenchida
      const senhaTrimmed = formEdit.password.trim();
      if (senhaTrimmed) {
        payload.password = senhaTrimmed;
        console.log('Senha será enviada para atualização (tamanho:', senhaTrimmed.length, ')');
      } else {
        console.log('Senha não preenchida - não será atualizada');
      }

      console.log('Payload de atualização:', { ...payload, password: payload.password ? '***' : undefined });

      await userService.atualizar(usuarioEditando.id, payload);

      await carregarDados();
      fecharModalEditar();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      setErroEdit(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          error?.data?.mensagem ||
          'Erro ao atualizar usuário. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

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
                        {point ? (
                          <div className="flex items-center gap-2">
                            {point.logoUrl && (
                              <img
                                src={point.logoUrl}
                                alt={`Logo ${point.nome}`}
                                className="w-5 h-5 object-contain rounded"
                              />
                            )}
                            <span>{point.nome}</span>
                          </div>
                        ) : user.pointIdGestor ? (
                          'Arena não encontrada'
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(user)}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
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

      {/* Modal de edição */}
      {modalEditarAberto && usuarioEditando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Editar Usuário</h2>
              <button
                type="button"
                onClick={fecharModalEditar}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Atualize os dados do usuário. Deixe a senha em branco para não alterá-la.
            </p>

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={formEdit.name}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      name: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formEdit.email}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      email: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova senha (opcional)
                </label>
                <input
                  type="password"
                  value={formEdit.password}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Informe apenas se desejar alterar a senha"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Deixe em branco para manter a senha atual
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perfil (Role) *
                </label>
                <select
                  value={formEdit.role}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      role: e.target.value as 'ADMIN' | 'USER' | 'ORGANIZER',
                    }))
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ORGANIZER">ORGANIZER</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arena / Point (apenas para ORGANIZER)
                </label>
                <select
                  value={formEdit.pointIdGestor}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      pointIdGestor: e.target.value,
                    }))
                  }
                  disabled={formEdit.role !== 'ORGANIZER'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Nenhuma (ou não aplicável)</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formEdit.role === 'ORGANIZER'
                    ? 'Selecione a arena que este organizador irá gerenciar.'
                    : 'Arena só é aplicável para usuários com perfil ORGANIZER.'}
                </p>
              </div>

              {erroEdit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{erroEdit}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalEditar}
                  disabled={salvando}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
