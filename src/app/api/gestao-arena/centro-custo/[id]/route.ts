// app/api/gestao-arena/centro-custo/[id]/route.ts - API de Centro de Custo individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarCentroCustoPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/centro-custo/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/centro-custo/[id] - Obter centro de custo
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
      'SELECT * FROM "CentroCusto" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Centro de custo não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const centroCusto = result.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, centroCusto.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este centro de custo' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const response = NextResponse.json(centroCusto);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter centro de custo:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter centro de custo', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/gestao-arena/centro-custo/[id] - Atualizar centro de custo
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

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar centros de custo' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body: AtualizarCentroCustoPayload = await request.json();

    const existe = await query(
      'SELECT "pointId" FROM "CentroCusto" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Centro de custo não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const centroCustoAtual = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, centroCustoAtual.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este centro de custo' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    if (body.nome && body.nome !== centroCustoAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "CentroCusto" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [centroCustoAtual.pointId, body.nome, id]
      );

    if (nomeExiste.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um centro de custo com este nome nesta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.nome !== undefined) {
      updates.push(`nome = $${paramCount}`);
      values.push(body.nome);
      paramCount++;
    }
    if (body.descricao !== undefined) {
      updates.push(`descricao = $${paramCount}`);
      values.push(body.descricao || null);
      paramCount++;
    }
    if (body.ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      values.push(body.ativo);
      paramCount++;
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE "CentroCusto" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar centro de custo:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar centro de custo', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/centro-custo/[id] - Deletar centro de custo
export async function DELETE(
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
        { mensagem: 'Você não tem permissão para deletar centros de custo' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    const existe = await query(
      'SELECT "pointId" FROM "CentroCusto" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Centro de custo não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const centroCusto = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, centroCusto.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este centro de custo' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se há saídas usando este centro de custo
    const saidas = await query(
      'SELECT id FROM "SaidaCaixa" WHERE "centroCustoId" = $1 LIMIT 1',
      [id]
    );

    if (saidas.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar este centro de custo pois ele está sendo utilizado em saídas de caixa' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "CentroCusto" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Centro de custo deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar centro de custo:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar centro de custo', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

