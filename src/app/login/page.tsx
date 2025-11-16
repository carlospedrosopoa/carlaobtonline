// app/login/page.tsx - Página de login
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setBasicCreds } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function getRedirectRoute(role: string): string {
  if (role === 'ADMIN') return '/dashboard';
  if (role === 'USER') return '/perfil';
  return '/unauthorized';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const { login, usuario, authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (!usuario) return;
    
    // Redireciona apenas uma vez
    const timeout = setTimeout(() => {
      router.replace(getRedirectRoute(usuario.role || 'USER'));
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [authReady, usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    try {
      const { data, status } = await api.post('/auth/login', { email, password });

      if (status !== 200) {
        setErro(data.mensagem || 'Erro ao fazer login');
        return;
      }

      const usuarioData = data.usuario || data.user;
      
      // Configura Basic Auth
      setBasicCreds({ email: email.trim().toLowerCase(), senha: password });

      // Login via context
      login({
        token: 'basic-mode',
        usuario: usuarioData,
        basicCreds: { email: email.trim().toLowerCase(), senha: password },
      });

      // Redireciona baseado no role (usa replace para evitar loop)
      router.replace(getRedirectRoute(usuarioData.role || 'USER'));
    } catch (err: any) {
      setErro(err.message || 'Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/criar-conta" className="text-blue-500 hover:underline">
            Criar conta
          </a>
        </div>
      </div>
    </div>
  );
}
