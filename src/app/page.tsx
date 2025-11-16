// app/page.tsx - Página inicial
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (redirecting) return;
    
    // Aguarda um pouco para garantir que o localStorage está disponível
    const timer = setTimeout(() => {
      try {
        setRedirecting(true);
        
        // Redireciona para login se não autenticado
        const usuario = localStorage.getItem('usuario');
        if (usuario) {
          try {
            const user = JSON.parse(usuario);
            if (user.role === 'ADMIN') {
              router.replace('/dashboard');
            } else {
              router.replace('/perfil');
            }
          } catch {
            router.replace('/login');
          }
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Erro ao redirecionar:', error);
        router.replace('/login');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Carregando...</h1>
      </div>
    </div>
  );
}