// app/app/admin/organizers/page.tsx - Gestores de arena (igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import { pointService } from '@/services/agendamentoService';
import type { Point } from '@/types/agendamento';
import { api } from '@/lib/api';
import { userService } from '@/services/userService';
import { AlertCircle, Plus, RefreshCcw, Edit3 } from 'lucide-react';

interface Usuario {
  id: string | number;
  name: string;
  email: string;
  role: string;
  pointIdGestor?: string | null;
  createdAt?: string;
}

interface NovoOrganizadorForm {
  name: string;
  email: string;
  password: string;
  pointIdGestor: string;
}

interface EditarOrganizadorForm {
  name: string;
  email: string;
  password: string;
  pointIdGestor: string;
}

export default function AdminOrganizersPage() {
  const [organizadores, setOrganizadores] = useState<Usuario[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [erroEdit, setErroEdit] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [organizadorEditando, setOrganizadorEditando] = useState<Usuario | null>(null);

  const [form, setForm] = useState<NovoOrganizadorForm>({
    name: '',
    email: '',
    password: '',
    pointIdGestor: '',
  });

  const [formEdit, setFormEdit] = useState<EditarOrganizadorForm>({
    name: '',
    email: '',
    password: '',
    pointIdGestor: '',
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErroLista('');

      const [pointsData, usersData] = await Promise.all([
        pointService.listar(),
        userService.listar(),
      ]);

      setPoints(pointsData);
      const orgs = (usersData || []).filter((u) => u.role === 'ORGANIZER');
      setOrganizadores(orgs);
    } catch (error: any) {
      console.error('Erro ao carregar organizadores:', error);
      setErroLista(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao carregar organizadores'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm('');

    if (!form.pointIdGestor) {
      setErroForm('Selecione a arena (Point) para o gestor.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: 'ORGANIZER',
        pointIdGestor: form.pointIdGestor,
      });

      setForm({
        name: '',
        email: '',
        password: '',
        pointIdGestor: '',
      });

      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao criar organizador:', error);
      setErroForm(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao criar organizador. Verifique os dados e tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalEditar = (user: Usuario) => {
    setOrganizadorEditando(user);
    setFormEdit({
      name: user.name,
      email: user.email,
      password: '',
      pointIdGestor: user.pointIdGestor || '',
    });
    setErroEdit('');
    setModalEditarAberto(true);
  };

  const fecharModalEditar = () => {
    setModalEditarAberto(false);
    setOrganizadorEditando(null);
    setErroEdit('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizadorEditando) return;

    setErroEdit('');
    setSalvando(true);

    try {
      const payload: any = {
        name: formEdit.name,
        email: formEdit.email,
        role: 'ORGANIZER',
        pointIdGestor: formEdit.pointIdGestor || null,
      };
      if (formEdit.password.trim()) {
        payload.password = formEdit.password.trim();
      }

      await userService.atualizarGestor(organizadorEditando.id, payload);

      await carregarDados();
      fecharModalEditar();
    } catch (error: any) {
      console.error('Erro ao atualizar organizador:', error);
      setErroEdit(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao atualizar organizador. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gestores de Arena</h1>
          <p className="text-gray-600">
            Cadastre e gerencie usuários com perfil <span className="font-semibold">ORGANIZER</span>.
          </p>
        </div>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Formulário novo organizer */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-purple-600" />
          Novo Gestor de Arena
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome completo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder="Nome do gestor"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha inicial *
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder="Senha temporária"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Arena / Point *</label>
            <select
              value={form.pointIdGestor}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pointIdGestor: e.target.value,
                }))
              }
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione uma arena</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              O gestor terá acesso apenas aos recursos vinculados a esta arena (point).
            </p>
          </div>

          {erroForm && (
            <div className="sm:col-span-2">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{erroForm}</span>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? 'Criando...' : 'Criar Gestor'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de organizadores */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Organizadores cadastrados</h2>

        {erroLista && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{erroLista}</span>
          </div>
        )}

        {organizadores.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum gestor de arena cadastrado até o momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizadores.map((user) => {
              const point = points.find((p) => p.id === user.pointIdGestor);
              return (
                <div
                  key={user.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{user.name}</h3>
                    <button
                      type="button"
                      onClick={() => abrirModalEditar(user)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100"
                      title="Editar gestor"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{user.email}</p>
                  {point && (
                    <div className="flex items-center gap-2 mb-1">
                      {point.logoUrl && (
                        <img
                          src={point.logoUrl}
                          alt={`Logo ${point.nome}`}
                          className="w-6 h-6 object-contain rounded"
                        />
                      )}
                      <p className="text-xs text-gray-600">
                        Arena: <span className="font-medium">{point.nome}</span>
                      </p>
                    </div>
                  )}
                  {!point && user.pointIdGestor && (
                    <p className="text-xs text-gray-600 mb-1">
                      Arena: <span className="font-medium">Arena não encontrada</span>
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    Criado em:{' '}
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {modalEditarAberto && organizadorEditando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Editar Gestor de Arena</h2>
            <p className="text-sm text-gray-600 mb-4">
              Ajuste os dados do gestor e a arena vinculada.
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arena / Point *
                </label>
                <select
                  value={formEdit.pointIdGestor}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      pointIdGestor: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="">Selecione uma arena</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Essa associação define quais quadras e agendamentos este gestor poderá
                  administrar.
                </p>
              </div>

              {erroEdit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{erroEdit}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalEditar}
                  disabled={salvando}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
