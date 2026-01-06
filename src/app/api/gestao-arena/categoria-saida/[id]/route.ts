// app/api/gestao-arena/categoria-saida/[id]/route.ts - API de Categoria de Saída individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarCategoriaSaidaPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/categoria-saida/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/categoria-saida/[id] - Obter categoria de saída
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
      'SELECT * FROM "CategoriaSaida" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Categoria de saída não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const categoria = result.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, categoria.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta categoria de saída' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const response = NextResponse.json(categoria);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter categoria de saída:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter categoria de saída', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/gestao-arena/categoria-saida/[id] - Atualizar categoria de saída
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
        { mensagem: 'Você não tem permissão para atualizar categorias de saída' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body: AtualizarCategoriaSaidaPayload = await request.json();

    const existe = await query(
      'SELECT "pointId" FROM "CategoriaSaida" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Categoria de saída não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const categoriaAtual = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, categoriaAtual.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta categoria de saída' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    if (body.nome && body.nome !== categoriaAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "CategoriaSaida" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [categoriaAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe uma categoria de saída com este nome nesta arena' },
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
      `UPDATE "CategoriaSaida" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar categoria de saída:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar categoria de saída', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/categoria-saida/[id] - Deletar categoria de saída
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
        { mensagem: 'Você não tem permissão para deletar categorias de saída' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    const existe = await query(
      'SELECT "pointId" FROM "CategoriaSaida" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Categoria de saída não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const categoria = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, categoria.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta categoria de saída' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se há saídas usando esta categoria
    const saidas = await query(
      'SELECT id FROM "SaidaCaixa" WHERE "categoriaSaidaId" = $1 LIMIT 1',
      [id]
    );

    if (saidas.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar esta categoria pois ela está sendo utilizada em saídas de caixa' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "CategoriaSaida" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Categoria de saída deletada com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar categoria de saída:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar categoria de saída', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

