// app/app/atleta/layout.tsx - Layout da área do atleta (sem menu global, usa menu do layout)
'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AtletaLayout from '@/layouts/AtletaLayout';

export default function AtletaAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AtletaLayout>
        {children}
      </AtletaLayout>
    </ProtectedRoute>
  );
}

