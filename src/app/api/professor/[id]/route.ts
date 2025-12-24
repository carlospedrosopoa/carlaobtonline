// app/api/professor/[id]/route.ts - Rotas para um professor específico
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarProfessorPorId, atualizarProfessor } from '@/lib/professorService';

// GET /api/professor/[id] - Buscar professor por ID
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

    const professor = await buscarProfessorPorId(id);

    if (!professor) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões: ADMIN pode ver qualquer professor
    // PROFESSOR só pode ver seu próprio perfil
    if (user.role !== 'ADMIN' && professor.userId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(professor, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao buscar professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao buscar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/professor/[id] - Atualizar professor
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

    // Verificar se o professor existe e se o usuário tem permissão
    const professorExistente = await buscarProfessorPorId(id);

    if (!professorExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões: ADMIN pode atualizar qualquer professor
    // PROFESSOR só pode atualizar seu próprio perfil
    if (user.role !== 'ADMIN' && professorExistente.userId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Você só pode atualizar seu próprio perfil.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const {
      especialidade,
      bio,
      valorHora,
      telefoneProfissional,
      emailProfissional,
      ativo,
      aceitaNovosAlunos,
    } = body;

    // PROFESSOR não pode alterar seu próprio status ativo (apenas ADMIN)
    const dadosAtualizacao: any = {};
    if (especialidade !== undefined) dadosAtualizacao.especialidade = especialidade || null;
    if (bio !== undefined) dadosAtualizacao.bio = bio || null;
    if (valorHora !== undefined) dadosAtualizacao.valorHora = valorHora || null;
    if (telefoneProfissional !== undefined) dadosAtualizacao.telefoneProfissional = telefoneProfissional || null;
    if (emailProfissional !== undefined) dadosAtualizacao.emailProfissional = emailProfissional || null;
    if (aceitaNovosAlunos !== undefined) dadosAtualizacao.aceitaNovosAlunos = aceitaNovosAlunos;

    // Apenas ADMIN pode alterar status ativo
    if (user.role === 'ADMIN' && ativo !== undefined) {
      dadosAtualizacao.ativo = ativo;
    }

    const professorAtualizado = await atualizarProfessor(id, dadosAtualizacao);

    const response = NextResponse.json(professorAtualizado, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao atualizar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

