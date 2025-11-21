// app/app/atleta/perfil/page.tsx - Perfil do atleta (100% igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        setErro('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validar tamanho (máximo 5MB)
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

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
}

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
}

export default function AtletaPerfilPage() {
  const [token, setToken] = useState<string>('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [atleta, setAtleta] = useState<Atleta | null>(null);

  const [modalEditarUsuario, setModalEditarUsuario] = useState(false);
  const [modalEditarAtleta, setModalEditarAtleta] = useState(false);
  const [modalEditarFoto, setModalEditarFoto] = useState(false);
  const [modalAtletaModal, setModalAtleta] = useState(false);

  const auth: any = useAuth();
  const authReady: boolean =
    typeof auth?.authReady === 'boolean' ? auth.authReady : true;

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (auth?.usuario) {
      fetchUsuario();
      fetchAtleta();
    } else {
      setUsuario(null);
      setAtleta(null);
    }
  }, [authReady, auth?.usuario]);

  const fetchUsuario = async () => {
    try {
      const res = await api.get('/user/getUsuarioLogado');
      if (res.status >= 200 && res.status < 300) {
        setUsuario(res.data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário', error);
      setUsuario(null);
    }
  };

  const fetchAtleta = async () => {
    try {
      const res = await api.get('/atleta/me/atleta');
      if (res.status === 204 || !res.data) {
        setAtleta(null);
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        setAtleta(res.data);
      }
    } catch (error: any) {
      if (error?.status !== 204 && error?.status !== 404) {
        console.error('Erro ao buscar atleta', error);
      }
      setAtleta(null);
    }
  };

  if (authReady === false) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>
        <div className="animate-pulse bg-gray-100 h-24 rounded mb-4" />
        <div className="animate-pulse bg-gray-100 h-56 rounded" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Meu Perfil</h1>
          <p className="text-gray-600">Gerencie suas informações pessoais e de atleta</p>
        </div>

        {/* Usuário */}
        {usuario && (
          <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Dados de Usuário</h2>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                onClick={() => setModalEditarUsuario(true)}
              >
                Editar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Nome</p>
                <p className="font-semibold text-gray-900">{usuario.name}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-gray-900">{usuario.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Tipo de Conta</p>
                <p className="font-semibold text-gray-900">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      usuario.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {usuario.role}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Atleta */}
        <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Dados de Atleta</h2>
            {atleta && (
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  onClick={() => setModalEditarAtleta(true)}
                >
                  Editar
                </button>
                <button
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  onClick={() => setModalEditarFoto(true)}
                >
                  Alterar Foto
                </button>
              </div>
            )}
          </div>

          {atleta ? (
            <div className="space-y-6">
              {/* Foto do Atleta - Destaque */}
              <div className="flex flex-col items-center mb-6">
                {atleta.fotoUrl ? (
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                    <img
                      src={atleta.fotoUrl}
                      alt="Foto do atleta"
                      className="relative w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-full shadow-xl border-4 border-white"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center bg-gray-100 rounded-full">
                      <svg
                        className="w-16 h-16 text-gray-400"
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
                  </div>
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                    <svg
                      className="w-16 h-16 sm:w-20 sm:h-20 text-blue-400"
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
                <p className="mt-4 text-lg font-semibold text-gray-900">{atleta.nome}</p>
                {atleta.categoria && (
                  <span className="mt-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {atleta.categoria}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {atleta.idade && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Idade</p>
                    <p className="font-semibold text-gray-900">{atleta.idade} anos</p>
                  </div>
                )}
                {atleta.genero && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Gênero</p>
                    <p className="font-semibold text-gray-900">{atleta.genero}</p>
                  </div>
                )}
                {atleta.fone && (
                  <div className="p-4 bg-gray-50 rounded-lg sm:col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Telefone</p>
                    <p className="font-semibold text-gray-900">{atleta.fone}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
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
              <p className="text-gray-600 mb-4">Você ainda não cadastrou seu perfil de atleta.</p>
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                onClick={() => setModalAtleta(true)}
              >
                Criar Perfil de Atleta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modais - Placeholders */}
      {modalEditarUsuario && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => setModalEditarUsuario(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">Editar Dados do Usuário</h3>
            <p className="text-gray-600 mb-4">Modal será implementado em breve...</p>
            <button
              onClick={() => {
                setModalEditarUsuario(false);
                fetchUsuario();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {modalEditarAtleta && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => setModalEditarAtleta(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">Editar Dados do Atleta</h3>
            <p className="text-gray-600 mb-4">Modal será implementado em breve...</p>
            <button
              onClick={() => {
                setModalEditarAtleta(false);
                fetchAtleta();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {modalEditarFoto && (
        <ModalEditarFoto
          isOpen={modalEditarFoto}
          atletaId={atleta?.id || ''}
          fotoAtual={atleta?.fotoUrl || null}
          onClose={() => setModalEditarFoto(false)}
          onSuccess={() => {
            setModalEditarFoto(false);
            fetchAtleta();
          }}
        />
      )}

      {modalAtletaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
              onClick={() => setModalAtleta(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">Criar Perfil de Atleta</h3>
            <p className="text-gray-600 mb-4">Redirecionando para página de criação...</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalAtleta(false);
                  window.location.href = '/app/atleta/preencher-perfil';
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ir para Criar Perfil
              </button>
              <button
                onClick={() => setModalAtleta(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
