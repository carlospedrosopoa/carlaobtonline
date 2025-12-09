// app/api/bloqueio-agenda/[id]/route.ts - Rotas de API para BloqueioAgenda individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { AtualizarBloqueioAgendaPayload } from '@/types/agendamento';

// Converter hora "HH:mm" para minutos desde 00:00
function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// GET /api/bloqueio-agenda/[id] - Obter bloqueio específico
export async function GET(
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

    const result = await query(
      `SELECT 
        b.id, b."pointId", b."quadraIds", b.titulo, b.descricao,
        b."dataInicio", b."dataFim", b."horaInicio", b."horaFim",
        b.ativo, b."createdAt", b."updatedAt",
        p.id as "point_id", p.nome as "point_nome"
      FROM "BloqueioAgenda" b
      LEFT JOIN "Point" p ON b."pointId" = p.id
      WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== row.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Sem permissão para acessar este bloqueio' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const bloqueio = {
      id: row.id,
      pointId: row.pointId,
      quadraIds: row.quadraIds, // JSONB já vem como array ou null
      titulo: row.titulo,
      descricao: row.descricao,
      dataInicio: row.dataInicio,
      dataFim: row.dataFim,
      horaInicio: row.horaInicio,
      horaFim: row.horaFim,
      ativo: row.ativo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
    };

    const response = NextResponse.json(bloqueio);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter bloqueio:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter bloqueio', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/bloqueio-agenda/[id] - Atualizar bloqueio
export async function PUT(
  request: NextRequest,
  { params: routeParams }: { params: Promise<{ id: string }> }
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

    // Apenas ADMIN e ORGANIZER podem atualizar bloqueios
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Sem permissão para atualizar bloqueios' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await routeParams;
    const body: AtualizarBloqueioAgendaPayload = await request.json();

    // Buscar bloqueio existente
    const bloqueioCheck = await query(
      `SELECT "pointId" FROM "BloqueioAgenda" WHERE id = $1`,
      [id]
    );

    if (bloqueioCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pointIdAtual = bloqueioCheck.rows[0].pointId;

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointIdAtual) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Sem permissão para atualizar este bloqueio' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (body.quadraIds !== undefined) {
      updates.push(`"quadraIds" = $${paramCount}`);
      params.push(body.quadraIds ? JSON.stringify(body.quadraIds) : null);
      paramCount++;
    }

    if (body.titulo !== undefined) {
      updates.push(`titulo = $${paramCount}`);
      params.push(body.titulo);
      paramCount++;
    }

    if (body.descricao !== undefined) {
      updates.push(`descricao = $${paramCount}`);
      params.push(body.descricao || null);
      paramCount++;
    }

    if (body.dataInicio !== undefined) {
      updates.push(`"dataInicio" = $${paramCount}`);
      params.push(new Date(body.dataInicio).toISOString());
      paramCount++;
    }

    if (body.dataFim !== undefined) {
      updates.push(`"dataFim" = $${paramCount}`);
      params.push(new Date(body.dataFim).toISOString());
      paramCount++;
    }

    if (body.horaInicio !== undefined) {
      updates.push(`"horaInicio" = $${paramCount}`);
      params.push(body.horaInicio ? horaParaMinutos(body.horaInicio) : null);
      paramCount++;
    }

    if (body.horaFim !== undefined) {
      updates.push(`"horaFim" = $${paramCount}`);
      params.push(body.horaFim ? horaParaMinutos(body.horaFim) : null);
      paramCount++;
    }

    if (body.ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      params.push(body.ativo);
      paramCount++;
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Adicionar updatedAt
    updates.push(`"updatedAt" = NOW()`);

    params.push(id);
    const sql = `UPDATE "BloqueioAgenda" SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);
    const bloqueio = result.rows[0];

    // Buscar dados relacionados
    const pointResult = await query(`SELECT id, nome FROM "Point" WHERE id = $1`, [pointIdAtual]);
    const point = pointResult.rows[0];

    const bloqueioCompleto = {
      id: bloqueio.id,
      pointId: bloqueio.pointId,
      quadraIds: bloqueio.quadraIds ? (typeof bloqueio.quadraIds === 'string' ? JSON.parse(bloqueio.quadraIds) : bloqueio.quadraIds) : null,
      titulo: bloqueio.titulo,
      descricao: bloqueio.descricao,
      dataInicio: bloqueio.dataInicio,
      dataFim: bloqueio.dataFim,
      horaInicio: bloqueio.horaInicio,
      horaFim: bloqueio.horaFim,
      ativo: bloqueio.ativo,
      createdAt: bloqueio.createdAt,
      updatedAt: bloqueio.updatedAt,
      point: point ? { id: point.id, nome: point.nome } : null,
    };

    const response = NextResponse.json(bloqueioCompleto);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar bloqueio:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar bloqueio', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/bloqueio-agenda/[id] - Deletar bloqueio
export async function DELETE(
  request: NextRequest,
  { params: routeParams }: { params: Promise<{ id: string }> }
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

    // Apenas ADMIN e ORGANIZER podem deletar bloqueios
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Sem permissão para deletar bloqueios' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await routeParams;

    // Buscar bloqueio para verificar permissões
    const bloqueioCheck = await query(
      `SELECT "pointId" FROM "BloqueioAgenda" WHERE id = $1`,
      [id]
    );

    if (bloqueioCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pointId = bloqueioCheck.rows[0].pointId;

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Sem permissão para deletar este bloqueio' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    await query(`DELETE FROM "BloqueioAgenda" WHERE id = $1`, [id]);

    const response = NextResponse.json({ mensagem: 'Bloqueio deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar bloqueio:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar bloqueio', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

