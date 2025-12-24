// app/api/professor/aula/[id]/alunos/route.ts - Rotas para gerenciar alunos de uma aula
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarAlunosDaAula, buscarAulaPorId } from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';
import { inscreverAlunoEmAula } from '@/lib/professorService';

// GET /api/professor/aula/[id]/alunos - Listar alunos de uma aula
export async function GET(
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

    // Verificar permissões
    if (user.role !== 'ADMIN') {
      const professor = await buscarProfessorPorUserId(user.id);
      if (!professor || aula.professorId !== professor.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Acesso negado' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const alunos = await listarAlunosDaAula(aulaId);

    const response = NextResponse.json(alunos, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar alunos da aula:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao listar alunos' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/professor/aula/[id]/alunos - Inscrever aluno em uma aula
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

    // Verificar permissões: ADMIN ou o próprio professor podem inscrever alunos
    if (user.role !== 'ADMIN') {
      const professor = await buscarProfessorPorUserId(user.id);
      if (!professor || aula.professorId !== professor.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Acesso negado. Apenas o professor da aula pode inscrever alunos.' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const body = await request.json();
    const { atletaId, statusInscricao, valorPago, valorDevido } = body;

    if (!atletaId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'atletaId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const inscricao = await inscreverAlunoEmAula({
      aulaId,
      atletaId,
      statusInscricao: statusInscricao || 'CONFIRMADO',
      valorPago: valorPago || null,
      valorDevido: valorDevido || null,
    });

    const response = NextResponse.json(inscricao, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao inscrever aluno:', error);
    
    // Tratar erros específicos
    if (error.message?.includes('já está inscrito') || error.message?.includes('lotada')) {
      const errorResponse = NextResponse.json(
        { mensagem: error.message },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao inscrever aluno' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

