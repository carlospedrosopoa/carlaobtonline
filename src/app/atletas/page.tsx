// app/atletas/page.tsx - Lista de Atletas
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Atleta } from '@/types/domain';

export default function AtletasPage() {
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();
  const { usuario, authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (!usuario) {
      router.push('/login');
      return;
    }
    fetchAtletas();
  }, [authReady, usuario, router]);

  const fetchAtletas = async () => {
    try {
      const { data, status } = await api.get('/atleta/listarAtletas');
      if (status === 200) {
        // Backend pode retornar { atletas, usuario } ou array direto
        const atletasList = Array.isArray(data) ? data : (data.atletas || []);
        setAtletas(atletasList);
      }
    } catch (err) {
      console.error('Erro ao buscar atletas:', err);
    } finally {
      setCarregando(false);
    }
  };

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
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Lista de Atletas</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {atletas.map((atleta) => (
          <div
            key={atleta.id}
            className="bg-white shadow-md rounded-2xl p-4 flex flex-col items-center"
          >
            {atleta.fotoUrl && (
              <img
                src={atleta.fotoUrl}
                alt={atleta.nome}
                className="w-32 h-32 object-cover rounded-full mb-2"
              />
            )}
            <h2 className="text-lg font-semibold">{atleta.nome}</h2>
            <p>Idade: {atleta.idade ?? '—'}</p>
            <p>Categoria: {atleta.categoria ?? '—'}</p>
            <p>Gênero: {atleta.genero ?? '—'}</p>
          </div>
        ))}
      </div>

      {atletas.length === 0 && (
        <p className="text-center text-gray-600 mt-6">Nenhum atleta encontrado.</p>
      )}
    </div>
  );
}
