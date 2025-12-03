// layouts/AtletaLayout.tsx - Layout da área do atleta (100% igual ao cursor)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AtletaLayout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { to: '/app/atleta/agendamentos/agenda', label: 'Agenda Semanal' },
    { to: '/app/atleta/dashboard', label: 'Dashboard' },
    { to: '/app/atleta/perfil', label: 'Meu Perfil' },
    { to: '/app/atleta/agendamentos', label: 'Agendamentos' },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-600">Carlão BT Online</span>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold">
              Área do Atleta
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
        <nav className="bg-blue-50 border-t border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-blue-300'
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



