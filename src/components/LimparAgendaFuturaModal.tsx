// components/LimparAgendaFuturaModal.tsx - Modal para confirmar limpeza de agenda futura
'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { AlertTriangle, Calendar, Lock } from 'lucide-react';

interface LimparAgendaFuturaModalProps {
  isOpen: boolean;
  dataLimite: Date;
  onClose: () => void;
  onConfirmar: (dataLimite: Date, senha: string) => Promise<void>;
  carregando?: boolean;
  erro?: string;
}

export default function LimparAgendaFuturaModal({
  isOpen,
  dataLimite: dataLimiteInicial,
  onClose,
  onConfirmar,
  carregando = false,
  erro,
}: LimparAgendaFuturaModalProps) {
  const [senha, setSenha] = useState('');
  const [dataLimite, setDataLimite] = useState<Date>(dataLimiteInicial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha.trim()) {
      return;
    }
    await onConfirmar(dataLimite, senha);
    // Limpar senha após confirmação (sucesso ou erro)
    if (!carregando) {
      setSenha('');
    }
  };

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novaData = new Date(e.target.value);
    novaData.setHours(0, 0, 0, 0);
    setDataLimite(novaData);
  };

  const handleClose = () => {
    setSenha('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                Limpar Agenda Futura
              </Dialog.Title>
              <p className="text-sm text-gray-600">
                Esta ação irá deletar permanentemente todos os agendamentos a partir da data selecionada.
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Data Limite</span>
            </div>
            <input
              type="date"
              value={dataLimite.toISOString().split('T')[0]}
              onChange={handleDataChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all mb-3"
              disabled={carregando}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-sm text-gray-900 mb-2">
              {dataLimite.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-red-600 font-medium">
              ⚠️ Todos os agendamentos a partir desta data serão deletados permanentemente!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Digite sua senha para confirmar
                </div>
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
                disabled={carregando}
                autoFocus
              />
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{erro}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={carregando}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={carregando || !senha.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {carregando ? 'Deletando...' : 'Confirmar e Deletar'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

