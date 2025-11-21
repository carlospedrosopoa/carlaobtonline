// layouts/ArenaLayout.tsx - Layout da área da arena (100% igual ao cursor)
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { pointService } from '@/services/agendamentoService';

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nomeArena, setNomeArena] = useState<string>('Carlão BT Online');
  const [logoArena, setLogoArena] = useState<string | null>(null);

  useEffect(() => {
    const carregarNomeArena = async () => {
      if (usuario?.pointIdGestor) {
        try {
          const arena = await pointService.obter(usuario.pointIdGestor);
          setNomeArena(arena.nome);
          setLogoArena(arena.logoUrl || null);
        } catch (error) {
          console.error('Erro ao carregar nome da arena:', error);
          // Mantém o nome padrão em caso de erro
        }
      }
    };

    carregarNomeArena();
  }, [usuario?.pointIdGestor]);

  const navItems = [
    { to: '/app/arena/agendamentos', label: 'Agenda' },
    { to: '/app/arena/agendamentos/agenda', label: 'Agenda Semanal' },
    { to: '/app/arena/quadras', label: 'Minhas Quadras' },
    { to: '/app/arena/tabela-precos', label: 'Tabela de Preços' },
    { to: '/app/arena/bloqueios', label: 'Bloqueios' },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoArena && (
              <img
                src={logoArena}
                alt={`Logo ${nomeArena}`}
                className="w-10 h-10 object-contain rounded-lg"
              />
            )}
            <span className="text-xl font-bold text-emerald-600">{nomeArena}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
              Área da Arena
            </span>
          </div>
          <div className="flex items-center gap-4">
            {usuario && (
              <span className="hidden sm:inline text-sm text-gray-600">
                {usuario.name || usuario.nome} ({usuario.email})
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="bg-emerald-50 border-t border-emerald-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    isActive
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-emerald-300'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="py-6 px-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}



