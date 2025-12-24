// app/api/professor/aula/[id]/route.ts - Rotas para uma aula específica
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarAulaPorId, atualizarAula } from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';

// GET /api/professor/aula/[id] - Buscar aula por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    const aula = await buscarAulaPorId(id);

    if (!aula) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Aula não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões: ADMIN pode ver qualquer aula
    // PROFESSOR só pode ver suas próprias aulas
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

    const response = NextResponse.json(aula, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao buscar aula:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao buscar aula' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/professor/aula/[id] - Atualizar aula
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    // Verificar se a aula existe e se o usuário tem permissão
    const aulaExistente = await buscarAulaPorId(id);

    if (!aulaExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Aula não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    if (user.role !== 'ADMIN') {
      const professor = await buscarProfessorPorUserId(user.id);
      if (!professor || aulaExistente.professorId !== professor.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Acesso negado. Você só pode atualizar suas próprias aulas.' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const body = await request.json();
    const {
      titulo,
      descricao,
      tipoAula,
      nivel,
      maxAlunos,
      valorPorAluno,
      valorTotal,
      status,
      dataInicio,
      dataFim,
      observacoes,
      materialNecessario,
    } = body;

    const dadosAtualizacao: any = {};
    if (titulo !== undefined) dadosAtualizacao.titulo = titulo;
    if (descricao !== undefined) dadosAtualizacao.descricao = descricao || null;
    if (tipoAula !== undefined) dadosAtualizacao.tipoAula = tipoAula;
    if (nivel !== undefined) dadosAtualizacao.nivel = nivel || null;
    if (maxAlunos !== undefined) dadosAtualizacao.maxAlunos = maxAlunos;
    if (valorPorAluno !== undefined) dadosAtualizacao.valorPorAluno = valorPorAluno || null;
    if (valorTotal !== undefined) dadosAtualizacao.valorTotal = valorTotal || null;
    if (status !== undefined) dadosAtualizacao.status = status;
    if (dataInicio !== undefined) dadosAtualizacao.dataInicio = dataInicio;
    if (dataFim !== undefined) dadosAtualizacao.dataFim = dataFim || null;
    if (observacoes !== undefined) dadosAtualizacao.observacoes = observacoes || null;
    if (materialNecessario !== undefined) dadosAtualizacao.materialNecessario = materialNecessario || null;

    const aulaAtualizada = await atualizarAula(id, dadosAtualizacao);

    const response = NextResponse.json(aulaAtualizada, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar aula:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao atualizar aula' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

