// app/app/arena/competicoes/[id]/page.tsx - Editar competição
'use client';

import { use } from 'react';
import CompeticaoForm from '@/components/CompeticaoForm';

export default function EditarCompeticaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CompeticaoForm competicaoId={id} />;
}


