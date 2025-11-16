// app/usuarios/page.tsx - Lista de Usuários (ADMIN)
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Usuario {
  id: string | number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();
  const { usuario, authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (!usuario) {
      router.push('/login');
      return;
    }
    if (usuario.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchUsuarios();
  }, [authReady, usuario, router]);

  const fetchUsuarios = async () => {
    try {
      const { data, status } = await api.get('/user/list');
      if (status === 200) {
        setUsuarios(data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setCarregando(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((user) => {
    const nomeMatch = user.name.toLowerCase().includes(busca.toLowerCase());
    const roleMatch = filtroRole ? user.role === filtroRole : true;
    return nomeMatch && roleMatch;
  });

  if (carregando || !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Usuários</h1>

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md"
        />

        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
          className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Todos</option>
          <option value="ADMIN">ADMIN</option>
          <option value="USER">USER</option>
        </select>

        <button
          onClick={fetchUsuarios}
          disabled={carregando}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {usuariosFiltrados.map((user) => (
          <div key={user.id} className="bg-white shadow-md rounded-lg p-4">
            <h3 className="text-lg font-bold">{user.name}</h3>
            <p className="text-sm text-gray-600">{user.email}</p>
            <p className="text-sm">Perfil: {user.role}</p>
            <p className="text-sm">Criado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>
        ))}
      </div>

      {usuariosFiltrados.length === 0 && (
        <p className="text-center text-gray-600 mt-6">Nenhum usuário encontrado.</p>
      )}
    </div>
  );
}

