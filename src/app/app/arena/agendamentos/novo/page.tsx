// app/app/arena/agendamentos/novo/page.tsx - Página para criar novo agendamento
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';
import type { Agendamento } from '@/types/agendamento';

export default function NovoAgendamentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quadraIdInicial = searchParams.get('quadraId') || undefined;
  const dataInicial = searchParams.get('data') || undefined;
  const horaInicial = searchParams.get('hora') || undefined;
  const duracaoInicial = searchParams.get('duracao') ? parseInt(searchParams.get('duracao')!, 10) : undefined;
  const [modalAberto, setModalAberto] = useState(true);

  const handleClose = () => {
    setModalAberto(false);
    router.push('/app/arena/agendamentos');
  };

  const handleSuccess = () => {
    setModalAberto(false);
    router.push('/app/arena/agendamentos');
  };

  return (
    <EditarAgendamentoModal
      isOpen={modalAberto}
      agendamento={null}
      quadraIdInicial={quadraIdInicial}
      dataInicial={dataInicial}
      horaInicial={horaInicial}
      duracaoInicial={duracaoInicial}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  );
}

