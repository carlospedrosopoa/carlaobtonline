// app/api/professor/aula/[id]/avaliacao/route.ts - Rotas para avaliações de alunos
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { 
  buscarAulaPorId, 
  criarAvaliacaoAluno, 
  listarAvaliacoesDaAula 
} from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';

// GET /api/professor/aula/[id]/avaliacao - Listar avaliações de uma aula
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

    const avaliacoes = await listarAvaliacoesDaAula(aulaId);

    const response = NextResponse.json(avaliacoes, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar avaliações:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao listar avaliações' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/professor/aula/[id]/avaliacao - Criar avaliação de aluno
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

    // Verificar permissões: ADMIN ou o próprio professor podem criar avaliações
    if (user.role !== 'ADMIN') {
      const professor = await buscarProfessorPorUserId(user.id);
      if (!professor || aula.professorId !== professor.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Acesso negado. Apenas o professor da aula pode criar avaliações.' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const body = await request.json();
    const {
      atletaId,
      nota,
      comentario,
      pontosPositivos,
      pontosMelhorar,
      tecnica,
      fisico,
      comportamento,
    } = body;

    if (!atletaId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'atletaId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Usar o professorId da aula
    const avaliacao = await criarAvaliacaoAluno({
      aulaId,
      professorId: aula.professorId,
      atletaId,
      nota: nota || null,
      comentario: comentario || null,
      pontosPositivos: pontosPositivos || null,
      pontosMelhorar: pontosMelhorar || null,
      tecnica: tecnica || null,
      fisico: fisico || null,
      comportamento: comportamento || null,
    });

    const response = NextResponse.json(avaliacao, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar avaliação:', error);
    
    if (error.message?.includes('já existe')) {
      const errorResponse = NextResponse.json(
        { mensagem: error.message },
        { status: 409 }
      );
      return withCors(errorResponse, request);
    }

    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao criar avaliação' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

