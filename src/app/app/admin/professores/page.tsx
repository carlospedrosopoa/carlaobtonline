// app/app/admin/professores/page.tsx - Gerenciamento de professores
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { userService } from '@/services/userService';
import { professorService, type ProfessorAdmin, type CriarProfessorPayload, type AtualizarProfessorPayload } from '@/services/professorService';
import { AlertCircle, Plus, RefreshCcw, Edit3, Trash2, User } from 'lucide-react';

interface Usuario {
  id: string | number;
  name: string;
  email: string;
  role: string;
}

interface NovoProfessorForm {
  userId: string;
  especialidade: string;
  bio: string;
  valorHora: string;
  telefoneProfissional: string;
  emailProfissional: string;
  ativo: boolean;
  aceitaNovosAlunos: boolean;
}

interface EditarProfessorForm {
  especialidade: string;
  bio: string;
  valorHora: string;
  telefoneProfissional: string;
  emailProfissional: string;
  ativo: boolean;
  aceitaNovosAlunos: boolean;
}

export default function AdminProfessoresPage() {
  const [professores, setProfessores] = useState<ProfessorAdmin[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [erroEdit, setErroEdit] = useState('');
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalDeletarAberto, setModalDeletarAberto] = useState(false);
  const [professorEditando, setProfessorEditando] = useState<ProfessorAdmin | null>(null);
  const [professorDeletando, setProfessorDeletando] = useState<ProfessorAdmin | null>(null);

  const [form, setForm] = useState<NovoProfessorForm>({
    userId: '',
    especialidade: '',
    bio: '',
    valorHora: '',
    telefoneProfissional: '',
    emailProfissional: '',
    ativo: true,
    aceitaNovosAlunos: true,
  });

  const [formEdit, setFormEdit] = useState<EditarProfessorForm>({
    especialidade: '',
    bio: '',
    valorHora: '',
    telefoneProfissional: '',
    emailProfissional: '',
    ativo: true,
    aceitaNovosAlunos: true,
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErroLista('');

      const [professoresData, usuariosData] = await Promise.all([
        professorService.listar(),
        userService.listar(),
      ]);

      setProfessores(professoresData || []);
      // Filtrar apenas usuários que podem ser professores (USER ou já são PROFESSOR)
      const usuariosDisponiveis = (usuariosData || []).filter(
        (u) => u.role === 'PROFESSOR' || u.role === 'USER'
      );
      setUsuarios(usuariosDisponiveis);
    } catch (error: any) {
      console.error('Erro ao carregar professores:', error);
      setErroLista(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao carregar professores'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm('');

    if (!form.userId) {
      setErroForm('Selecione o usuário para criar o perfil de professor.');
      return;
    }

    setSalvando(true);
    try {
      const payload: CriarProfessorPayload = {
        userId: form.userId,
        especialidade: form.especialidade.trim() || null,
        bio: form.bio.trim() || null,
        valorHora: form.valorHora ? parseFloat(form.valorHora) : null,
        telefoneProfissional: form.telefoneProfissional.trim() || null,
        emailProfissional: form.emailProfissional.trim() || null,
        ativo: form.ativo,
        aceitaNovosAlunos: form.aceitaNovosAlunos,
      };

      await professorService.criar(payload);

      setForm({
        userId: '',
        especialidade: '',
        bio: '',
        valorHora: '',
        telefoneProfissional: '',
        emailProfissional: '',
        ativo: true,
        aceitaNovosAlunos: true,
      });

      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao criar professor:', error);
      setErroForm(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao criar professor. Verifique os dados e tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalEditar = (professor: ProfessorAdmin) => {
    setProfessorEditando(professor);
    setFormEdit({
      especialidade: professor.especialidade || '',
      bio: professor.bio || '',
      valorHora: professor.valorHora ? String(professor.valorHora) : '',
      telefoneProfissional: professor.telefoneProfissional || '',
      emailProfissional: professor.emailProfissional || '',
      ativo: professor.ativo,
      aceitaNovosAlunos: professor.aceitaNovosAlunos,
    });
    setErroEdit('');
    setModalEditarAberto(true);
  };

  const fecharModalEditar = () => {
    setModalEditarAberto(false);
    setProfessorEditando(null);
    setErroEdit('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorEditando) return;

    setErroEdit('');
    setSalvando(true);

    try {
      const payload: AtualizarProfessorPayload = {
        especialidade: formEdit.especialidade.trim() || null,
        bio: formEdit.bio.trim() || null,
        valorHora: formEdit.valorHora ? parseFloat(formEdit.valorHora) : null,
        telefoneProfissional: formEdit.telefoneProfissional.trim() || null,
        emailProfissional: formEdit.emailProfissional.trim() || null,
        ativo: formEdit.ativo,
        aceitaNovosAlunos: formEdit.aceitaNovosAlunos,
      };

      await professorService.atualizar(professorEditando.id, payload);

      await carregarDados();
      fecharModalEditar();
    } catch (error: any) {
      console.error('Erro ao atualizar professor:', error);
      setErroEdit(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao atualizar professor. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalDeletar = (professor: ProfessorAdmin) => {
    setProfessorDeletando(professor);
    setModalDeletarAberto(true);
  };

  const fecharModalDeletar = () => {
    setModalDeletarAberto(false);
    setProfessorDeletando(null);
  };

  const handleDeletar = async () => {
    if (!professorDeletando) return;

    setSalvando(true);
    try {
      await professorService.deletar(professorDeletando.id);
      await carregarDados();
      fecharModalDeletar();
    } catch (error: any) {
      console.error('Erro ao deletar professor:', error);
      alert(
        error?.response?.data?.mensagem ||
          error?.response?.data?.error ||
          'Erro ao deletar professor. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const formatCurrency = (value: number | null) => {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Professores</h1>
          <p className="text-gray-600">
            Cadastre e gerencie perfis de <span className="font-semibold">PROFESSOR</span>.
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

      {/* Formulário novo professor */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-600" />
          Novo Professor
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário * <span className="text-xs text-gray-500">(Selecione o usuário que será o professor)</span>
            </label>
            <select
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione um usuário</option>
              {usuarios
                .filter((u) => !professores.some((p) => p.userId === u.id))
                .map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Apenas usuários sem perfil de professor são exibidos. O usuário precisa ter role USER ou PROFESSOR.
            </p>
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Especialidade (opcional)
            </label>
            <input
              type="text"
              value={form.especialidade}
              onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Ex: Tênis, Futebol, etc."
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor por Hora (opcional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valorHora}
              onChange={(e) => setForm((f) => ({ ...f, valorHora: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="150.00"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio (opcional)
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Breve descrição sobre o professor..."
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefone Profissional (opcional)
            </label>
            <input
              type="text"
              value={form.telefoneProfissional}
              onChange={(e) => {
                const apenasNumeros = e.target.value.replace(/\D/g, '');
                let formatted = apenasNumeros;
                if (apenasNumeros.length > 0) {
                  formatted = `(${apenasNumeros.slice(0, 2)}`;
                  if (apenasNumeros.length > 2) {
                    formatted += `) ${apenasNumeros.slice(2, 7)}`;
                  }
                  if (apenasNumeros.length > 7) {
                    formatted += `-${apenasNumeros.slice(7, 11)}`;
                  }
                }
                setForm((f) => ({ ...f, telefoneProfissional: formatted }));
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Profissional (opcional)
            </label>
            <input
              type="email"
              value={form.emailProfissional}
              onChange={(e) => setForm((f) => ({ ...f, emailProfissional: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="professor@email.com"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Ativo</span>
            </label>
          </div>

          <div className="sm:col-span-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.aceitaNovosAlunos}
                onChange={(e) => setForm((f) => ({ ...f, aceitaNovosAlunos: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Aceita Novos Alunos</span>
            </label>
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? 'Criando...' : 'Criar Professor'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de professores */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Professores cadastrados</h2>

        {erroLista && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{erroLista}</span>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : professores.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum professor cadastrado até o momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {professores.map((professor) => {
              const usuario = usuarios.find((u) => u.id === professor.userId);
              return (
                <div
                  key={professor.id}
                  className={`border rounded-lg p-4 ${
                    professor.ativo
                      ? 'border-gray-200 bg-gray-50/50'
                      : 'border-gray-300 bg-gray-100/50 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {usuario?.name || professor.usuario?.name || 'Usuário não encontrado'}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {usuario?.email || professor.usuario?.email || '—'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(professor)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                        title="Editar professor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirModalDeletar(professor)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-700 hover:bg-red-100"
                        title="Deletar professor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {professor.especialidade && (
                    <p className="text-xs text-gray-700 mb-1">
                      <span className="font-medium">Especialidade:</span> {professor.especialidade}
                    </p>
                  )}

                  {professor.valorHora && (
                    <p className="text-xs text-gray-700 mb-1">
                      <span className="font-medium">Valor/Hora:</span> {formatCurrency(professor.valorHora)}
                    </p>
                  )}

                  {professor.telefoneProfissional && (
                    <p className="text-xs text-gray-600 mb-1">
                      📱 {professor.telefoneProfissional}
                    </p>
                  )}

                  {professor.emailProfissional && (
                    <p className="text-xs text-gray-600 mb-1">
                      ✉️ {professor.emailProfissional}
                    </p>
                  )}

                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        professor.ativo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {professor.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        professor.aceitaNovosAlunos
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {professor.aceitaNovosAlunos ? 'Aceita Alunos' : 'Não aceita'}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-2">
                    Criado em:{' '}
                    {professor.createdAt
                      ? new Date(professor.createdAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {modalEditarAberto && professorEditando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Editar Professor</h2>
            <p className="text-sm text-gray-600 mb-4">
              Ajuste os dados do professor.
            </p>

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Especialidade (opcional)
                </label>
                <input
                  type="text"
                  value={formEdit.especialidade}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      especialidade: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor por Hora (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formEdit.valorHora}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      valorHora: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio (opcional)
                </label>
                <textarea
                  value={formEdit.bio}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      bio: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone Profissional (opcional)
                </label>
                <input
                  type="text"
                  value={formEdit.telefoneProfissional}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    let formatted = apenasNumeros;
                    if (apenasNumeros.length > 0) {
                      formatted = `(${apenasNumeros.slice(0, 2)}`;
                      if (apenasNumeros.length > 2) {
                        formatted += `) ${apenasNumeros.slice(2, 7)}`;
                      }
                      if (apenasNumeros.length > 7) {
                        formatted += `-${apenasNumeros.slice(7, 11)}`;
                      }
                    }
                    setFormEdit((f) => ({ ...f, telefoneProfissional: formatted }));
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Profissional (opcional)
                </label>
                <input
                  type="email"
                  value={formEdit.emailProfissional}
                  onChange={(e) =>
                    setFormEdit((f) => ({
                      ...f,
                      emailProfissional: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEdit.ativo}
                    onChange={(e) =>
                      setFormEdit((f) => ({
                        ...f,
                        ativo: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEdit.aceitaNovosAlunos}
                    onChange={(e) =>
                      setFormEdit((f) => ({
                        ...f,
                        aceitaNovosAlunos: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Aceita Novos Alunos</span>
                </label>
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
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmação de deleção */}
      {modalDeletarAberto && professorDeletando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Exclusão</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tem certeza que deseja deletar o perfil de professor de{' '}
              <span className="font-semibold">
                {usuarios.find((u) => u.id === professorDeletando.userId)?.name ||
                  professorDeletando.usuario?.name ||
                  'este professor'}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Esta ação não pode ser desfeita. O usuário ainda existirá, mas perderá o perfil de professor.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={fecharModalDeletar}
                disabled={salvando}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletar}
                disabled={salvando}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? 'Deletando...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

