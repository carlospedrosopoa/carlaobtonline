// app/app/arena/configuracao/page.tsx - Configurações da Arena
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { pointService, type Point } from '@/services/agendamentoService';
import { Settings, Save, Upload, X, MapPin, Loader2 } from 'lucide-react';

export default function ConfiguracaoArenaPage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoGeolocalizacao, setBuscandoGeolocalizacao] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  
  const [form, setForm] = useState({
    nome: '',
    endereco: '',
    telefone: '',
    email: '',
    descricao: '',
    latitude: null as number | null,
    longitude: null as number | null,
    logoUrl: null as string | null,
    cardTemplateUrl: null as string | null,
    enviarLembretesAgendamento: false,
    antecedenciaLembrete: 8,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  useEffect(() => {
    if (usuario?.pointIdGestor) {
      carregarConfiguracao();
    }
  }, [usuario?.pointIdGestor]);

  const carregarConfiguracao = async () => {
    if (!usuario?.pointIdGestor) return;
    
    try {
      setLoading(true);
      const arena = await pointService.obter(usuario.pointIdGestor);
      
      setForm({
        nome: arena.nome || '',
        endereco: arena.endereco || '',
        telefone: arena.telefone || '',
        email: arena.email || '',
        descricao: arena.descricao || '',
        latitude: arena.latitude || null,
        longitude: arena.longitude || null,
        logoUrl: arena.logoUrl || null,
        cardTemplateUrl: arena.cardTemplateUrl || null,
        enviarLembretesAgendamento: arena.enviarLembretesAgendamento || false,
        antecedenciaLembrete: arena.antecedenciaLembrete || 8,
      });

      setLogoPreview(arena.logoUrl || null);
      setTemplatePreview(arena.cardTemplateUrl || null);
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErro('A imagem do logo deve ter no máximo 5MB');
        return;
      }
      
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErro('O template de card deve ter no máximo 10MB');
        return;
      }
      
      setTemplateFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setTemplatePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removerLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setForm({ ...form, logoUrl: null });
  };

  const removerTemplate = () => {
    setTemplateFile(null);
    setTemplatePreview(null);
    setForm({ ...form, cardTemplateUrl: null });
  };

  const buscarGeolocalizacao = async () => {
    if (!form.endereco || !form.endereco.trim()) {
      setErro('Por favor, informe o endereço antes de buscar a localização');
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
        setSucesso('Localização encontrada com sucesso!');
        setTimeout(() => setSucesso(''), 3000);
      } else {
        setErro(data.mensagem || 'Não foi possível encontrar a localização deste endereço. Verifique o endereço e tente novamente.');
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
    if (!usuario?.pointIdGestor) return;

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
        const payload: any = {
          nome: form.nome,
          endereco: form.endereco || null,
          telefone: form.telefone || null,
          email: form.email || null,
          descricao: form.descricao || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          enviarLembretesAgendamento: form.enviarLembretesAgendamento,
          antecedenciaLembrete: form.antecedenciaLembrete || null,
        };

      // Se há um novo logo, incluir base64
      if (logoFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(logoFile);
        payload.logoUrl = await base64Promise;
      } else if (logoPreview === null && form.logoUrl !== null) {
        // Se removeu o logo (preview null mas havia logo antes)
        payload.logoUrl = null;
      }

      // Se há um novo template, incluir base64
      if (templateFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(templateFile);
        payload.cardTemplateUrl = await base64Promise;
      } else if (templatePreview === null && form.cardTemplateUrl !== null) {
        // Se removeu o template (preview null mas havia template antes)
        payload.cardTemplateUrl = null;
      }

      await pointService.atualizar(usuario.pointIdGestor, payload);
      
      setSucesso('Configurações salvas com sucesso!');
      setLogoFile(null);
      setTemplateFile(null);
      
      // Recarregar configuração para atualizar URLs
      setTimeout(() => {
        carregarConfiguracao();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setErro(error?.response?.data?.mensagem || 'Erro ao salvar configuração');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configurações da Arena</h1>
      </div>

      {erro && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {sucesso}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Arena *
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="Nome da arena"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Endereço completo"
                />
                <button
                  type="button"
                  onClick={buscarGeolocalizacao}
                  disabled={buscandoGeolocalizacao || !form.endereco?.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Buscar geolocalização do endereço"
                >
                  {buscandoGeolocalizacao ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Buscar</span>
                </button>
              </div>
              {form.latitude !== null && form.longitude !== null && (
                <p className="mt-1 text-xs text-gray-500">
                  📍 Localização: {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="email@arena.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                placeholder="Descrição da arena..."
              />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Logotipo</h2>
          
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {logoPreview && (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Preview do logo"
                  className="w-32 h-32 object-contain border border-gray-300 rounded-lg p-2 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={removerLogo}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload do Logo
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
                  <Upload className="w-4 h-4" />
                  Escolher Arquivo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-gray-500">
                  PNG, JPG ou GIF (máx. 5MB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Template de Card de Jogos */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Template de Card de Jogos</h2>
          
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {templatePreview && (
              <div className="relative">
                <img
                  src={templatePreview}
                  alt="Preview do template"
                  className="w-48 h-64 object-contain border border-gray-300 rounded-lg p-2 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={removerTemplate}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload do Template
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
                  <Upload className="w-4 h-4" />
                  Escolher Arquivo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTemplateChange}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-gray-500">
                  PNG ou JPG (máx. 10MB)
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Este template será usado para gerar os cards de jogos das competições.
              </p>
            </div>
          </div>
        </div>

        {/* Configurações de Lembretes */}
        <div className="pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lembretes de Agendamento</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enviarLembretes"
                checked={form.enviarLembretesAgendamento}
                onChange={(e) => setForm({ ...form, enviarLembretesAgendamento: e.target.checked })}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="enviarLembretes" className="text-sm font-medium text-gray-700">
                Enviar lembretes de agendamento por WhatsApp
              </label>
            </div>

            {form.enviarLembretesAgendamento && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Antecedência do Lembrete (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={form.antecedenciaLembrete}
                  onChange={(e) => setForm({ ...form, antecedenciaLembrete: parseInt(e.target.value) || 8 })}
                  className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="8"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Quantas horas antes do agendamento enviar o lembrete (mín. 1h, máx. 168h / 7 dias)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => carregarConfiguracao()}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

