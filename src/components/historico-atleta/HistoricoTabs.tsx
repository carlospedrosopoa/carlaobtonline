'use client';

export type AbaHistoricoAtleta = 'consumo' | 'pagamentos' | 'contaCorrente' | 'agendamentos';

export default function HistoricoTabs({
  aba,
  setAba,
  disabled,
}: {
  aba: AbaHistoricoAtleta;
  setAba: (aba: AbaHistoricoAtleta) => void;
  disabled: boolean;
}) {
  const tabs: Array<{ id: AbaHistoricoAtleta; label: string }> = [
    { id: 'consumo', label: 'Consumo' },
    { id: 'pagamentos', label: 'Pagamentos' },
    { id: 'contaCorrente', label: 'Conta Corrente' },
    { id: 'agendamentos', label: 'Agendamentos' },
  ];

  return (
    <div className="border-b border-gray-200 px-4">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            disabled={disabled}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              aba === t.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

