// app/dashboard/page.tsx - Dashboard completo
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Atleta, Partida } from '@/types/domain';
import MinhasPartidasCompacta from '@/components/MinhasPartidasCompacta';
import QuadrasDisponiveis from '@/components/QuadrasDisponiveis';
import EditarAgendamentoModal from '@/components/EditarAgendamentoModal';

export default function DashboardPage() {
  const [atleta, setAtleta] = useState<Atleta | null>(null);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [quadraIdParaAgendar, setQuadraIdParaAgendar] = useState<string | null>(null);
  const router = useRouter();
  const { usuario, authReady } = useAuth();

  useEffect(() => {
    console.log('Dashboard useEffect - authReady:', authReady, 'usuario:', usuario);
    
    if (!authReady) {
      console.log('Aguardando authReady...');
      return;
    }
    
    if (!usuario) {
      console.log('Sem usuário, redirecionando para login');
      router.push('/login');
      return;
    }
    
    console.log('Buscar atleta iniciado...');
    buscarAtleta();
  }, [authReady, usuario, router]);

  useEffect(() => {
    if (atleta?.id) {
      carregarPartidas();
    }
  }, [atleta?.id]);

  const buscarAtleta = async () => {
    try {
      const res = await api.get('/atleta/me/atleta');
      console.log('Resposta buscarAtleta:', res);
      
      if (res.status === 200 && res.data) {
        setAtleta(res.data);
      } else if (res.status === 204 || res.status === 404) {
        // Não tem atleta ainda - não redireciona automaticamente, apenas não mostra dados
        console.log('Usuário não tem atleta cadastrado ainda');
        setAtleta(null);
      }
    } catch (error: any) {
      console.error('Erro ao buscar atleta', error);
      // 204 ou 404 = não tem atleta ainda (isso é ok)
      if (error?.status === 404 || error?.status === 204) {
        console.log('Usuário não tem atleta cadastrado ainda');
        setAtleta(null);
      } else {
        // Outro erro - mostra erro mas não bloqueia a tela
        console.error('Erro inesperado ao buscar atleta:', error);
      }
    } finally {
      setCarregando(false);
    }
  };

  const carregarPartidas = async () => {
    if (!atleta?.id) {
      console.log('Sem atleta ID, não carrega partidas');
      return;
    }
    
    try {
      console.log('Carregando partidas para atleta:', atleta.id);
      const res = await api.get('/partida/listarPartidas');
      console.log('Resposta listarPartidas:', res);
      
      const todas = Array.isArray(res.data) ? res.data : [];
      const doAtleta = todas
        .filter((p: Partida) =>
          [p.atleta1?.id, p.atleta2?.id, p.atleta3?.id, p.atleta4?.id].includes(atleta.id)
        )
        .sort((a: Partida, b: Partida) => new Date(b.data).getTime() - new Date(a.data).getTime());
      
      console.log('Partidas do atleta:', doAtleta.length);
      setPartidas(doAtleta);
    } catch (err) {
      console.error('Erro ao carregar partidas', err);
      setPartidas([]); // Garante que não fica undefined
    }
  };

  if (carregando || !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>

      {/* Seção de Quadras Disponíveis - Sempre visível para USER */}
      {usuario?.role === 'USER' && (
        <QuadrasDisponiveis
          onAgendar={(quadraId) => {
            setQuadraIdParaAgendar(quadraId);
            setModalAgendamentoAberto(true);
          }}
        />
      )}

      {/* Modal de Agendamento */}
      {usuario?.role === 'USER' && (
        <EditarAgendamentoModal
          isOpen={modalAgendamentoAberto}
          agendamento={null}
          quadraIdInicial={quadraIdParaAgendar || undefined}
          onClose={() => {
            setModalAgendamentoAberto(false);
            setQuadraIdParaAgendar(null);
          }}
          onSuccess={() => {
            setModalAgendamentoAberto(false);
            setQuadraIdParaAgendar(null);
            // Recarregar dados se necessário
          }}
        />
      )}

      {/* Seção de Partidas - Apenas se tiver perfil de atleta */}
      {atleta ? (
        <>
          <MinhasPartidasCompacta
            partidas={partidas}
            atletaId={atleta.id}
            onAbrirTodas={() => {
              // TODO: Mostrar todas as partidas ou navegar para página dedicada
              console.log('Abrir todas as partidas');
            }}
            onAtualizarPlacar={(p) => {
              // TODO: Abrir modal de atualizar placar
              console.log('Atualizar placar:', p);
            }}
            onNovaPartida={carregarPartidas}
            pageSize={5}
          />
        </>
      ) : usuario?.role === 'USER' ? (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-600 mb-4">Você ainda não tem um perfil de atleta.</p>
          <button
            onClick={() => router.push('/preencher-perfil-atleta')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Criar Perfil de Atleta
          </button>
        </div>
      ) : null}
    </div>
  );
}