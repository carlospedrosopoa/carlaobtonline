// app/api/professor/me/route.ts - Buscar perfil do professor logado
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarProfessorPorUserId } from '@/lib/professorService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Buscar professor pelo userId do token
    const professor = await buscarProfessorPorUserId(user.id);

    if (!professor) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Perfil de professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar professor com arenas
    const professorComArenas = await buscarProfessorComArenas(professor.id);

    const response = NextResponse.json(professorComArenas, { status: 200 });
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

