// app/api/quadra/[id]/route.ts - Rotas de API para Quadra individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/quadra/[id] - Obter quadra por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await query(
      `SELECT 
        q.id, q.nome, q."pointId", q.tipo, q.capacidade, q.ativo, 
        q."tiposEsporte", q."createdAt", q."updatedAt",
        p.id as "point_id", p.nome as "point_nome"
      FROM "Quadra" q
      LEFT JOIN "Point" p ON q."pointId" = p.id
      WHERE q.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];
    const quadra = {
      id: row.id,
      nome: row.nome,
      pointId: row.pointId,
      tipo: row.tipo,
      capacidade: row.capacidade,
      ativo: row.ativo,
      tiposEsporte: row.tiposEsporte ? (Array.isArray(row.tiposEsporte) ? row.tiposEsporte : JSON.parse(row.tiposEsporte)) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
    };

    const response = NextResponse.json(quadra);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter quadra:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter quadra', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/quadra/[id] - Atualizar quadra
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem editar quadras' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a esta quadra
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, id);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para editar esta quadra' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const body = await request.json();
    const { nome, pointId, tipo, capacidade, ativo, tiposEsporte } = body;

    if (!nome) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se pointId foi alterado, verificar se existe e se ORGANIZER tem acesso
    if (pointId) {
      const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
      if (pointCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Estabelecimento não encontrado' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      // Verificar se ORGANIZER tem acesso ao novo point
      if (usuario.role === 'ORGANIZER') {
        const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
        if (!temAcesso) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Você não tem permissão para mover esta quadra para esta arena' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
      }
    }

    const tiposEsporteJson = tiposEsporte !== undefined 
      ? (tiposEsporte && Array.isArray(tiposEsporte) && tiposEsporte.length > 0 ? JSON.stringify(tiposEsporte) : null)
      : null;

    const result = await query(
      `UPDATE "Quadra"
       SET nome = $1, "pointId" = COALESCE($2, "pointId"), tipo = $3, capacidade = $4, ativo = $5, 
           "tiposEsporte" = COALESCE($6, "tiposEsporte"), "updatedAt" = NOW()
       WHERE id = $7
       RETURNING id, nome, "pointId", tipo, capacidade, ativo, "tiposEsporte", "createdAt", "updatedAt"`,
      [nome, pointId || null, tipo || null, capacidade || null, ativo ?? true, tiposEsporteJson, id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar point para incluir no retorno
    const pointResult = await query('SELECT id, nome FROM "Point" WHERE id = $1', [result.rows[0].pointId]);
    const quadra = {
      ...result.rows[0],
      tiposEsporte: result.rows[0].tiposEsporte ? (Array.isArray(result.rows[0].tiposEsporte) ? result.rows[0].tiposEsporte : JSON.parse(result.rows[0].tiposEsporte)) : null,
      point: pointResult.rows[0] || null,
    };

    const response = NextResponse.json(quadra);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar quadra:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar quadra', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/quadra/[id] - Deletar quadra
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem deletar quadras' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a esta quadra
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, id);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para deletar esta quadra' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }
    // Verificar se há agendamentos vinculados
    const agendamentosResult = await query(
      `SELECT COUNT(*) as count FROM "Agendamento" WHERE "quadraId" = $1`,
      [id]
    );

    if (parseInt(agendamentosResult.rows[0].count) > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar quadra com agendamentos vinculados' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `DELETE FROM "Quadra" WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ mensagem: 'Quadra deletada com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar quadra:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar quadra', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

