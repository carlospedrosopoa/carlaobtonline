// app/app/arena/atletas/page.tsx - Lista de Atletas para Organizer
'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { pointService } from '@/services/agendamentoService';
import type { Point } from '@/types/agendamento';
import { Crown, UserPlus, Phone, MessageCircle, Copy, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Atleta {
  id: string;
  nome: string;
  dataNascimento: string;
  genero?: string;
  categoria?: string;
  idade?: number;
  fotoUrl?: string;
  fone?: string;
  usuarioId: string;
  assinante?: boolean;
  usuarioEmail?: string;
  usuario?: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
}

interface ModalCriarUsuarioIncompletoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalCriarUsuarioIncompleto({ isOpen, onClose, onSuccess }: ModalCriarUsuarioIncompletoProps) {
  const { usuario } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [atletaEncontrado, setAtletaEncontrado] = useState<{ id: string; nome: string; telefone: string } | null>(null);
  const [modo, setModo] = useState<'buscar' | 'criar' | 'vincular'>('buscar');
  const telefoneInputRef = useRef<HTMLInputElement>(null);

  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  const handleBuscarTelefone = async () => {
    if (!telefone.trim()) {
      setErro('Informe o telefone');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setBuscando(true);
    setErro('');
    setAtletaEncontrado(null);

    try {
      // Buscar atleta por telefone
      const { data, status } = await api.post('/user/atleta/buscar-por-telefone', {
        telefone: telefoneNormalizado,
      });

      if (status === 200 && data.existe) {
        // Atleta encontrado - mostrar opção de vincular
        setAtletaEncontrado({
          id: data.id,
          nome: data.nome,
          telefone: data.telefone,
        });
        setModo('vincular');
      } else {
        // Atleta não encontrado - modo criar
        setModo('criar');
      }
    } catch (err: any) {
      if (err?.response?.data?.codigo === 'ATLETA_NAO_ENCONTRADO' || err?.response?.status === 404) {
        // Atleta não encontrado - modo criar
        setModo('criar');
      } else {
        setErro(err?.response?.data?.mensagem || 'Erro ao buscar telefone. Tente novamente.');
      }
    } finally {
      setBuscando(false);
    }
  };

  const handleVincularAtleta = async () => {
    if (!atletaEncontrado) return;

    setSalvando(true);
    setErro('');

    try {
      const { data, status } = await api.post(`/atleta/${atletaEncontrado.id}/vincular-arena`);

      if (status === 200) {
        alert(`Atleta "${atletaEncontrado.nome}" vinculado à arena com sucesso!`);
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao vincular atleta');
      }
    } catch (err: any) {
      // Tratar caso especial: atleta já vinculado
      if (err?.response?.data?.codigo === 'ATLETA_JA_VINCULADO' || err?.response?.data?.jaVinculado) {
        // Mostrar mensagem informativa (não é erro crítico)
        alert(err?.response?.data?.mensagem || `O atleta "${atletaEncontrado.nome}" já está vinculado à sua arena.`);
        resetarModal();
        onClose();
      } else {
        setErro(
          err?.response?.data?.mensagem ||
            err?.response?.data?.error ||
            'Erro ao vincular atleta. Tente novamente.'
        );
        console.error('Erro ao vincular atleta:', err);
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (!nome.trim() || !telefone.trim()) {
      setErro('Nome e telefone são obrigatórios');
      return;
    }

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (telefoneNormalizado.length < 10) {
      setErro('Telefone inválido. Informe pelo menos 10 dígitos.');
      return;
    }

    setSalvando(true);
    try {
      const { data, status } = await api.post('/user/criar-incompleto', {
        name: nome.trim(),
        telefone: telefoneNormalizado,
      });

      if (status === 201) {
        alert('Usuário criado com sucesso! Ele poderá completar o cadastro usando o telefone no appatleta.');
        resetarModal();
        onSuccess();
        onClose();
      } else {
        setErro(data.mensagem || 'Erro ao criar usuário');
      }
    } catch (err: any) {
      setErro(
        err?.response?.data?.mensagem ||
          err?.response?.data?.error ||
          'Erro ao criar usuário. Verifique os dados.'
      );
      console.error('Erro ao criar usuário incompleto:', err);
    } finally {
      setSalvando(false);
    }
  };

  const resetarModal = () => {
    setNome('');
    setTelefone('');
    setErro('');
    setAtletaEncontrado(null);
    setModo('buscar');
  };

  const handleClose = () => {
    resetarModal();
    onClose();
  };

  // Focar no campo de telefone quando a modal abrir no modo buscar
  useEffect(() => {
    if (isOpen && modo === 'buscar' && telefoneInputRef.current) {
      // Pequeno delay para garantir que a modal está renderizada
      setTimeout(() => {
        telefoneInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, modo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-lg"
          onClick={handleClose}
          disabled={salvando || buscando}
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold mb-4">Criar / Vincular Atleta</h3>

        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {erro}
          </div>
        )}

        {modo === 'buscar' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Informe o telefone do atleta. Se ele já estiver cadastrado, você poderá vinculá-lo à sua arena.
            </p>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={telefoneInputRef}
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={buscando}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={buscando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBuscarTelefone}
                disabled={buscando || telefone.replace(/\D/g, '').length < 10}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        )}

        {modo === 'vincular' && atletaEncontrado && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Atleta encontrado:</strong>
              </p>
              <p className="text-lg font-semibold text-gray-900">{atletaEncontrado.nome}</p>
              <p className="text-sm text-gray-600 mt-1">Telefone: {formatarTelefone(atletaEncontrado.telefone)}</p>
            </div>

            <p className="text-sm text-gray-600">
              Deseja vincular este atleta à sua arena? Ele aparecerá na sua lista de atletas.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setAtletaEncontrado(null);
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleVincularAtleta}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Vinculando...' : 'Vincular à Arena'}
              </button>
            </div>
          </div>
        )}

        {modo === 'criar' && (
          <form onSubmit={handleCriarUsuario} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Telefone não encontrado. Crie um novo usuário pendente que poderá se vincular posteriormente usando o telefone no appatleta.
            </p>

            <div>
              <label className="block font-semibold mb-1">Nome completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nome do usuário"
                required
                disabled={salvando}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    if (apenasNumeros.length <= 11) {
                      setTelefone(apenasNumeros);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                  placeholder="(00) 00000-0000"
                  required
                  disabled={salvando}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O usuário usará este telefone para vincular a conta no appatleta
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModo('buscar');
                  setNome('');
                }}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {salvando ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ArenaAtletasPage() {
  const { usuario } = useAuth();
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalCriarUsuarioIncompleto, setModalCriarUsuarioIncompleto] = useState(false);
  const [linkVinculo, setLinkVinculo] = useState<{ atletaId: string; link: string; nome: string } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    fetchAtletas();
  }, []);

  const isAtletaPendente = (atleta: Atleta): boolean => {
    // Atleta pendente se não tem usuarioId OU tem email temporário
    if (!atleta.usuarioId) return true;
    
    // Verificar email diretamente no atleta ou dentro do objeto usuario
    const email = atleta.usuarioEmail || atleta.usuario?.email;
    if (email) {
      return email.startsWith('temp_') && email.endsWith('@pendente.local');
    }
    return false;
  };

  const fetchAtletas = async () => {
    try {
      setCarregando(true);
      const { data } = await api.get('/atleta/listarAtletas');
      const atletasArray = Array.isArray(data) ? data : data.atletas || [];
      // Ordenar alfabeticamente por nome
      atletasArray.sort((a: Atleta, b: Atleta) => a.nome.localeCompare(b.nome, 'pt-BR'));
      // Debug: verificar se usuarioEmail está sendo retornado
      console.log('Atletas carregados:', atletasArray.map((a: Atleta) => ({
        nome: a.nome,
        usuarioId: a.usuarioId,
        usuarioEmail: a.usuarioEmail,
        usuario: a.usuario,
        isPendente: isAtletaPendente(a)
      })));
      // Debug específico para Chico
      const chico = atletasArray.find((a: Atleta) => a.nome === 'Chico');
      if (chico) {
        console.log('CHICO DEBUG COMPLETO:', {
          ...chico,
          temUsuarioId: !!chico.usuarioId,
          temUsuarioEmail: !!chico.usuarioEmail,
          temUsuario: !!chico.usuario,
          usuarioEmailDoUsuario: chico.usuario?.email,
          isPendente: isAtletaPendente(chico)
        });
      }
      setAtletas(atletasArray);
    } catch (err: any) {
      console.error('Erro ao buscar atletas:', err);
    } finally {
      setCarregando(false);
    }
  };

  const gerarLinkVinculo = async (atletaId: string) => {
    try {
      const { data } = await api.get(`/atleta/${atletaId}/link-vinculo`);
      setLinkVinculo({
        atletaId,
        link: data.link,
        nome: data.nome,
      });
    } catch (err: any) {
      console.error('Erro ao gerar link:', err);
      alert(err?.response?.data?.mensagem || 'Erro ao gerar link de vínculo');
    }
  };

  const copiarLink = async () => {
    if (!linkVinculo) return;
    
    try {
      await navigator.clipboard.writeText(linkVinculo.link);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao copiar link. Tente novamente.');
    }
  };

  const enviarWhatsApp = async (atletaId: string, telefone: string, nome: string) => {
    if (!usuario?.pointIdGestor) {
      alert('Você precisa estar associado a uma arena para enviar WhatsApp.');
      return;
    }

    setEnviandoWhatsApp(atletaId);
    
    try {
      // Gerar link primeiro
      const { data } = await api.get(`/atleta/${atletaId}/link-vinculo`);
      const link = data.link;

      // Formatar mensagem
      const mensagem = `Olá ${nome}!\n\nVocê foi cadastrado na nossa plataforma. Para completar seu cadastro e acessar o app, clique no link abaixo:\n\n${link}\n\nOu acesse o app e informe seu telefone: ${telefone}`;

      // Enviar via Gzappy
      const { gzappyService } = await import('@/services/gzappyService');
      const resultado = await gzappyService.enviar({
        destinatario: telefone,
        mensagem,
        tipo: 'texto',
        pointId: usuario.pointIdGestor,
      });

      if (resultado.sucesso) {
        alert(`Link enviado com sucesso para ${nome}!`);
      } else {
        alert(`Erro ao enviar WhatsApp: ${resultado.mensagem}`);
      }
    } catch (err: any) {
      console.error('Erro ao enviar WhatsApp:', err);
      alert(err?.response?.data?.mensagem || 'Erro ao enviar WhatsApp. Tente novamente.');
    } finally {
      setEnviandoWhatsApp(null);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Atletas</h1>
        <div className="animate-pulse bg-gray-100 h-64 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Atletas</h1>
          <p className="text-sm text-gray-600">Gerencie os perfis de atletas cadastrados</p>
        </div>
        {(usuario?.role === 'ADMIN' || usuario?.role === 'ORGANIZER') && (
          <button
            onClick={() => setModalCriarUsuarioIncompleto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <UserPlus className="w-5 h-5" />
            Criar / Vincular Atleta
          </button>
        )}
      </div>

      {atletas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600">Nenhum atleta cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {atletas.map((atleta) => (
            <div
              key={atleta.id}
              className="bg-white shadow-md rounded-2xl p-4 flex flex-col items-center"
            >
              {atleta.fotoUrl ? (
                <img
                  src={atleta.fotoUrl}
                  alt={atleta.nome}
                  className="w-32 h-32 object-cover rounded-full mb-2 border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-2 border-4 border-white shadow-lg">
                  <svg
                    className="w-16 h-16 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900">{atleta.nome}</h2>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>Idade: {atleta.idade ?? '—'}</p>
                <p>Categoria: {atleta.categoria ?? '—'}</p>
                <p>Gênero: {atleta.genero ?? '—'}</p>
                {atleta.fone && (
                  <p className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {atleta.fone}
                  </p>
                )}
              </div>

              {atleta.assinante && (
                <div className="mt-3 w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Crown className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Assinante</span>
                  </div>
                </div>
              )}

              {/* Botões de ação para atletas pendentes (sem usuário vinculado ou com email temporário) */}
              {atleta.fone && isAtletaPendente(atleta) && (
                <div className="mt-4 w-full space-y-2">
                  <button
                    onClick={() => gerarLinkVinculo(atleta.id)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Gerar Link de Vínculo
                  </button>
                  {linkVinculo?.atletaId === atleta.id && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">Link de vínculo:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={linkVinculo.link}
                          readOnly
                          className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={copiarLink}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs flex items-center gap-1"
                          title="Copiar link"
                        >
                          {linkCopiado ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => enviarWhatsApp(atleta.id, atleta.fone!, atleta.nome)}
                    disabled={enviandoWhatsApp === atleta.id}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {enviandoWhatsApp === atleta.id ? 'Enviando...' : 'Enviar Link por WhatsApp'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ModalCriarUsuarioIncompleto
        isOpen={modalCriarUsuarioIncompleto}
        onClose={() => setModalCriarUsuarioIncompleto(false)}
        onSuccess={() => {
          fetchAtletas();
        }}
      />
    </div>
  );
}

