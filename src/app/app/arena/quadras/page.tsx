// app/app/arena/quadras/page.tsx - Quadras da arena
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { quadraService } from '@/services/agendamentoService';
import type { Quadra, CriarQuadraPayload } from '@/types/agendamento';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function ArenaQuadrasPage() {
  const { usuario } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [quadraEditando, setQuadraEditando] = useState<Quadra | null>(null);
  const [form, setForm] = useState<CriarQuadraPayload>({
    nome: '',
    pointId: usuario?.pointIdGestor || '',
    tipo: '',
    capacidade: undefined,
    ativo: true,
    tiposEsporte: [],
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarQuadras();
  }, []);

  const carregarQuadras = async () => {
    try {
      setLoading(true);
      const data = await quadraService.listar();
      setQuadras(data);
    } catch (error) {
      console.error('Erro ao carregar quadras:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (quadra?: Quadra) => {
    if (quadra) {
      setQuadraEditando(quadra);
      setForm({
        nome: quadra.nome,
        pointId: quadra.pointId,
        tipo: quadra.tipo || '',
        capacidade: quadra.capacidade,
        ativo: quadra.ativo,
        tiposEsporte: quadra.tiposEsporte || [],
      });
    } else {
      setQuadraEditando(null);
      setForm({
        nome: '',
        pointId: usuario?.pointIdGestor || '',
        tipo: '',
        capacidade: undefined,
        ativo: true,
        tiposEsporte: [],
      });
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setQuadraEditando(null);
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      if (quadraEditando) {
        await quadraService.atualizar(quadraEditando.id, form);
      } else {
        await quadraService.criar(form);
      }
      fecharModal();
      carregarQuadras();
    } catch (error: any) {
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao salvar quadra');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta quadra?')) return;

    try {
      await quadraService.deletar(id);
      carregarQuadras();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar quadra');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Minhas Quadras</h1>
          <p className="text-gray-600">Gerencie as quadras da sua arena</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Nova Quadra
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {quadras.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Nenhuma quadra encontrada</p>
            <button
              onClick={() => abrirModal()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Criar Primeira Quadra
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nome</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Capacidade</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {quadras.map((quadra) => (
                  <tr key={quadra.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">{quadra.nome}</td>
                    <td className="py-3 px-4 text-gray-600">{quadra.tipo || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {quadra.capacidade ? `${quadra.capacidade} pessoas` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          quadra.ativo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {quadra.ativo ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Ativa
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Inativa
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => abrirModal(quadra)}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletar(quadra.id)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Deletar"
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
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {quadraEditando ? 'Editar Quadra' : 'Nova Quadra'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Piso</label>
                  <input
                    type="text"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    placeholder="Ex: Areia, Grama, Sintética..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacidade</label>
                  <input
                    type="number"
                    value={form.capacidade || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        capacidade: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    min={1}
                    placeholder="Número de pessoas"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipos de Esporte</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['Tênis', 'Futebol', 'Vôlei', 'Basquete', 'Futsal', 'Futvolei', 'Beach Tennis', 'Padel', 'Pickleball', 'Squash', 'Badminton', 'Handebol'].map((esporte) => (
                    <label key={esporte} className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.tiposEsporte?.includes(esporte) || false}
                        onChange={(e) => {
                          const tiposAtuais = form.tiposEsporte || [];
                          if (e.target.checked) {
                            setForm({ ...form, tiposEsporte: [...tiposAtuais, esporte] });
                          } else {
                            setForm({ ...form, tiposEsporte: tiposAtuais.filter((t) => t !== esporte) });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{esporte}</span>
                    </label>
                  ))}
                </div>
                {form.tiposEsporte && form.tiposEsporte.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Selecionados: {form.tiposEsporte.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                  Quadra ativa
                </label>
              </div>

              {erro && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
