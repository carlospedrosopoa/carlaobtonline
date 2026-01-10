// app/api/point/[id]/pagamento-online/route.ts - Atualizar flag de pagamento online da arena (apenas ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// PUT /api/point/[id]/pagamento-online - Atualizar flag de pagamento online da arena
export async function PUT(
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

    // Apenas ADMIN pode atualizar flag de pagamento online
    if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores podem atualizar a flag de pagamento online' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body = await request.json();
    const { pagamentoOnlineAtivo } = body as { pagamentoOnlineAtivo: boolean };

    if (typeof pagamentoOnlineAtivo !== 'boolean') {
      const errorResponse = NextResponse.json(
        { mensagem: 'O campo pagamentoOnlineAtivo deve ser um booleano' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o point existe
    const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [id]);
    if (pointCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Arena não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar flag de pagamento online
    try {
      const result = await query(
        `UPDATE "Point" 
         SET "pagamentoOnlineAtivo" = $1, "updatedAt" = NOW()
         WHERE id = $2
         RETURNING id, nome, "pagamentoOnlineAtivo", "updatedAt"`,
        [pagamentoOnlineAtivo, id]
      );

      const response = NextResponse.json({
        mensagem: `Flag de pagamento online ${pagamentoOnlineAtivo ? 'ativada' : 'desativada'} com sucesso`,
        point: result.rows[0],
      });
      return withCors(response, request);
    } catch (error: any) {
      // Se a coluna não existir ainda, retornar erro informativo
      if (error.message?.includes('pagamentoOnlineAtivo') || error.message?.includes('column') || error.code === '42703') {
        const errorResponse = NextResponse.json(
          { mensagem: 'Coluna pagamentoOnlineAtivo não encontrada. Execute o script SQL de migração primeiro.' },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Erro ao atualizar flag de pagamento online da arena:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar flag de pagamento online', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  const response = withCors(new NextResponse(null, { status: 204 }), request);
  return response;
}

