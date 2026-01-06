// layouts/ArenaLayout.tsx - Layout da área da arena com menu hamburger
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { pointService } from '@/services/agendamentoService';
import { Menu, X, ChevronRight } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  icon?: string;
}

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nomeArena, setNomeArena] = useState<string>('Play Na Quadra');
  const [logoArena, setLogoArena] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const carregarNomeArena = async () => {
      if (usuario?.pointIdGestor) {
        try {
          const arena = await pointService.obter(usuario.pointIdGestor);
          setNomeArena(arena.nome);
          setLogoArena(arena.logoUrl || null);
        } catch (error) {
          console.error('Erro ao carregar nome da arena:', error);
        }
      }
    };

    carregarNomeArena();
  }, [usuario?.pointIdGestor]);

  const navGroups: NavGroup[] = [
    {
      label: 'Agenda Semanal',
      items: [{ to: '/app/arena/agendamentos/agenda', label: 'Agenda Semanal' }],
    },
    {
      label: 'Locações',
      items: [
        { to: '/app/arena/agendamentos/agenda', label: 'Agenda Semanal' },
        { to: '/app/arena/agendamentos/agenda-mobile', label: 'Agenda Mobile' },
        { to: '/app/arena/agendamentos', label: 'Agenda' },
        { to: '/app/arena/quadras', label: 'Minhas Quadras' },
        { to: '/app/arena/tabela-precos', label: 'Tabela de Preços' },
        { to: '/app/arena/bloqueios', label: 'Bloqueios' },
      ],
    },
    {
      label: 'Comandas de Clientes',
      items: [{ to: '/app/arena/cards-clientes', label: 'Comandas de Clientes' }],
    },
    {
      label: 'Fluxo de Caixa',
      items: [
        { to: '/app/arena/fluxo-caixa', label: 'Fluxo de Caixa' },
        { to: '/app/arena/historico-caixa', label: 'Histórico de Caixa' },
        { to: '/app/arena/dashboard-caixa', label: 'Dashboard do Caixa' },
      ],
    },
    {
      label: 'Produtos',
      items: [
        { to: '/app/arena/produtos', label: 'Produtos' },
        { to: '/app/arena/fornecedores', label: 'Fornecedores' },
      ],
    },
    {
      label: 'Auxiliar',
      items: [
        { to: '/app/arena/formas-pagamento', label: 'Formas de Pagamento' },
        { to: '/app/arena/centro-custo', label: 'Centro de Custo' },
        { to: '/app/arena/tipo-despesa', label: 'Tipo de Despesa' },
      ],
    },
    {
      label: 'Atletas',
      items: [
        { to: '/app/arena/atletas', label: 'Lista de Atletas' },
      ],
    },
    {
      label: 'Professores',
      items: [
        { to: '/app/arena/professores', label: 'Lista de Professores' },
      ],
    },
    {
      label: 'Competições',
      items: [
        { to: '/app/arena/competicoes', label: 'Competições' },
      ],
    },
    {
      label: 'Administração',
      items: [
        { to: '/app/arena/colaboradores', label: 'Colaboradores' },
      ],
    },
  ];

  const isItemActive = (item: NavItem) => {
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isItemActive(item));
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
    setOpenGroup(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-indigo-100">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Botão Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
              aria-label="Abrir menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            {logoArena && (
              <img
                src={logoArena}
                alt={`Logo ${nomeArena}`}
                className="w-10 h-10 object-contain rounded-lg"
              />
            )}
            <span className="text-xl font-bold text-emerald-600">{nomeArena}</span>
            <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
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
        {/* Barra de Navegação Desktop */}
        <nav className="hidden lg:block bg-emerald-50 border-t border-emerald-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1">
              {navGroups.map((group) => {
                const isActive = isGroupActive(group);
                
                if (group.items.length === 1) {
                  // Link direto
                  const item = group.items[0];
                  return (
                    <Link
                      key={group.label}
                      href={item.to}
                      className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                        isItemActive(item)
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-emerald-300'
                      }`}
                    >
                      {group.label}
                    </Link>
                  );
                }
                
                // Grupo com dropdown - usar hover para mostrar submenu
                return (
                  <div
                    key={group.label}
                    className="relative group"
                  >
                    <button
                      className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-1 ${
                        isActive
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-emerald-300'
                      }`}
                    >
                      {group.label}
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      {group.items.map((item) => (
                        <Link
                          key={item.to}
                          href={item.to}
                          className={`block px-4 py-2 text-sm hover:bg-emerald-50 ${
                            isItemActive(item)
                              ? 'text-emerald-700 font-medium bg-emerald-50'
                              : 'text-gray-700'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Menu Mobile/Tablet - Painel Lateral */}
      {menuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Painel Lateral */}
          <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-xl z-50 lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Menu</h2>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {logoArena && (
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={logoArena}
                    alt={`Logo ${nomeArena}`}
                    className="w-8 h-8 object-contain rounded-lg"
                  />
                  <span className="text-sm font-semibold text-gray-700">{nomeArena}</span>
                </div>
              )}
            </div>

            <nav className="p-4 space-y-2">
              {navGroups.map((group) => {
                const isActive = isGroupActive(group);
                
                if (group.items.length === 1) {
                  // Link direto
                  const item = group.items[0];
                  return (
                    <Link
                      key={group.label}
                      href={item.to}
                      onClick={handleLinkClick}
                      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isItemActive(item)
                          ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                }

                // Grupo com submenu
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{group.label}</span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          openGroup === group.label ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {openGroup === group.label && (
                      <div className="ml-4 mt-2 space-y-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.to}
                            href={item.to}
                            onClick={handleLinkClick}
                            className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                              isItemActive(item)
                                ? 'bg-emerald-100 text-emerald-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </>
      )}

      <main className="pt-24 py-6 px-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
