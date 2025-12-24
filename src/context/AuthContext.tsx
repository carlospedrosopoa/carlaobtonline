// context/AuthContext.tsx - Context de autenticação (JWT + Basic Auth compatibilidade)
'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { setAccessToken, setBasicCreds as setBasicCredsApi } from '@/lib/api';
import { jwtDecode } from 'jwt-decode';

type JwtPayload = {
  id: number | string;
  name?: string;
  nome?: string;
  email?: string;
  role?: 'ADMIN' | 'USER' | 'ORGANIZER' | 'PROFESSOR' | string;
  atletaId?: string | null;
  pointIdGestor?: string | null;
  iat?: number;
  exp?: number;
};

type AuthContextType = {
  usuario: JwtPayload | null;
  autenticado: boolean;
  token: string | null;
  basicCreds: { email: string; senha: string } | null;
  isAdmin: boolean;
  isOrganizer: boolean;
  isUser: boolean;
  isProfessor: boolean;
  pointIdGestor: string | null;
  atletaId: string | null;
  setUsuario: (usuario: JwtPayload | null) => void;
  logout: () => void;
  login: (args: {
    token: string;
    usuario?: JwtPayload | null;
    basicCreds?: { email: string; senha: string } | null;
  }) => void;
  authReady: boolean;
};

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  autenticado: false,
  token: null,
  basicCreds: null,
  isAdmin: false,
  isOrganizer: false,
  isUser: false,
  isProfessor: false,
  pointIdGestor: null,
  atletaId: null,
  logout: () => {},
  setUsuario: () => {},
  login: () => {},
  authReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<JwtPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [basicCreds, setBasicCreds] = useState<{ email: string; senha: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Hidratação inicial
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prioridade 1: JWT Token (método preferido)
    const storedAccessToken = localStorage.getItem('accessToken');
    if (storedAccessToken) {
      try {
        const decoded = jwtDecode<JwtPayload>(storedAccessToken);
        // Verifica se token não expirou
        if (decoded.exp && decoded.exp * 1000 > Date.now()) {
          setToken(storedAccessToken);
          setAccessToken(storedAccessToken); // Sincroniza com api.ts
          setUsuario(decoded);
          setAuthReady(true);
          return;
        } else {
          // Token expirado, remove
          localStorage.removeItem('accessToken');
        }
      } catch (error) {
        console.error('Erro ao decodificar token:', error);
        // Se token inválido, remove
        localStorage.removeItem('accessToken');
      }
    }

    // Prioridade 2: Token antigo (compatibilidade)
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      try {
        const decoded = jwtDecode<JwtPayload>(storedToken);
        // Verifica se token não expirou
        if (decoded.exp && decoded.exp * 1000 > Date.now()) {
          // Migra para accessToken
          setToken(storedToken);
          setAccessToken(storedToken);
          setUsuario(decoded);
          localStorage.removeItem('token'); // Remove token antigo
          localStorage.setItem('accessToken', storedToken);
          setAuthReady(true);
          return;
        } else {
          localStorage.removeItem('token');
        }
      } catch {}
    }

    // Prioridade 3: Usuário armazenado (compatibilidade)
    const storedUsuario = localStorage.getItem('usuario');
    if (storedUsuario) {
      try {
        const u = JSON.parse(storedUsuario);
        setUsuario(u);
      } catch {}
    }

    // Prioridade 4: Basic Auth (compatibilidade)
    const storedCreds = localStorage.getItem('basicCreds');
    if (storedCreds) {
      try {
        const creds = JSON.parse(storedCreds);
        setBasicCreds(creds);
        setBasicCredsApi(creds); // Sincroniza com api.ts
      } catch {}
    }

    setAuthReady(true);
  }, []);

  const logout = () => {
    // Limpa JWT
    localStorage.removeItem('accessToken');
    setAccessToken(null);
    
    // Limpa tokens antigos (compatibilidade)
    localStorage.removeItem('token');
    
    // Limpa dados do usuário
    localStorage.removeItem('usuario');
    
    // Limpa Basic Auth (compatibilidade)
    localStorage.removeItem('basicCreds');
    setBasicCredsApi(null);
    
    // Limpa estado
    setToken(null);
    setUsuario(null);
    setBasicCreds(null);
  };

  const login: AuthContextType['login'] = ({ token, usuario, basicCreds }) => {
    // Salva token JWT (método preferido)
    if (token) {
      setToken(token);
      setAccessToken(token); // Sincroniza com api.ts
      localStorage.setItem('accessToken', token);
      
      // Tenta decodificar para obter dados do usuário
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        setUsuario(decoded);
        localStorage.setItem('usuario', JSON.stringify(decoded));
      } catch (error) {
        console.error('Erro ao decodificar token no login:', error);
      }
    }

    // Se usuário foi fornecido diretamente, usa ele
    if (usuario) {
      setUsuario(usuario);
      localStorage.setItem('usuario', JSON.stringify(usuario));
    }

    // Basic Auth (compatibilidade/fallback)
    if (basicCreds) {
      setBasicCreds(basicCreds);
      setBasicCredsApi(basicCreds); // Sincroniza com api.ts
      localStorage.setItem('basicCreds', JSON.stringify(basicCreds));
    }
  };

  const isAdmin = usuario?.role === 'ADMIN';
  const isOrganizer = usuario?.role === 'ORGANIZER';
  const isProfessor = usuario?.role === 'PROFESSOR';
  const isUser = usuario?.role === 'USER' || (!isAdmin && !isOrganizer && !isProfessor);
  const pointIdGestor = usuario?.pointIdGestor ?? null;
  const atletaId = usuario?.atletaId ?? null;

  const value = useMemo<AuthContextType>(
    () => ({
      usuario,
      autenticado: !!usuario,
      token,
      basicCreds,
      isAdmin,
      isOrganizer,
      isUser,
      isProfessor,
      pointIdGestor,
      atletaId,
      setUsuario,
      logout,
      login,
      authReady,
    }),
    [usuario, token, basicCreds, isAdmin, isOrganizer, isUser, isProfessor, pointIdGestor, atletaId, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
