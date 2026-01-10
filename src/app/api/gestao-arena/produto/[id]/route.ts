// app/api/gestao-arena/produto/[id]/route.ts - API de Produto individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarProdutoPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/produto/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/produto/[id] - Obter produto
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
      'SELECT * FROM "Produto" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const produto = result.rows[0];

    // Verificar se ORGANIZER tem acesso a este produto
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este produto' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const response = NextResponse.json(produto);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter produto:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter produto', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/gestao-arena/produto/[id] - Atualizar produto
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

    // Apenas ADMIN e ORGANIZER podem atualizar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar produtos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body: AtualizarProdutoPayload = await request.json();

    // Verificar se o produto existe
    const existe = await query(
      'SELECT "pointId" FROM "Produto" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const produtoAtual = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produtoAtual.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este produto' },
          { status: 403 }
        );
      }
    }

    // Se está mudando o nome, verificar se não existe duplicata
    if (body.nome && body.nome !== produtoAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "Produto" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [produtoAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um produto com este nome nesta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Construir query de atualização dinamicamente
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
    if (body.precoVenda !== undefined) {
      updates.push(`"precoVenda" = $${paramCount}`);
      values.push(body.precoVenda);
      paramCount++;
    }
    if (body.precoCusto !== undefined) {
      updates.push(`"precoCusto" = $${paramCount}`);
      values.push(body.precoCusto || null);
      paramCount++;
    }
    if (body.categoria !== undefined) {
      updates.push(`categoria = $${paramCount}`);
      values.push(body.categoria || null);
      paramCount++;
    }
    if (body.ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      values.push(body.ativo);
      paramCount++;
    }
    if (body.acessoRapido !== undefined) {
      updates.push(`"acessoRapido" = $${paramCount}`);
      values.push(body.acessoRapido);
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
      `UPDATE "Produto" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar produto', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/produto/[id] - Deletar produto
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

    // Apenas ADMIN e ORGANIZER podem deletar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar produtos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    // Verificar se o produto existe
    const existe = await query(
      'SELECT "pointId" FROM "Produto" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const produto = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este produto' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se há itens de card usando este produto
    const itens = await query(
      'SELECT id FROM "ItemCard" WHERE "produtoId" = $1 LIMIT 1',
      [id]
    );

    if (itens.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar este produto pois ele está sendo utilizado em cards' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "Produto" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Produto deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar produto:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar produto', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

