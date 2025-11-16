// components/MenuWrapper.tsx - Wrapper para mostrar menu apenas em rotas específicas
'use client';

import { usePathname } from 'next/navigation';
import Menu from './Menu';

export default function MenuWrapper() {
  const pathname = usePathname();

  // Não mostra menu se estiver em rotas que têm layouts próprios (com menus integrados)
  if (
    pathname?.startsWith('/app/atleta') ||
    pathname?.startsWith('/app/arena') ||
    pathname?.startsWith('/app/admin')
  ) {
    return null;
  }

  // Mostra menu nas outras rotas (dashboard, perfil, etc que não usam os layouts)
  return <Menu />;
}

