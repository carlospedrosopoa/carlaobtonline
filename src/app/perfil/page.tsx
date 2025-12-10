// app/perfil/page.tsx - Página de perfil (100% igual ao original)
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      const { userAtletaService } = await import('@/services/userAtletaService');
      await userAtletaService.atualizar({ fotoUrl });
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao atualizar foto:', error);
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao salvar foto. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverFoto = async () => {
    setSalvando(true);
    setErro('');
    try {
      const { userAtletaService } = await import('@/services/userAtletaService');
      await userAtletaService.atualizar({ fotoUrl: null });
      setFotoPreview(null);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao remover foto:', error);
      setErro(error?.response?.data?.mensagem || error?.message || 'Erro ao remover foto. Tente novamente.');
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

export default function PerfilPage() {
  const [token, setToken] = useState<string>('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [atleta, setAtleta] = useState<Atleta | null>(null);

  const [modalEditarUsuario, setModalEditarUsuario] = useState(false);
  const [modalEditarAtleta, setModalEditarAtleta] = useState(false);
  const [modalEditarFoto, setModalEditarFoto] = useState(false);
  const [modalAtletaModal, setModalAtleta] = useState(false);

  const auth = useAuth();
  const authReady = typeof auth?.authReady === 'boolean' ? auth.authReady : true;
  const router = useRouter();

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
      const { userAtletaService } = await import('@/services/userAtletaService');
      const atleta = await userAtletaService.obter();
      setAtleta(atleta);
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
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>

      {/* Usuário */}
      {usuario && (
        <div className="bg-white shadow-md rounded-2xl p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Dados de Usuário</h2>
          <p><strong>Nome:</strong> {usuario.name}</p>
          <p><strong>Email:</strong> {usuario.email}</p>
          <p><strong>Tipo:</strong> {usuario.role}</p>
          <button
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setModalEditarUsuario(true)}
          >
            Editar Dados do Usuário
          </button>
        </div>
      )}

      {/* Atleta */}
      <div className="bg-white shadow-md rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-2">Dados de Atleta</h2>

        {atleta ? (
          <>
            {atleta.fotoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={atleta.fotoUrl}
                  alt="Foto do atleta"
                  className="w-32 h-32 object-cover rounded-full shadow-md"
                />
              </div>
            )}
            <p><strong>Nome:</strong> {atleta.nome}</p>
            <p><strong>Idade:</strong> {atleta.idade}</p>
            {atleta.genero && <p><strong>Gênero:</strong> {atleta.genero}</p>}
            {atleta.categoria && <p><strong>Categoria:</strong> {atleta.categoria}</p>}
            {atleta.fone && <p><strong>Telefone:</strong> {atleta.fone}</p>}

            <div className="flex justify-center gap-3 mb-4 mt-4">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => setModalEditarAtleta(true)}
              >
                Editar Dados do Atleta
              </button>
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => setModalEditarFoto(true)}
              >
                Alterar Foto
              </button>
            </div>
          </>
        ) : (
          <div>
            <p>Você ainda não cadastrou seu perfil de atleta.</p>
            <button
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setModalAtleta(true)}
            >
              Criar Perfil de Atleta
            </button>
          </div>
        )}
      </div>

      {/* Modais */}
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
            <p className="text-gray-600 mb-4">Funcionalidade em desenvolvimento...</p>
            <button
              onClick={() => setModalEditarUsuario(false)}
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
            <p className="text-gray-600 mb-4">Funcionalidade em desenvolvimento...</p>
            <button
              onClick={() => setModalEditarAtleta(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {modalEditarFoto && atleta && (
        <ModalEditarFoto
          isOpen={modalEditarFoto}
          atletaId={atleta.id}
          fotoAtual={atleta.fotoUrl || null}
          onClose={() => setModalEditarFoto(false)}
          onSuccess={async () => {
            setModalEditarFoto(false);
            // Recarregar dados do atleta
            try {
              const { userAtletaService } = await import('@/services/userAtletaService');
              const atleta = await userAtletaService.obter();
              setAtleta(atleta);
            } catch (error) {
              console.error('Erro ao recarregar atleta:', error);
            }
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
                  router.push('/preencher-perfil-atleta');
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
