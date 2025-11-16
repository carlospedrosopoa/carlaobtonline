// components/Menu.tsx - Menu de navegação para Next.js (100% igual ao original)
'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Menu() {
  const { usuario, logout, autenticado } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!autenticado) {
    return null; // Não mostra o menu se não estiver autenticado
  }

  const styles = {
    nav: {
      display: 'flex',
      gap: '20px',
      padding: '10px',
      borderBottom: '1px solid #ccc',
      alignItems: 'center',
    },
    sair: {
      marginLeft: 'auto',
      padding: '6px 12px',
      cursor: 'pointer',
    },
  } as const;

  return (
    <nav style={styles.nav}>
      <Link href="/dashboard">Dashboard</Link>

      {usuario?.role === 'ADMIN' && (
        <>
          <Link href="/usuarios">Usuários</Link>
          <Link href="/atletas">Atletas</Link>
          <Link href="/perfil">Meu Perfil</Link>
        </>
      )}

      {usuario?.role === 'USER' && (
        <Link href="/perfil">Meu Perfil</Link>
      )}

      <button onClick={handleLogout} style={styles.sair}>
        Sair
      </button>
    </nav>
  );
}
