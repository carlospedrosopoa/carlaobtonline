// app/preencher-perfil-atleta/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface AtletaForm {
  nome: string;
  dataNascimento: string;
  genero: string;
  categoria: string;
}

export default function PreencherPerfilAtletaPage() {
  const router = useRouter();
  const { usuario, authReady } = useAuth();

  const [form, setForm] = useState<AtletaForm>({
    nome: '',
    dataNascimento: '',
    genero: '',
    categoria: '',
  });

  const [verificando, setVerificando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!authReady) return;
    if (!usuario) {
      router.push('/login');
      return;
    }

    const verificarAtleta = async () => {
      try {
        const res = await api.get('/atleta/me/atleta');
        if (res.status === 200 && res.data) {
          // Já tem atleta, redireciona
          router.push('/dashboard');
          return;
        }
      } catch (error: any) {
        // 204 ou 404 = não tem atleta, pode criar
        if (error?.status !== 204 && error?.status !== 404) {
          console.error('Erro ao verificar atleta:', error);
        }
      }
      setVerificando(false);
    };

    verificarAtleta();
  }, [authReady, usuario, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const payload = {
      ...form,
      genero: form.genero ? form.genero.toUpperCase() : '',
    };

    try {
      const { status } = await api.post('/atleta/criarAtleta', payload);
      if (status === 201 || status === 200) {
        router.push('/dashboard');
      } else {
        setErro('Erro ao salvar perfil. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao criar atleta:', error);
      setErro('Erro ao salvar perfil. Tente novamente.');
    }
  };

  if (verificando || !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="p-4">Verificando perfil de atleta...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded-xl shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-4">Preencha seu perfil de atleta</h1>
      
      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Nome completo</label>
          <input
            type="text"
            name="nome"
            placeholder="Nome completo"
            value={form.nome}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Data de Nascimento</label>
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
            required
          >
            <option value="">Selecione o gênero</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMININO">Feminino</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Categoria</label>
          <input
            type="text"
            name="categoria"
            placeholder="Categoria (ex: A, B, Iniciante...)"
            value={form.categoria}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
        >
          Salvar Perfil
        </button>
      </form>
    </div>
  );
}

