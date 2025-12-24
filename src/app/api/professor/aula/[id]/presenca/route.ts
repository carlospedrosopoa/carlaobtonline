// app/api/professor/aula/[id]/presenca/route.ts - Marcar presença dos alunos
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarAulaPorId, listarAlunosDaAula, marcarPresenca } from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';

// POST /api/professor/aula/[id]/presenca - Marcar presença de alunos
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id: aulaId } = params;

    // Verificar se a aula existe e se o usuário tem permissão
    const aula = await buscarAulaPorId(aulaId);

    if (!aula) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Aula não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões: ADMIN ou o próprio professor podem marcar presença
    if (user.role !== 'ADMIN') {
      const professor = await buscarProfessorPorUserId(user.id);
      if (!professor || aula.professorId !== professor.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Acesso negado. Apenas o professor da aula pode marcar presença.' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const body = await request.json();
    const { presencas } = body; // Array de { inscricaoId: string, presente: boolean }

    if (!Array.isArray(presencas)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'presencas deve ser um array de objetos com inscricaoId e presente' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Marcar presença de cada aluno
    const resultados = await Promise.all(
      presencas.map(async (item: { inscricaoId: string; presente: boolean }) => {
        if (!item.inscricaoId || typeof item.presente !== 'boolean') {
          throw new Error('Cada item deve ter inscricaoId (string) e presente (boolean)');
        }
        return await marcarPresenca(item.inscricaoId, item.presente);
      })
    );

    // Retornar lista atualizada de alunos
    const alunosAtualizados = await listarAlunosDaAula(aulaId);

    const response = NextResponse.json(
      { mensagem: 'Presenças marcadas com sucesso', alunos: alunosAtualizados },
      { status: 200 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao marcar presença:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao marcar presença' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

