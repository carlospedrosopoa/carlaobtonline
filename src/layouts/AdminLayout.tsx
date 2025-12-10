// layouts/AdminLayout.tsx - Layout da área do admin (100% igual ao cursor)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { to: '/app/admin/points', label: 'Points' },
    { to: '/app/admin/quadras', label: 'Quadras' },
    { to: '/app/admin/tabela-precos', label: 'Tabela de Preços' },
    { to: '/app/admin/agendamentos', label: 'Agenda' },
    { to: '/app/admin/usuarios', label: 'Usuários' },
    { to: '/app/admin/organizers', label: 'Gestores de Arena' },
    { to: '/app/admin/atletas', label: 'Atletas' },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-purple-600">Play Na Quadra</span>
            <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">
              Área do Admin
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
        <nav className="bg-purple-50 border-t border-purple-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    isActive
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-purple-300'
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



