// app/api/gestao-arena/produto/[id]/route.ts - API de Produto individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { AtualizarProdutoPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/produto/[id] - Obter produto
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
      'SELECT * FROM "Produto" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const produto = result.rows[0];

    // Verificar se ORGANIZER tem acesso a este produto
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este produto' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(produto);
  } catch (error: any) {
    console.error('Erro ao obter produto:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter produto', error: error.message },
      { status: 500 }
    );
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
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem atualizar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar produtos' },
        { status: 403 }
      );
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
        return NextResponse.json(
          { mensagem: 'Já existe um produto com este nome nesta arena' },
          { status: 400 }
        );
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
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
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

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar produto', error: error.message },
      { status: 500 }
    );
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
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem deletar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar produtos' },
        { status: 403 }
      );
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
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este produto' },
          { status: 403 }
        );
      }
    }

    // Verificar se há itens de card usando este produto
    const itens = await query(
      'SELECT id FROM "ItemCard" WHERE "produtoId" = $1 LIMIT 1',
      [id]
    );

    if (itens.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Não é possível deletar este produto pois ele está sendo utilizado em cards' },
        { status: 400 }
      );
    }

    await query('DELETE FROM "Produto" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Produto deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar produto:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar produto', error: error.message },
      { status: 500 }
    );
  }
}

