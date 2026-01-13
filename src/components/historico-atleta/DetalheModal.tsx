'use client';

import { X } from 'lucide-react';

export default function DetalheModal({
  aberto,
  titulo,
  payload,
  onClose,
}: {
  aberto: boolean;
  titulo: string;
  payload: any;
  onClose: () => void;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900">{titulo}</div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-[60vh]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

