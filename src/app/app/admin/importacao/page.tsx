'use client';

import Link from 'next/link';

export default function AdminImportacaoIndexPage() {
  const items = [
    {
      title: 'Dados básicos',
      description: 'Fornecedores, produtos, tipos de despesa, centros de custo e formas de pagamento.',
      to: '/app/admin/importacao/tabelas-basicas',
    },
    {
      title: 'Movimentação',
      description: 'Importa comandas com itens e pagamentos (vinculando ao caixa aberto no destino).',
      to: '/app/admin/importacao/movimentacao',
    },
    {
      title: 'Competições',
      description: 'Importa competição com tabela de jogos e resultados.',
      to: '/app/admin/importacao/competicoes',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">Importações</h1>
        <p className="text-gray-600 mt-1">Escolha o tipo de importação que deseja realizar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.to}
            href={item.to}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md border border-transparent hover:border-purple-200 transition"
          >
            <div className="text-lg font-semibold text-gray-900">{item.title}</div>
            <div className="mt-2 text-sm text-gray-600">{item.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

