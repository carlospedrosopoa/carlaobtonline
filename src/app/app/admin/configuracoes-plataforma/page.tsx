// app/app/admin/configuracoes-plataforma/page.tsx - Gerenciar configurações da plataforma
'use client';

import { useEffect, useState } from 'react';
import { Settings, Save, Eye, EyeOff, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface PlatformConfig {
  id: number;
  chave: string;
  valor: string | null;
  descricao: string | null;
  tipo: 'texto' | 'numero' | 'booleano' | 'json';
  categoria: string;
  createdAt: string;
  updatedAt: string;
}

export default function ConfiguracoesPlataformaPage() {
  const [configuracoes, setConfiguracoes] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [valoresEditando, setValoresEditando] = useState<Record<string, string>>({});
  const [mostrarSenhas, setMostrarSenhas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);
      setErro('');
      const response = await fetch('/api/admin/platform-config');
      if (!response.ok) {
        throw new Error('Erro ao carregar configurações');
      }
      const data = await response.json();
      setConfiguracoes(data.configuracoes || []);
      
      // Inicializar valores de edição
      const valoresIniciais: Record<string, string> = {};
      data.configuracoes?.forEach((config: PlatformConfig) => {
        valoresIniciais[config.chave] = config.valor || '';
      });
      setValoresEditando(valoresIniciais);
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      setErro('Erro ao carregar configurações. Verifique se você tem permissão de ADMIN.');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracao = async (chave: string) => {
    try {
      setSalvando(chave);
      setErro('');
      setSucesso('');
      
      const valor = valoresEditando[chave] || '';
      const config = configuracoes.find(c => c.chave === chave);
      
      const response = await fetch(`/api/admin/platform-config/${chave}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valor,
          descricao: config?.descricao,
          tipo: config?.tipo,
          categoria: config?.categoria,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || 'Erro ao salvar configuração');
      }

      const data = await response.json();
      
      // Atualizar a lista de configurações
      setConfiguracoes(prev => 
        prev.map(c => c.chave === chave ? data.configuracao : c)
      );
      
      setSucesso(`Configuração "${chave}" salva com sucesso!`);
      setTimeout(() => setSucesso(''), 3000);
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setErro(error.message || 'Erro ao salvar configuração');
      setTimeout(() => setErro(''), 5000);
    } finally {
      setSalvando(null);
    }
  };

  const toggleMostrarSenha = (chave: string) => {
    setMostrarSenhas(prev => ({
      ...prev,
      [chave]: !prev[chave],
    }));
  };

  const isSenha = (chave: string) => {
    return chave.toLowerCase().includes('key') || 
           chave.toLowerCase().includes('token') || 
           chave.toLowerCase().includes('senha') ||
           chave.toLowerCase().includes('password') ||
           chave.toLowerCase().includes('secret');
  };

  const configuracoesPorCategoria = configuracoes.reduce((acc, config) => {
    if (!acc[config.categoria]) {
      acc[config.categoria] = [];
    }
    acc[config.categoria].push(config);
    return acc;
  }, {} as Record<string, PlatformConfig[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-purple-600" />
            Configurações da Plataforma
          </h1>
          <p className="text-gray-600 mt-2">
            Gerencie as configurações globais da plataforma Play Na Quadra
          </p>
        </div>
        <button
          onClick={carregarConfiguracoes}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {sucesso}
        </div>
      )}

      {Object.keys(configuracoesPorCategoria).length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Nenhuma configuração encontrada. Execute a migration para criar as configurações padrão.
        </div>
      ) : (
        Object.entries(configuracoesPorCategoria).map(([categoria, configs]) => (
          <div key={categoria} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
              {categoria === 'gzappy' ? 'Gzappy (WhatsApp)' : categoria}
            </h2>
            
            <div className="space-y-4">
              {configs.map((config) => {
                const editando = valoresEditando[config.chave] !== undefined;
                const valorAtual = valoresEditando[config.chave] ?? config.valor ?? '';
                const eSenha = isSenha(config.chave);
                const mostrar = mostrarSenhas[config.chave] || false;

                return (
                  <div key={config.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {config.chave}
                        </label>
                        {config.descricao && (
                          <p className="text-xs text-gray-500 mb-2">{config.descricao}</p>
                        )}
                        
                        {config.tipo === 'booleano' ? (
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={valorAtual === 'true'}
                                onChange={(e) => {
                                  setValoresEditando(prev => ({
                                    ...prev,
                                    [config.chave]: e.target.checked ? 'true' : 'false',
                                  }));
                                }}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-700">
                                {valorAtual === 'true' ? 'Ativo' : 'Inativo'}
                              </span>
                            </label>
                            <button
                              onClick={() => salvarConfiguracao(config.chave)}
                              disabled={salvando === config.chave || valorAtual === (config.valor || '')}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                            >
                              {salvando === config.chave ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Salvar
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <input
                                type={eSenha && !mostrar ? 'password' : 'text'}
                                value={valorAtual}
                                onChange={(e) => {
                                  setValoresEditando(prev => ({
                                    ...prev,
                                    [config.chave]: e.target.value,
                                  }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder={`Digite o valor para ${config.chave}`}
                              />
                              {eSenha && (
                                <button
                                  type="button"
                                  onClick={() => toggleMostrarSenha(config.chave)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                  {mostrar ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => salvarConfiguracao(config.chave)}
                              disabled={salvando === config.chave || valorAtual === (config.valor || '')}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm whitespace-nowrap"
                            >
                              {salvando === config.chave ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Salvar
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

