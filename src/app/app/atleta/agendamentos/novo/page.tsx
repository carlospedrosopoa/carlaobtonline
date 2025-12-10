// app/app/atleta/agendamentos/novo/page.tsx - Página para criar novo agendamento
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import type { Agendamento } from '@/types/agendamento';

export default function NovoAgendamentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quadraIdInicial = searchParams.get('quadraId') || undefined;
  const [modalAberto, setModalAberto] = useState(true);

  const handleClose = () => {
    setModalAberto(false);
    router.push('/app/atleta/agendamentos');
  };

  const handleSuccess = () => {
    setModalAberto(false);
    router.push('/app/atleta/agendamentos');
  };

  return (
    <EditarAgendamentoModal
      isOpen={modalAberto}
      agendamento={null}
      quadraIdInicial={quadraIdInicial}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  );
}












