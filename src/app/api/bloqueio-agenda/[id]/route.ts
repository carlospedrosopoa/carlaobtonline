// app/api/bloqueio-agenda/[id]/route.ts - Rotas de API para BloqueioAgenda individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
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
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== row.pointId) {
      return NextResponse.json(
        { mensagem: 'Sem permissão para acessar este bloqueio' },
        { status: 403 }
      );
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

    return NextResponse.json(bloqueio);
  } catch (error: any) {
    console.error('Erro ao obter bloqueio:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter bloqueio', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/bloqueio-agenda/[id] - Atualizar bloqueio
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem atualizar bloqueios
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Sem permissão para atualizar bloqueios' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: AtualizarBloqueioAgendaPayload = await request.json();

    // Buscar bloqueio existente
    const bloqueioCheck = await query(
      `SELECT "pointId" FROM "BloqueioAgenda" WHERE id = $1`,
      [id]
    );

    if (bloqueioCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
    }

    const pointIdAtual = bloqueioCheck.rows[0].pointId;

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointIdAtual) {
      return NextResponse.json(
        { mensagem: 'Sem permissão para atualizar este bloqueio' },
        { status: 403 }
      );
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
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
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

    return NextResponse.json(bloqueioCompleto);
  } catch (error: any) {
    console.error('Erro ao atualizar bloqueio:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar bloqueio', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/bloqueio-agenda/[id] - Deletar bloqueio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem deletar bloqueios
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Sem permissão para deletar bloqueios' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Buscar bloqueio para verificar permissões
    const bloqueioCheck = await query(
      `SELECT "pointId" FROM "BloqueioAgenda" WHERE id = $1`,
      [id]
    );

    if (bloqueioCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Bloqueio não encontrado' },
        { status: 404 }
      );
    }

    const pointId = bloqueioCheck.rows[0].pointId;

    // Verificar permissões
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointId) {
      return NextResponse.json(
        { mensagem: 'Sem permissão para deletar este bloqueio' },
        { status: 403 }
      );
    }

    await query(`DELETE FROM "BloqueioAgenda" WHERE id = $1`, [id]);

    return NextResponse.json({ mensagem: 'Bloqueio deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar bloqueio:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar bloqueio', error: error.message },
      { status: 500 }
    );
  }
}

