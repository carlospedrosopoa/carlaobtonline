// app/app/admin/atletas/page.tsx - Lista de Atletas (igual ao cursor)
'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { pointService } from '@/services/agendamentoService';
import type { Point } from '@/types/agendamento';
import { Crown, UserPlus, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Atleta {
  id: string;
  nome: string;
  dataNascimento: string;
  genero?: string;
  categoria?: string;
  idade?: number;
  fotoUrl?: string;
  fone?: string;
  usuarioId: string;
  assinante?: boolean;
}

interface ModalEditarFotoProps {
  isOpen: boolean;
  atletaId: string;
  fotoAtual: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalEditarFoto({ isOpen, atletaId, fotoAtual, onClose, onSuccess }: ModalEditarFotoProps) {
  const [fotoPreview, setFotoPreview] = useState<string | null>(fotoAtual);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFotoUrl(base64String);
        setFotoPreview(base64String);
        setErro('');
      };
      reader.onerror = () => {
        setErro('Erro ao ler a imagem. Tente novamente.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = async () => {
    if (!fotoUrl) {
      setErro('Por favor, selecione uma imagem.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const { status } = await api.put(`/atleta/${atletaId}`, { fotoUrl });
      if (status === 200) {
        onSuccess();
      } else {
        setErro('Erro ao salvar foto. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao atualizar foto:', error);
      setErro('Erro ao salvar foto. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverFoto = async () => {
    setSalvando(true);
    setErro('');
    try {
      const { status } = await api.put(`/atleta/${atletaId}`, { fotoUrl: null });
      if (status === 200) {
        setFotoPreview(null);
        onSuccess();
      } else {
        setErro('Erro ao remover foto. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      setErro('Erro ao remover foto. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold mb-4">Alterar Foto</h3>
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {erro}
          </div>
        )}
        <div className="space-y-4">
          {fotoPreview && (
            <div className="flex justify-center">
              <img
                src={fotoPreview}
                alt="Preview da foto"
                className="w-32 h-32 object-cover rounded-full border-2 border-gray-300"
              />
            </div>
          )}
          <div>
            <label className="block font-semibold mb-2">Selecionar Nova Foto</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="w-full p-2 border rounded"
              disabled={salvando}
            />
            <p className="text-sm text-gray-500 mt-1">Formatos aceitos: JPG, PNG, GIF (máximo 5MB)</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSalvar}
              disabled={salvando || !fotoUrl}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            {fotoAtual && (
              <button
                onClick={handleRemoverFoto}
                disabled={salvando}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Remover
              </button>
            )}
            <button
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModalEditarAtletaProps {
  isOpen: boolean;
  atleta: Atleta | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalEditarAtleta({ isOpen, atleta, onClose, onSuccess }: ModalEditarAtletaProps) {
  const [form, setForm] = useState({
    nome: '',
    dataNascimento: '',
    genero: '',
    categoria: '',
    fone: '',
  });
  const [points, setPoints] = useState<Point[]>([]);
  const [pointIdPrincipal, setPointIdPrincipal] = useState<string>('');
  const [pointIdsFrequentes, setPointIdsFrequentes] = useState<string[]>([]);
  const [carregandoArenas, setCarregandoArenas] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const carregarArenas = async () => {
      try {
        setCarregandoArenas(true);
        const data = await pointService.listar();
        setPoints(data.filter((p) => p.ativo));
      } catch (error) {
        console.error('Erro ao carregar arenas:', error);
      } finally {
        setCarregandoArenas(false);
      }
    };

    if (isOpen) {
      carregarArenas();
    }
  }, [isOpen]);

  useEffect(() => {
    if (atleta) {
      // Formatar data para input type="date" (YYYY-MM-DD)
      const dataNasc = atleta.dataNascimento 
        ? new Date(atleta.dataNascimento).toISOString().split('T')[0]
        : '';
      
      setForm({
        nome: atleta.nome || '',
        dataNascimento: dataNasc,
        genero: atleta.genero || '',
        categoria: atleta.categoria || '',
        fone: atleta.fone || '',
      });

      // Carregar arenas do atleta
      const carregarArenasAtleta = async () => {
        try {
          const res = await api.get(`/atleta/${atleta.id}`);
          if (res.data) {
            setPointIdPrincipal(res.data.pointIdPrincipal || '');
            setPointIdsFrequentes(res.data.arenasFrequentes?.map((a: any) => a.id) || []);
          }
        } catch (error) {
          console.error('Erro ao carregar arenas do atleta:', error);
        }
      };

      carregarArenasAtleta();
    }
  }, [atleta]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleToggleArenaFrequente = (pointId: string) => {
    setPointIdsFrequentes((prev) => {
      if (prev.includes(pointId)) {
        // Se já está selecionada e é a principal, não pode remover
        if (pointIdPrincipal === pointId) {
          setErro('Não é possível remover a arena principal das arenas frequentes.');
          return prev;
        }
        return prev.filter((id) => id !== pointId);
      } else {
        return [...prev, pointId];
      }
    });
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (!atleta) return;

    if (!form.nome || !form.dataNascimento) {
      setErro('Nome e data de nascimento são obrigatórios.');
      return;
    }

    setSalvando(true);

    try {
      // Se selecionou uma arena principal, garantir que ela está nas frequentes
      const arenasFrequentes = pointIdPrincipal && !pointIdsFrequentes.includes(pointIdPrincipal)
        ? [...pointIdsFrequentes, pointIdPrincipal]
        : pointIdsFrequentes;

      const payload = {
        nome: form.nome,
        dataNascimento: form.dataNascimento,
        genero: form.genero ? form.genero.toUpperCase() : null,
        categoria: form.categoria || null,
        fone: form.fone || null,
        pointIdPrincipal: pointIdPrincipal || null,
        pointIdsFrequentes: arenasFrequentes,
      };

      const { status } = await api.put(`/atleta/${atleta.id}`, payload);
      if (status === 200) {
        onSuccess();
      } else {
        setErro('Erro ao salvar dados. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao atualizar atleta:', error);
      setErro('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !atleta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 relative max-w-md w-full max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold mb-4">Editar Dados do Atleta</h3>
        
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Nome completo *</label>
            <input
              type="text"
              name="nome"
              value={form.nome}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Data de Nascimento *</label>
            <input
              type="date"
              name="dataNascimento"
              value={form.dataNascimento}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Gênero</label>
            <select
              name="genero"
              value={form.genero}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="">Selecione o gênero</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Categoria</label>
            <select
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="">Selecione a categoria</option>
              <option value="INICIANTE">INICIANTE</option>
              <option value="D">D</option>
              <option value="C">C</option>
              <option value="B">B</option>
              <option value="A">A</option>
              <option value="PRO">PRO</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Telefone</label>
            <input
              type="text"
              name="fone"
              placeholder="Telefone"
              value={form.fone}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          {!carregandoArenas && points.length > 0 && (
            <>
              <div>
                <label className="block font-semibold mb-2">Arena mais próxima da casa</label>
                <select
                  value={pointIdPrincipal}
                  onChange={(e) => {
                    setPointIdPrincipal(e.target.value);
                    setErro('');
                  }}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Selecione a arena mais próxima</option>
                  {points.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Arenas que frequenta</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
                  {points.map((point) => (
                    <label
                      key={point.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={pointIdsFrequentes.includes(point.id)}
                        onChange={() => handleToggleArenaFrequente(point.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        {point.logoUrl && (
                          <img
                            src={point.logoUrl}
                            alt={`Logo ${point.nome}`}
                            className="w-6 h-6 object-contain rounded"
                          />
                        )}
                        <span className="text-sm">{point.nome}</span>
                        {pointIdPrincipal === point.id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ModalCriarUsuarioIncompletoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalCriarUsuarioIncompleto({ isOpen, onClose, onSuccess }: ModalCriarUsuarioIncompletoProps) {
  const { usuario } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [atletaEncontrado, setAtletaEncontrado] = useState<{ id: string; nome: string; telefone: string } | null>(null);
  const [modo, setModo] = useState<'buscar' | 'criar' | 'vincular'>('buscar');
  const telefoneInputRef = useRef<HTMLInputElement>(null);

  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  const handleBuscarTelefone = async () => {
    if (!telefone.trim()) {
      setErro('Informe o telefone');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setBuscando(true);
    setErro('');
    setAtletaEncontrado(null);

    try {
      // Buscar atleta por telefone
      const { data, status } = await api.post('/user/atleta/buscar-por-telefone', {
        telefone: telefoneNormalizado,
      });

      if (status === 200 && data.existe) {
        // Atleta encontrado - mostrar opção de vincular (apenas se organizer)
        if (usuario?.role === 'ORGANIZER' && usuario?.pointIdGestor) {
          setAtletaEncontrado({
            id: data.id,
            nome: data.nome,
            telefone: data.telefone,
          });
          setModo('vincular');
        } else {
          // Admin não vincula, apenas informa que já existe
          setErro(`Atleta "${data.nome}" já está cadastrado na plataforma.`);
          setModo('buscar');
        }
      } else {
        // Atleta não encontrado - modo criar
        setModo('criar');
      }
    } catch (err: any) {
      if (err?.response?.data?.codigo === 'ATLETA_NAO_ENCONTRADO' || err?.response?.status === 404) {
        // Atleta não encontrado - modo criar
        setModo('criar');
      } else {
        setErro(err?.response?.data?.mensagem || 'Erro ao buscar telefone. Tente novamente.');
      }
    } finally {
      setBuscando(false);
    }
  };

  const handleVincularAtleta = async () => {
    if (!atletaEncontrado || !usuario?.pointIdGestor) return;

    setSalvando(true);
    setErro('');

    try {
      const { data, status } = await api.post(`/atleta/${atletaEncontrado.id}/vincular-arena`);

      if (status === 200) {
        alert(`Atleta "${atletaEncontrado.nome}" vinculado à arena com sucesso!`);
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao vincular atleta');
      }
    } catch (err: any) {
      // Tratar caso especial: atleta já vinculado
      if (err?.response?.data?.codigo === 'ATLETA_JA_VINCULADO' || err?.response?.data?.jaVinculado) {
        // Mostrar mensagem informativa (não é erro crítico)
        alert(err?.response?.data?.mensagem || `O atleta "${atletaEncontrado.nome}" já está vinculado à sua arena.`);
        resetarModal();
        onClose();
      } else {
        setErro(
          err?.response?.data?.mensagem ||
            err?.response?.data?.error ||
            'Erro ao vincular atleta. Tente novamente.'
        );
        console.error('Erro ao vincular atleta:', err);
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (!nome.trim() || !telefone.trim()) {
      setErro('Nome e telefone são obrigatórios');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setSalvando(true);
    try {
      const { data, status } = await api.post('/user/criar-incompleto', {
        name: nome.trim(),
        telefone: telefoneNormalizado,
      });

      if (status === 201) {
        alert('Usuário criado com sucesso! Ele poderá completar o cadastro usando o telefone no appatleta.');
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao criar usuário');
      }
    } catch (err: any) {
      setErro(
        err?.response?.data?.mensagem ||
          err?.response?.data?.error ||
          'Erro ao criar usuário. Verifique os dados.'
      );
      console.error('Erro ao criar usuário incompleto:', err);
    } finally {
      setSalvando(false);
    }
  };

  const resetarModal = () => {
    setNome('');
    setTelefone('');
    setErro('');
    setAtletaEncontrado(null);
    setModo('buscar');
  };

  const handleClose = () => {
    resetarModal();
    onClose();
  };

  // Focar no campo de telefone quando a modal abrir no modo buscar
  useEffect(() => {
    if (isOpen && modo === 'buscar' && telefoneInputRef.current) {
      // Pequeno delay para garantir que a modal está renderizada
      setTimeout(() => {
        telefoneInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, modo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
          onClick={handleClose}
          disabled={salvando || buscando}
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold mb-4">Criar / Vincular Atleta</h3>

        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {erro}
          </div>
        )}

        {modo === 'buscar' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Informe o telefone do atleta. Se ele já estiver cadastrado, você poderá vinculá-lo à sua arena.
            </p>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={telefoneInputRef}
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={buscando}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={buscando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBuscarTelefone}
                disabled={buscando || telefone.replace(/\D/g, '').length < 10}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        )}

        {modo === 'vincular' && atletaEncontrado && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Atleta encontrado:</strong>
              </p>
              <p className="text-lg font-semibold text-gray-900">{atletaEncontrado.nome}</p>
              <p className="text-sm text-gray-600 mt-1">Telefone: {formatarTelefone(atletaEncontrado.telefone)}</p>
            </div>

            <p className="text-sm text-gray-600">
              Deseja vincular este atleta à sua arena? Ele aparecerá na sua lista de atletas.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setAtletaEncontrado(null);
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleVincularAtleta}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Vinculando...' : 'Vincular à Arena'}
              </button>
            </div>
          </div>
        )}

        {modo === 'criar' && (
          <form onSubmit={handleCriarUsuario} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Telefone não encontrado. Crie um novo usuário pendente que poderá se vincular posteriormente usando o telefone no appatleta.
            </p>

            <div>
              <label className="block font-semibold mb-1">Nome completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nome do usuário"
                required
                disabled={salvando}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={salvando}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O usuário usará este telefone para vincular a conta no appatleta
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setNome('');
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminAtletasPage() {
  const { usuario } = useAuth();
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalEditarFoto, setModalEditarFoto] = useState<{ atletaId: string; fotoAtual: string | null } | null>(null);
  const [modalEditarAtleta, setModalEditarAtleta] = useState<Atleta | null>(null);
  const [modalCriarUsuarioIncompleto, setModalCriarUsuarioIncompleto] = useState(false);

  useEffect(() => {
    fetchAtletas();
  }, []);

  const fetchAtletas = async () => {
    try {
      setCarregando(true);
      const { data } = await api.get('/atleta/listarAtletas');
      // backend pode responder { atletas, usuario } OU array puro
      setAtletas(Array.isArray(data) ? data : data.atletas || []);
    } catch (err: any) {
      console.error('Erro ao buscar atletas:', err);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Lista de Atletas</h1>
        <div className="animate-pulse bg-gray-100 h-64 rounded-xl"></div>
      </div>
    );
  }

  // Verificar se usuário pode criar usuários incompletos (ADMIN ou ORGANIZER)
  const podeCriarUsuarioIncompleto = usuario?.role === 'ADMIN' || usuario?.role === 'ORGANIZER';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Lista de Atletas</h1>
          <p className="text-sm text-gray-600">Gerencie os perfis de atletas cadastrados</p>
        </div>
        {podeCriarUsuarioIncompleto && (
          <button
            onClick={() => setModalCriarUsuarioIncompleto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <UserPlus className="w-5 h-5" />
            Criar / Vincular Atleta
          </button>
        )}
      </div>

      {atletas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600">Nenhum atleta cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {atletas.map((atleta) => (
            <div
              key={atleta.id}
              className="bg-white shadow-md rounded-2xl p-4 flex flex-col items-center"
            >
              {atleta.fotoUrl ? (
                <img
                  src={atleta.fotoUrl}
                  alt={atleta.nome}
                  className="w-32 h-32 object-cover rounded-full mb-2 border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-2 border-4 border-white shadow-lg">
                  <svg
                    className="w-16 h-16 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900">{atleta.nome}</h2>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>Idade: {atleta.idade ?? '—'}</p>
                <p>Categoria: {atleta.categoria ?? '—'}</p>
                <p>Gênero: {atleta.genero ?? '—'}</p>
              </div>

              {/* Toggle Assinante */}
              <div className="mt-3 w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Assinante</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const novoValor = !atleta.assinante;
                        await api.put(`/atleta/${atleta.id}/assinante`, { assinante: novoValor });
                        await fetchAtletas();
                      } catch (error: any) {
                        console.error('Erro ao atualizar assinante:', error);
                        alert(error?.response?.data?.mensagem || 'Erro ao atualizar flag de assinante');
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      atleta.assinante ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        atleta.assinante ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 w-full">
                <button
                  onClick={() => {
                    setModalEditarAtleta(atleta);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Editar Dados
                </button>

                <button
                  onClick={() => {
                    setModalEditarFoto({
                      atletaId: atleta.id,
                      fotoAtual: atleta.fotoUrl || null,
                    });
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Alterar Foto
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalEditarFoto && (
        <ModalEditarFoto
          isOpen={!!modalEditarFoto}
          atletaId={modalEditarFoto.atletaId}
          fotoAtual={modalEditarFoto.fotoAtual}
          onClose={() => setModalEditarFoto(null)}
          onSuccess={() => {
            setModalEditarFoto(null);
            fetchAtletas();
          }}
        />
      )}

      {modalEditarAtleta && (
        <ModalEditarAtleta
          isOpen={!!modalEditarAtleta}
          atleta={modalEditarAtleta}
          onClose={() => setModalEditarAtleta(null)}
          onSuccess={() => {
            setModalEditarAtleta(null);
            fetchAtletas();
          }}
        />
      )}

      <ModalCriarUsuarioIncompleto
        isOpen={modalCriarUsuarioIncompleto}
        onClose={() => setModalCriarUsuarioIncompleto(false)}
        onSuccess={() => {
          fetchAtletas();
        }}
      />
    </div>
  );
}
