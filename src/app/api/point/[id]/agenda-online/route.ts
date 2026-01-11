// app/api/point/[id]/agenda-online/route.ts - Atualizar flag de agenda online da arena (apenas ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// PUT /api/point/[id]/agenda-online - Atualizar flag de agenda online da arena
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

    const { id } = await params;

    // ADMIN ou ORGANIZER (gestor da arena) pode atualizar flag de agenda online
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores ou gestores da arena podem atualizar a flag de agenda online' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Se for ORGANIZER, verificar se é gestor desta arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar esta arena' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }
    const body = await request.json();
    const { agendaOnlineAtivo } = body as { agendaOnlineAtivo: boolean };

    if (typeof agendaOnlineAtivo !== 'boolean') {
      const errorResponse = NextResponse.json(
        { mensagem: 'O campo agendaOnlineAtivo deve ser um booleano' },
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

    // Atualizar flag de agenda online
    try {
      const result = await query(
        `UPDATE "Point" 
         SET "agendaOnlineAtivo" = $1, "updatedAt" = NOW()
         WHERE id = $2
         RETURNING id, nome, "agendaOnlineAtivo", "updatedAt"`,
        [agendaOnlineAtivo, id]
      );

      const response = NextResponse.json({
        mensagem: `Flag de agenda online ${agendaOnlineAtivo ? 'ativada' : 'desativada'} com sucesso`,
        point: result.rows[0],
      });
      return withCors(response, request);
    } catch (error: any) {
      // Se a coluna não existir ainda, retornar erro informativo
      if (error.message?.includes('agendaOnlineAtivo') || error.message?.includes('column') || error.code === '42703') {
        const errorResponse = NextResponse.json(
          { mensagem: 'Coluna agendaOnlineAtivo não encontrada. Execute o script SQL de migração primeiro.' },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Erro ao atualizar flag de agenda online da arena:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar flag de agenda online', error: error.message },
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

