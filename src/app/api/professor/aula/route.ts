// app/api/professor/aula/route.ts - Rotas para gerenciar aulas
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { criarAula, listarAulasProfessor } from '@/lib/professorService';
import { buscarProfessorPorUserId } from '@/lib/professorService';

// GET /api/professor/aula - Listar aulas do professor logado
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
    const status = searchParams.get('status');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    const filtros: any = {};
    if (status) filtros.status = status;
    if (dataInicio) filtros.dataInicio = dataInicio;
    if (dataFim) filtros.dataFim = dataFim;

    const aulas = await listarAulasProfessor(professor.id, filtros);

    const response = NextResponse.json(aulas, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar aulas:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao listar aulas' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/professor/aula - Criar nova aula
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
        { mensagem: 'Perfil de professor não encontrado. Crie um perfil de professor primeiro.' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const {
      agendamentoId,
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
      recorrenciaId,
      recorrenciaConfig,
      observacoes,
      materialNecessario,
    } = body;

    // Validações obrigatórias
    if (!agendamentoId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'agendamentoId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!titulo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'titulo é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!tipoAula || !['INDIVIDUAL', 'GRUPO', 'TURMA'].includes(tipoAula)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'tipoAula deve ser INDIVIDUAL, GRUPO ou TURMA' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!dataInicio) {
      const errorResponse = NextResponse.json(
        { mensagem: 'dataInicio é obrigatória' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const novaAula = await criarAula({
      professorId: professor.id,
      agendamentoId,
      titulo,
      descricao: descricao || null,
      tipoAula,
      nivel: nivel || null,
      maxAlunos: maxAlunos || 1,
      valorPorAluno: valorPorAluno || null,
      valorTotal: valorTotal || null,
      status: status || 'AGENDADA',
      dataInicio,
      dataFim: dataFim || null,
      recorrenciaId: recorrenciaId || null,
      recorrenciaConfig: recorrenciaConfig || null,
      observacoes: observacoes || null,
      materialNecessario: materialNecessario || null,
    });

    const response = NextResponse.json(novaAula, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar aula:', error);
    
    // Tratar erros específicos
    if (error.message?.includes('já possui uma aula')) {
      const errorResponse = NextResponse.json(
        { mensagem: error.message },
        { status: 409 } // Conflict
      );
      return withCors(errorResponse, request);
    }

    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao criar aula' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

