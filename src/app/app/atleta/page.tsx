// app/app/atleta/page.tsx - Página index do atleta (redireciona para agenda semanal)
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AtletaIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/atleta/agendamentos/agenda');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Carregando...</h1>
      </div>
    </div>
  );
}


