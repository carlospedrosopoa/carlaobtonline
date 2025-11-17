// app/app/admin/atletas/page.tsx - Lista de Atletas (igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Atleta {
  id: string;
  nome: string;
  dataNascimento: string;
  genero?: string;
  categoria?: string;
  idade?: number;
  fotoUrl?: string;
  usuarioId: string;
}

export default function AdminAtletasPage() {
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [carregando, setCarregando] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Lista de Atletas</h1>
        <p className="text-sm text-gray-600">Gerencie os perfis de atletas cadastrados</p>
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

              <div className="mt-4 flex flex-col gap-2 w-full">
                <button
                  onClick={() => {
                    // Modal será implementado quando necessário
                    alert('Funcionalidade de edição será implementada em breve');
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Editar Dados
                </button>

                <button
                  onClick={() => {
                    // Modal será implementado quando necessário
                    alert('Funcionalidade de alterar foto será implementada em breve');
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
    </div>
  );
}
