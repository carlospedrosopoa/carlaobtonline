'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Edit, Trash2, Search, ExternalLink } from 'lucide-react';
import { apoiadorService } from '@/services/apoiadorService';
import type { Apoiador } from '@/types/apoiador';
import { api } from '@/lib/api';

type RegiaoResumo = {
  id: string;
  nome: string;
};

export default function ApoiadoresAdminPage() {
  const [apoiadores, setApoiadores] = useState<Apoiador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [regioes, setRegioes] = useState<RegiaoResumo[]>([]);
  const [carregandoRegioes, setCarregandoRegioes] = useState(false);
  
  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Apoiador | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Form states
  const [nome, setNome] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [exibirColorido, setExibirColorido] = useState(true);
  const [regiaoIds, setRegiaoIds] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    carregar();
    carregarRegioes();
  }, []);

  const carregarRegioes = async () => {
    try {
      setCarregandoRegioes(true);
      const { data } = await api.get('/public/regiao');
      setRegioes((Array.isArray(data) ? data : []) as RegiaoResumo[]);
    } catch (error) {
      console.error('Erro ao carregar regiões:', error);
      setRegioes([]);
    } finally {
      setCarregandoRegioes(false);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo e tamanho (front-end check)
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('O arquivo deve ter no máximo 5MB.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'apoiadores');

      const { data, status } = await api.postFormData('/upload/image', formData);
      if (status < 200 || status >= 300 || !data?.url) {
        throw new Error(data?.error || data?.mensagem || 'Falha no upload');
      }
      setLogoUrl(data.url as string);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
      // Limpar o input
      e.target.value = '';
    }
  };

  const carregar = async () => {
    try {
      setLoading(true);
      const data = await apoiadorService.listar();
      setApoiadores(data);
    } catch (error) {
      console.error('Erro ao carregar apoiadores:', error);
      alert('Erro ao carregar lista');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (item?: Apoiador) => {
    if (item) {
      setEditando(item);
      setNome(item.nome);
      setInstagram(item.instagram || '');
      setWhatsapp(item.whatsapp || '');
      setLogoUrl(item.logoUrl || '');
      setLatitude(item.latitude?.toString() || '');
      setLongitude(item.longitude?.toString() || '');
      setAtivo(item.ativo);
      setExibirColorido(item.exibirColorido ?? true);
      setRegiaoIds(Array.isArray(item.regiaoIds) ? item.regiaoIds : []);
    } else {
      setEditando(null);
      setNome('');
      setInstagram('');
      setWhatsapp('');
      setLogoUrl('');
      setLatitude('');
      setLongitude('');
      setAtivo(true);
      setExibirColorido(true);
      setRegiaoIds([]);
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return alert('Nome é obrigatório');

    try {
      setSalvando(true);
      const payload = {
        nome,
        instagram: instagram || null,
        whatsapp: whatsapp || null,
        logoUrl: logoUrl || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        ativo,
        exibirColorido,
        regiaoIds,
      };

      if (editando) {
        await apoiadorService.atualizar(editando.id, payload);
      } else {
        await apoiadorService.criar(payload);
      }
      
      fecharModal();
      carregar();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar apoiador');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este apoiador?')) return;
    try {
      await apoiadorService.remover(id);
      carregar();
    } catch (error) {
      console.error('Erro ao remover:', error);
      alert('Erro ao remover apoiador');
    }
  };

  const filtrados = apoiadores.filter((a) => 
    a.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apoiadores</h1>
          <p className="text-gray-500">Gerencie os parceiros e apoiadores da plataforma.</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Apoiador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Logo</th>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Localização</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhum apoiador encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
                        {item.logoUrl ? (
                          <img src={item.logoUrl} alt={item.nome} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-500">{item.nome.charAt(0)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">{item.nome}</td>
                    <td className="px-6 py-3 text-gray-600">
                      <div className="flex flex-col gap-1">
                        {item.whatsapp && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="font-semibold">Zap:</span> {item.whatsapp}
                          </span>
                        )}
                        {item.instagram && (
                          <a 
                            href={`https://instagram.com/${item.instagram.replace('@', '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {item.instagram}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600 text-xs">
                      {item.latitude && item.longitude ? (
                        <span>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sem localização</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirModal(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remover(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={salvar}>
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  {editando ? 'Editar Apoiador' : 'Novo Apoiador'}
                </h3>
                <button type="button" onClick={fecharModal} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nome do estabelecimento ou marca"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="@usuario"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://..."
                    />
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg border border-gray-300 transition-colors flex items-center gap-2 text-sm font-medium">
                      <span>{uploading ? 'Enviando...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {logoUrl && (
                    <div className="mt-2 flex justify-center p-2 border border-dashed border-gray-300 rounded bg-gray-50 relative group">
                      <img src={logoUrl} alt="Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="absolute top-1 right-1 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover imagem"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="-30.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="-51.0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Regiões de atuação</label>
                  <div className="text-xs text-gray-500 mb-2">
                    Se não selecionar nenhuma, o apoiador aparecerá em todas as regiões.
                  </div>
                  {carregandoRegioes ? (
                    <div className="text-sm text-gray-500">Carregando regiões...</div>
                  ) : regioes.length === 0 ? (
                    <div className="text-sm text-gray-500">Nenhuma região cadastrada.</div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y max-h-44 overflow-y-auto bg-white">
                      {regioes.map((r) => {
                        const checked = regiaoIds.includes(r.id);
                        return (
                          <label
                            key={r.id}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setRegiaoIds((prev) =>
                                  isChecked ? Array.from(new Set([...prev, r.id])) : prev.filter((x) => x !== r.id)
                                );
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-800">{r.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ativo" className="text-sm font-medium text-gray-700 select-none">
                    Apoiador Ativo (visível no app)
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="exibirColorido"
                    checked={exibirColorido}
                    onChange={(e) => setExibirColorido(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="exibirColorido" className="text-sm font-medium text-gray-700 select-none">
                    Exibir logo colorido
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {salvando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
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
