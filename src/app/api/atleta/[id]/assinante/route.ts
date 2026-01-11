// app/api/atleta/[id]/assinante/route.ts - Atualizar flag de assinante do atleta (apenas ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/atleta/[id]/assinante - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

// PUT /api/atleta/[id]/assinante - Atualizar flag de assinante do atleta
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

    // Apenas ADMIN pode atualizar flag de assinante
    if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores podem atualizar a flag de assinante' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body = await request.json();
    const { assinante } = body as { assinante: boolean };

    if (typeof assinante !== 'boolean') {
      const errorResponse = NextResponse.json(
        { mensagem: 'O campo assinante deve ser um booleano' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o atleta existe
    const atletaCheck = await query('SELECT id, nome FROM "Atleta" WHERE id = $1', [id]);
    if (atletaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar flag de assinante
    try {
      const result = await query(
        `UPDATE "Atleta" 
         SET assinante = $1, "updatedAt" = NOW()
         WHERE id = $2
         RETURNING id, nome, assinante, "updatedAt"`,
        [assinante, id]
      );

      const response = NextResponse.json({
        mensagem: `Flag de assinante ${assinante ? 'ativada' : 'desativada'} com sucesso`,
        atleta: result.rows[0],
      });
      return withCors(response, request);
    } catch (error: any) {
      // Se a coluna não existir ainda, retornar erro informativo
      if (error.message?.includes('assinante') || error.message?.includes('column') || error.code === '42703') {
        const errorResponse = NextResponse.json(
          { mensagem: 'Coluna assinante não encontrada. Execute o script SQL de migração primeiro.' },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Erro ao atualizar flag de assinante do atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar flag de assinante', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

