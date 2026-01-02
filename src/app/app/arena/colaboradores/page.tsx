// app/app/arena/colaboradores/page.tsx - Gestão de Colaboradores
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { colaboradorService, type Colaborador, type CriarColaboradorPayload, type AtualizarColaboradorPayload } from '@/services/gestaoArenaService';
import { Users, Plus, Edit, Trash2, X, Save } from 'lucide-react';

export default function ColaboradoresPage() {
  const { usuario } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarColaboradores();
    }
  }, [usuario?.pointIdGestor]);

  const carregarColaboradores = async () => {
    if (!usuario?.pointIdGestor) return;
    
    try {
      setLoading(true);
      const dados = await colaboradorService.listar(usuario.pointIdGestor);
      setColaboradores(dados);
    } catch (error: any) {
      console.error('Erro ao carregar colaboradores:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setColaboradorEditando(null);
    setForm({ name: '', email: '', password: '' });
    setErro('');
    setModalAberto(true);
  };

  const abrirModalEditar = (colaborador: Colaborador) => {
    setColaboradorEditando(colaborador);
    setForm({ 
      name: colaborador.name, 
      email: colaborador.email, 
      password: '' // Senha sempre vazia ao editar
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setColaboradorEditando(null);
    setForm({ name: '', email: '', password: '' });
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario?.pointIdGestor) return;

    setSalvando(true);
    setErro('');

    try {
      if (colaboradorEditando) {
        // Atualizar
        const payload: AtualizarColaboradorPayload = {
          name: form.name,
          email: form.email,
        };
        
        // Só incluir senha se foi preenchida
        if (form.password.trim()) {
          payload.password = form.password;
        }

        await colaboradorService.atualizar(colaboradorEditando.id, payload);
        alert('Colaborador atualizado com sucesso!');
      } else {
        // Criar
        if (!form.password.trim()) {
          setErro('Senha é obrigatória para novos colaboradores');
          setSalvando(false);
          return;
        }

        const payload: CriarColaboradorPayload = {
          name: form.name,
          email: form.email,
          password: form.password,
          pointId: usuario.pointIdGestor,
        };

        await colaboradorService.criar(payload);
        alert('Colaborador criado com sucesso!');
      }

      fecharModal();
      carregarColaboradores();
    } catch (error: any) {
      console.error('Erro ao salvar colaborador:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar colaborador');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (colaborador: Colaborador) => {
    if (!confirm(`Tem certeza que deseja remover o colaborador "${colaborador.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await colaboradorService.remover(colaborador.id);
      alert('Colaborador removido com sucesso!');
      carregarColaboradores();
    } catch (error: any) {
      console.error('Erro ao remover colaborador:', error);
      alert(error?.response?.data?.mensagem || 'Erro ao remover colaborador');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            Colaboradores
          </h1>
          <p className="text-gray-600 mt-2">
            Gerencie os colaboradores da sua arena. Colaboradores têm acesso à arena mas não podem criar outros colaboradores.
          </p>
        </div>
        <button
          onClick={abrirModalNovo}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Colaborador
        </button>
      </div>

      {colaboradores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Nenhum colaborador cadastrado.</p>
          <button
            onClick={abrirModalNovo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Criar Primeiro Colaborador
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gestor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {colaboradores.map((colaborador) => (
                <tr key={colaborador.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{colaborador.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{colaborador.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {colaborador.gestor ? colaborador.gestor.name : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(colaborador.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirModalEditar(colaborador)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Editar colaborador"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemover(colaborador)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Remover colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {colaboradorEditando ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h2>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {erro}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {colaboradorEditando ? '(deixe em branco para manter)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!colaboradorEditando}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={colaboradorEditando ? 'Nova senha (opcional)' : 'Senha do colaborador'}
                />
                {colaboradorEditando && (
                  <p className="mt-1 text-xs text-gray-500">
                    Deixe em branco para manter a senha atual
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {colaboradorEditando ? 'Atualizar' : 'Criar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

