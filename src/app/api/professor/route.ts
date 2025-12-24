// app/api/professor/route.ts - Rotas para gerenciar professores
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { criarProfessor, listarProfessores } from '@/lib/professorService';

// GET /api/professor - Listar professores
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Apenas ADMIN pode listar todos os professores
    // PROFESSOR pode ver apenas seu próprio perfil (via /api/professor/me)
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem listar professores.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar filtros opcionais na query string
    const { searchParams } = new URL(request.url);
    const ativo = searchParams.get('ativo');
    const aceitaNovosAlunos = searchParams.get('aceitaNovosAlunos');

    const filtros: any = {};
    if (ativo !== null) filtros.ativo = ativo === 'true';
    if (aceitaNovosAlunos !== null) filtros.aceitaNovosAlunos = aceitaNovosAlunos === 'true';

    const professores = await listarProfessores(filtros);

    const response = NextResponse.json(professores, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar professores:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao listar professores' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/professor - Criar perfil de professor
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Verificar se o usuário tem role PROFESSOR ou ADMIN
    if (user.role !== 'PROFESSOR' && user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas usuários com role PROFESSOR podem criar perfil de professor.' },
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

    // Se for ADMIN criando para outro usuário, precisa passar userId
    // Se for PROFESSOR criando para si mesmo, usa o userId do token
    const userIdParaCriar = body.userId || user.id;

    // ADMIN pode criar para qualquer usuário, mas precisa passar userId
    if (user.role === 'ADMIN' && !body.userId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Ao criar professor como ADMIN, é necessário informar o userId.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // PROFESSOR só pode criar para si mesmo
    if (user.role === 'PROFESSOR' && body.userId && body.userId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você só pode criar perfil de professor para você mesmo.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const novoProfessor = await criarProfessor(userIdParaCriar, {
      especialidade: especialidade || null,
      bio: bio || null,
      valorHora: valorHora || null,
      telefoneProfissional: telefoneProfissional || null,
      emailProfissional: emailProfissional || null,
      ativo: ativo !== undefined ? ativo : true,
      aceitaNovosAlunos: aceitaNovosAlunos !== undefined ? aceitaNovosAlunos : true,
    });

    const response = NextResponse.json(novoProfessor, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar professor:', error);
    
    // Tratar erro de professor já existente
    if (error.message?.includes('já possui perfil')) {
      const errorResponse = NextResponse.json(
        { mensagem: error.message },
        { status: 409 } // Conflict
      );
      return withCors(errorResponse, request);
    }

    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao criar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

