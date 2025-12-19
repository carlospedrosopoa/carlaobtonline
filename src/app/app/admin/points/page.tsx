// app/app/admin/points/page.tsx - Points admin (igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import { pointService } from '@/services/agendamentoService';
import type { Point, CriarPointPayload } from '@/types/agendamento';
import { Plus, Edit, Trash2, MapPin, Phone, Mail, CheckCircle, XCircle, MessageCircle, Eye, EyeOff, Crown } from 'lucide-react';

export default function AdminPointsPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [pointEditando, setPointEditando] = useState<Point | null>(null);
  const [form, setForm] = useState<CriarPointPayload>({
    nome: '',
    endereco: '',
    telefone: '',
    email: '',
    descricao: '',
    logoUrl: null,
    latitude: null,
    longitude: null,
    ativo: true,
    whatsappAccessToken: null,
    whatsappPhoneNumberId: null,
    whatsappBusinessAccountId: null,
    whatsappApiVersion: 'v21.0',
    whatsappAtivo: false,
    gzappyApiKey: null,
    gzappyInstanceId: null,
    gzappyAtivo: false,
    enviarLembretesAgendamento: false,
    antecedenciaLembrete: 8,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [buscandoGeolocalizacao, setBuscandoGeolocalizacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarTokenWhatsApp, setMostrarTokenWhatsApp] = useState(false);
  const [mostrarApiKeyGzappy, setMostrarApiKeyGzappy] = useState(false);

  useEffect(() => {
    carregarPoints();
  }, []);

  const carregarPoints = async () => {
    try {
      setLoading(true);
      const data = await pointService.listar();
      setPoints(data);
    } catch (error) {
      console.error('Erro ao carregar points:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (point?: Point) => {
    if (point) {
      setPointEditando(point);
      setForm({
        nome: point.nome,
        endereco: point.endereco || '',
        telefone: point.telefone || '',
        email: point.email || '',
        descricao: point.descricao || '',
        logoUrl: point.logoUrl || null,
        latitude: point.latitude || null,
        longitude: point.longitude || null,
        ativo: point.ativo,
        whatsappAccessToken: point.whatsappAccessToken || null,
        whatsappPhoneNumberId: point.whatsappPhoneNumberId || null,
        whatsappBusinessAccountId: point.whatsappBusinessAccountId || null,
        whatsappApiVersion: point.whatsappApiVersion || 'v21.0',
        whatsappAtivo: point.whatsappAtivo ?? false,
        gzappyApiKey: point.gzappyApiKey || null,
        gzappyInstanceId: point.gzappyInstanceId || null,
        gzappyAtivo: point.gzappyAtivo ?? false,
        enviarLembretesAgendamento: point.enviarLembretesAgendamento ?? false,
        antecedenciaLembrete: point.antecedenciaLembrete ?? 8,
      });
      setLogoPreview(point.logoUrl || null);
    } else {
      setPointEditando(null);
      setForm({
        nome: '',
        endereco: '',
        telefone: '',
        email: '',
        descricao: '',
        logoUrl: null,
        latitude: null,
        longitude: null,
        ativo: true,
        whatsappAccessToken: null,
        whatsappPhoneNumberId: null,
        whatsappBusinessAccountId: null,
        whatsappApiVersion: 'v21.0',
        whatsappAtivo: false,
        gzappyApiKey: null,
        gzappyInstanceId: null,
        gzappyAtivo: false,
        enviarLembretesAgendamento: false,
        antecedenciaLembrete: 8,
      });
      setLogoPreview(null);
    }
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setPointEditando(null);
    setErro('');
    setLogoPreview(null);
    setMostrarTokenWhatsApp(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErro('Por favor, selecione apenas arquivos de imagem.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErro('A imagem deve ter no máximo 5MB.');
        return;
      }
      // Converter para base64
      // TODO: Migrar para URL (Vercel Blob Storage ou Cloudinary) quando necessário para melhor performance
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setForm({ ...form, logoUrl: base64String });
        setLogoPreview(base64String);
        setErro('');
      };
      reader.onerror = () => {
        setErro('Erro ao ler a imagem. Tente novamente.');
      };
      reader.readAsDataURL(file);
    }
  };

  const buscarGeolocalizacao = async () => {
    if (!form.endereco || !form.endereco.trim()) {
      setErro('Por favor, preencha o endereço antes de buscar a localização.');
      return;
    }

    setBuscandoGeolocalizacao(true);
    setErro('');

    try {
      const response = await fetch(`/api/geocode?endereco=${encodeURIComponent(form.endereco)}`);
      const data = await response.json();

      if (response.ok && data.latitude && data.longitude) {
        setForm({
          ...form,
          latitude: data.latitude,
          longitude: data.longitude,
        });
      } else {
        setErro(data.mensagem || 'Não foi possível encontrar a localização deste endereço.');
      }
    } catch (error) {
      console.error('Erro ao buscar geolocalização:', error);
      setErro('Erro ao buscar localização. Tente novamente.');
    } finally {
      setBuscandoGeolocalizacao(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // Validação: se WhatsApp está ativo, campos obrigatórios devem estar preenchidos
    if (form.whatsappAtivo) {
      if (!form.whatsappAccessToken || !form.whatsappAccessToken.trim()) {
        setErro('Access Token é obrigatório quando o WhatsApp está ativo');
        return;
      }
      if (!form.whatsappPhoneNumberId || !form.whatsappPhoneNumberId.trim()) {
        setErro('Phone Number ID é obrigatório quando o WhatsApp está ativo');
        return;
      }
    }

    // Validação: se Gzappy está ativo, campos obrigatórios devem estar preenchidos
    if (form.gzappyAtivo) {
      if (!form.gzappyApiKey || !form.gzappyApiKey.trim()) {
        setErro('API Key é obrigatória quando o Gzappy está ativo');
        return;
      }
      if (!form.gzappyInstanceId || !form.gzappyInstanceId.trim()) {
        setErro('Instance ID é obrigatório quando o Gzappy está ativo');
        return;
      }
    }

    setSalvando(true);

    try {
      if (pointEditando) {
        await pointService.atualizar(pointEditando.id, form);
      } else {
        await pointService.criar(form);
      }
      fecharModal();
      carregarPoints();
    } catch (error: any) {
      console.error('Erro ao salvar point:', error);
      const mensagem =
        error?.response?.data?.mensagem ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao salvar estabelecimento. Verifique os dados e tente novamente.';
      setErro(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este estabelecimento?')) return;

    try {
      await pointService.deletar(id);
      carregarPoints();
    } catch (error: any) {
      alert(error?.response?.data?.mensagem || 'Erro ao deletar estabelecimento');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-xl shadow-lg p-8">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gerenciar Estabelecimentos</h1>
          <p className="text-gray-600">Administre os estabelecimentos e suas quadras</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Novo Estabelecimento
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {points.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Nenhum estabelecimento cadastrado</p>
            <button
              onClick={() => abrirModal()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Criar Primeiro Estabelecimento
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {points.map((point) => (
              <div
                key={point.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {point.logoUrl && (
                      <img
                        src={point.logoUrl}
                        alt={`Logo ${point.nome}`}
                        className="w-12 h-12 object-contain rounded-lg border border-gray-200"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 text-lg">{point.nome}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                      point.ativo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {point.ativo ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inativo
                      </>
                    )}
                  </span>
                </div>

                {point.endereco && (
                  <p className="text-sm text-gray-600 mb-2 flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{point.endereco}</span>
                  </p>
                )}
                {(point.latitude && point.longitude) && (
                  <p className="text-xs text-gray-500 mb-2">
                    📍 {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                  </p>
                )}

                {point.telefone && (
                  <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {point.telefone}
                  </p>
                )}

                {point.email && (
                  <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {point.email}
                  </p>
                )}

                {point.descricao && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{point.descricao}</p>
                )}

                {/* Indicador WhatsApp */}
                {point.whatsappAtivo && (
                  <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">WhatsApp Ativo</span>
                  </div>
                )}

                {/* Indicador Assinante */}
                <div className="flex items-center justify-between mb-3 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Assinante</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const novoValor = !point.assinante;
                        await pointService.atualizarAssinante(point.id, novoValor);
                        await carregarPoints();
                      } catch (error: any) {
                        console.error('Erro ao atualizar assinante:', error);
                        alert(error?.response?.data?.mensagem || 'Erro ao atualizar flag de assinante');
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      point.assinante ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        point.assinante ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => abrirModal(point)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeletar(point.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {pointEditando ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Ex: Rua Exemplo, 123, Cidade - Estado"
                  />
                  <button
                    type="button"
                    onClick={buscarGeolocalizacao}
                    disabled={buscandoGeolocalizacao || !form.endereco}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    title="Buscar localização no mapa"
                  >
                    {buscandoGeolocalizacao ? 'Buscando...' : '📍 Buscar'}
                  </button>
                </div>
                {(form.latitude && form.longitude) && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Localização encontrada: {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logotipo</label>
                <div className="space-y-2">
                  {logoPreview && (
                    <div className="flex justify-center">
                      <img
                        src={logoPreview}
                        alt="Preview do logotipo"
                        className="w-32 h-32 object-contain border-2 border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500">Formatos aceitos: JPG, PNG, GIF (máximo 5MB)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
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
                  Estabelecimento ativo
                </label>
              </div>

              {/* Seção WhatsApp */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Configurações WhatsApp Business</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Configure as credenciais da API do WhatsApp Business da Meta para esta arena.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="whatsappAtivo"
                      checked={form.whatsappAtivo ?? false}
                      onChange={(e) => setForm({ ...form, whatsappAtivo: e.target.checked })}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <label htmlFor="whatsappAtivo" className="text-sm font-medium text-gray-700">
                      Ativar WhatsApp para esta arena
                    </label>
                  </div>

                  {form.whatsappAtivo && (
                    <div className="space-y-4 pl-6 border-l-2 border-green-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Access Token *
                        </label>
                        <div className="relative">
                          <input
                            type={mostrarTokenWhatsApp ? 'text' : 'password'}
                            value={form.whatsappAccessToken || ''}
                            onChange={(e) => setForm({ ...form, whatsappAccessToken: e.target.value })}
                            placeholder="EAAxxxxxxxxxxxxx"
                            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarTokenWhatsApp(!mostrarTokenWhatsApp)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {mostrarTokenWhatsApp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Token de acesso da API do WhatsApp Business (Meta)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number ID *
                        </label>
                          <input
                            type="text"
                            value={form.whatsappPhoneNumberId || ''}
                            onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
                            placeholder="123456789012345"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          />
                        <p className="text-xs text-gray-500 mt-1">
                          ⚠️ <strong>NÃO é o número de telefone!</strong> É o ID do número que você encontra em <strong>WhatsApp → API Setup</strong> no Meta Business Suite. Geralmente tem 15-17 dígitos e é diferente do número de telefone.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Business Account ID (Opcional)
                        </label>
                        <input
                          type="text"
                          value={form.whatsappBusinessAccountId || ''}
                          onChange={(e) => setForm({ ...form, whatsappBusinessAccountId: e.target.value })}
                          placeholder="123456789012345"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          ID da conta comercial do WhatsApp Business (opcional)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Versão da API
                        </label>
                        <select
                          value={form.whatsappApiVersion || 'v21.0'}
                          onChange={(e) => setForm({ ...form, whatsappApiVersion: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        >
                          <option value="v21.0">v21.0</option>
                          <option value="v20.0">v20.0</option>
                          <option value="v19.0">v19.0</option>
                          <option value="v18.0">v18.0</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Versão da API do WhatsApp Business (padrão: v21.0)
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <strong>💡 Dica:</strong> Consulte o arquivo <code className="bg-blue-100 px-1 rounded">GUIA_API_META.md</code> para obter instruções detalhadas sobre como obter essas credenciais.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção Gzappy */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Configurações Gzappy</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Configure as credenciais da API do Gzappy para esta arena.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="gzappyAtivo"
                      checked={form.gzappyAtivo ?? false}
                      onChange={(e) => setForm({ ...form, gzappyAtivo: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="gzappyAtivo" className="text-sm font-medium text-gray-700">
                      Ativar Gzappy para esta arena
                    </label>
                  </div>

                  {form.gzappyAtivo && (
                    <div className="space-y-4 pl-6 border-l-2 border-purple-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API Key *
                        </label>
                        <div className="relative">
                          <input
                            type={mostrarApiKeyGzappy ? 'text' : 'password'}
                            value={form.gzappyApiKey || ''}
                            onChange={(e) => setForm({ ...form, gzappyApiKey: e.target.value })}
                            placeholder="Sua API Key do Gzappy"
                            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarApiKeyGzappy(!mostrarApiKeyGzappy)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {mostrarApiKeyGzappy ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Chave de API do Gzappy para autenticação
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Instance ID *
                        </label>
                        <input
                          type="text"
                          value={form.gzappyInstanceId || ''}
                          onChange={(e) => setForm({ ...form, gzappyInstanceId: e.target.value })}
                          placeholder="ID da instância do Gzappy"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          ID da instância do Gzappy configurada para esta arena
                        </p>
                      </div>

                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm text-purple-800">
                          <strong>💡 Dica:</strong> Consulte a documentação do Gzappy para obter instruções detalhadas sobre como obter essas credenciais.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção Lembretes de Agendamento */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Lembretes de Agendamento</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Configure o envio automático de lembretes de agendamento via WhatsApp para os atletas.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enviarLembretesAgendamento"
                      checked={form.enviarLembretesAgendamento ?? false}
                      onChange={(e) => setForm({ ...form, enviarLembretesAgendamento: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enviarLembretesAgendamento" className="text-sm font-medium text-gray-700">
                      Enviar lembretes de agendamento para os atletas
                    </label>
                  </div>

                  {form.enviarLembretesAgendamento && (
                    <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Antecedência (horas) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={form.antecedenciaLembrete || 8}
                          onChange={(e) => setForm({ ...form, antecedenciaLembrete: parseInt(e.target.value) || 8 })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="8"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Quantas horas antes do agendamento o lembrete deve ser enviado (ex: 8 = 8 horas antes, 24 = 24 horas antes)
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <strong>⚠️ Importante:</strong> Para que os lembretes sejam enviados, é necessário:
                        </p>
                        <ul className="text-sm text-blue-800 mt-2 list-disc list-inside space-y-1">
                          <li>Gzappy configurado e ativo para esta arena</li>
                          <li>Atletas com flag "Aceitar lembretes" ativada em seus perfis</li>
                          <li>Agendamentos confirmados</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
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
