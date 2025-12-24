// app/api/professor/alunos/route.ts - Rotas para gerenciar alunos do professor
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { listarAlunosDoProfessor, criarAlunoProfessor } from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';

// GET /api/professor/alunos - Listar alunos do professor logado
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Buscar professor pelo userId
    const professor = await buscarProfessorPorUserId(user.id);

    if (!professor) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Perfil de professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar filtros na query string
    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get('apenasAtivos') !== 'false'; // default true

    const alunos = await listarAlunosDoProfessor(professor.id, apenasAtivos);

    const response = NextResponse.json(alunos, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar alunos do professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao listar alunos' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/professor/alunos - Criar relação professor-aluno
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Buscar professor pelo userId
    const professor = await buscarProfessorPorUserId(user.id);

    if (!professor) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Perfil de professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { atletaId, nivel, observacoes } = body;

    if (!atletaId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'atletaId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const relacao = await criarAlunoProfessor(professor.id, atletaId, {
      nivel: nivel || null,
      observacoes: observacoes || null,
    });

    const response = NextResponse.json(relacao, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar relação professor-aluno:', error);
    
    if (error.message?.includes('já existe')) {
      const errorResponse = NextResponse.json(
        { mensagem: error.message },
        { status: 409 }
      );
      return withCors(errorResponse, request);
    }

    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao criar relação' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

