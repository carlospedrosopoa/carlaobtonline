// context/AuthContext.tsx - Adaptado para Next.js
'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

type JwtPayload = {
  id: number | string;
  name?: string;
  nome?: string;
  email?: string;
  role?: string;
  atletaId?: string | null;
  iat?: number;
  exp?: number;
};

type AuthContextType = {
  usuario: JwtPayload | null;
  autenticado: boolean;
  token: string | null;
  basicCreds: { email: string; senha: string } | null;
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

    const storedToken = localStorage.getItem('token');
    const storedUsuario = localStorage.getItem('usuario');
    const storedCreds = localStorage.getItem('basicCreds');

    if (storedUsuario) {
      try {
        const u = JSON.parse(storedUsuario);
        setUsuario(u);
      } catch {}
    }

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedCreds) {
      try {
        setBasicCreds(JSON.parse(storedCreds));
      } catch {}
    }

    setAuthReady(true);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('basicCreds');
    setToken(null);
    setUsuario(null);
    setBasicCreds(null);
  };

  const login: AuthContextType['login'] = ({ token, usuario, basicCreds }) => {
    setToken(token);
    localStorage.setItem('token', token || '');

    if (usuario) {
      setUsuario(usuario);
      localStorage.setItem('usuario', JSON.stringify(usuario));
    }

    if (basicCreds) {
      setBasicCreds(basicCreds);
      localStorage.setItem('basicCreds', JSON.stringify(basicCreds));
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      usuario,
      autenticado: !!usuario,
      token,
      basicCreds,
      setUsuario,
      logout,
      login,
      authReady,
    }),
    [usuario, token, basicCreds, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

