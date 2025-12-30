// app/api/competicao/[id]/reabrir/route.ts - Reabrir competição (mudar status de CONCLUIDA para EM_ANDAMENTO)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// POST /api/competicao/[id]/reabrir - Reabrir competição
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: competicaoId } = await params;

    // Verificar se competição existe e se usuário tem acesso
    const competicaoCheck = await query(
      `SELECT "pointId", status FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );

    if (competicaoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const competicao = competicaoCheck.rows[0];

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicao.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    if (competicao.status !== 'CONCLUIDA') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas competições concluídas podem ser reabertas' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar status da competição para EM_ANDAMENTO
    await query(
      `UPDATE "Competicao" 
       SET status = 'EM_ANDAMENTO', "updatedAt" = NOW() 
       WHERE id = $1`,
      [competicaoId]
    );

    const response = NextResponse.json({
      mensagem: 'Competição reaberta com sucesso!',
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao reabrir competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao reabrir competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

