// components/ConfirmarExclusaoRecorrenteModal.tsx - Modal para confirmar exclusão de agendamento recorrente
'use client';

import { Dialog } from '@headlessui/react';
import { AlertTriangle, Calendar, Repeat, Trash2 } from 'lucide-react';
import type { Agendamento } from '@/types/agendamento';

interface ConfirmarExclusaoRecorrenteModalProps {
  isOpen: boolean;
  agendamento: Agendamento | null;
  onClose: () => void;
  onConfirmar: (aplicarARecorrencia: boolean) => void;
}

export default function ConfirmarExclusaoRecorrenteModal({
  isOpen,
  agendamento,
  onClose,
  onConfirmar,
}: ConfirmarExclusaoRecorrenteModalProps) {
  if (!agendamento) return null;

  const dataHora = new Date(agendamento.dataHora);
  const temRecorrencia = !!agendamento.recorrenciaId;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                Excluir Agendamento Permanentemente
              </Dialog.Title>
              <p className="text-sm text-gray-600">
                ⚠️ Esta ação é IRREVERSÍVEL. O agendamento será removido permanentemente do sistema.
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Data e Hora</span>
            </div>
            <p className="text-sm text-gray-900">
              {dataHora.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {' às '}
              {dataHora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {agendamento.quadra && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">Quadra:</span> {agendamento.quadra.nome}
              </div>
            )}
          </div>

          {temRecorrencia && (
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">
                  Este é um agendamento recorrente
                </span>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                Você pode excluir apenas este agendamento ou todos os agendamentos futuros desta recorrência.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => onConfirmar(false)}
                  className="w-full px-4 py-3 bg-white border-2 border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium text-left"
                >
                  <div className="font-semibold mb-1">Excluir apenas este agendamento</div>
                  <div className="text-xs text-purple-600">
                    Os próximos agendamentos da recorrência continuarão ativos
                  </div>
                </button>
                <button
                  onClick={() => onConfirmar(true)}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium text-left"
                >
                  <div className="font-semibold mb-1">Excluir este e todos os futuros</div>
                  <div className="text-xs text-red-100">
                    Todos os agendamentos futuros desta recorrência serão excluídos permanentemente
                  </div>
                </button>
              </div>
            </div>
          )}

          {!temRecorrencia && (
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirmar(false)}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
              >
                Sim, excluir permanentemente
              </button>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

