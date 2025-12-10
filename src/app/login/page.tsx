// app/login/page.tsx - Página de login (layout igual ao cursor)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setBasicCreds } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function getRedirectRoute(role: string): string {
  if (role === 'ADMIN') return '/app/admin';
  if (role === 'ORGANIZER') return '/app/arena';
  return '/app/atleta';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const { login, usuario, authReady, autenticado } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    
    // Se já estiver autenticado, redireciona
    if (autenticado && usuario) {
      router.replace(getRedirectRoute(usuario.role || 'USER'));
    }
  }, [authReady, autenticado, usuario, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    try {
      const { data, status } = await api.post('/user/auth/login', { email, password });

      if (status !== 200) {
        setErro(data.mensagem || data.error || 'Erro ao fazer login');
        return;
      }

      const usuarioData = data.usuario || data.user;
      const tokenJWT = data.token; // Token JWT retornado pela API
      
      // Login via context (usa JWT como método preferido)
      login({
        token: tokenJWT || undefined, // Token JWT (método preferido)
        usuario: usuarioData,
        // Basic Auth mantido como fallback (compatibilidade)
        basicCreds: tokenJWT ? null : { email: email.trim().toLowerCase(), senha: password },
      });

      // Redireciona baseado no role
      const role = usuarioData?.role || 'USER';
      router.replace(getRedirectRoute(role));
    } catch (err: any) {
      // Tratamento de erros melhorado
      if (!err.response) {
        if (err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
          setErro('Erro de conexão. Verifique se o servidor está online e sua internet está funcionando.');
        } else {
          setErro('Não foi possível conectar ao servidor. Verifique sua conexão.');
        }
      } else if (err.response?.data?.mensagem) {
        setErro(err.response.data.mensagem);
      } else if (err.response?.data?.error) {
        setErro(err.response.data.error);
      } else if (err.response?.status === 500) {
        setErro('Erro interno do servidor. Tente novamente mais tarde.');
      } else {
        setErro(err.message || 'Erro desconhecido. Tente novamente.');
      }
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo</h1>
            <p className="text-gray-600">Faça login para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                disabled={carregando}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                disabled={carregando}
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {carregando ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
