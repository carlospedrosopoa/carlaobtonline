// app/api/gestao-arena/produto/[id]/route.ts - API de Produto individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { handleCorsPreflight, withCors } from '@/lib/cors';
import type { AtualizarProdutoPayload } from '@/types/gestaoArena';

async function ensureProdutoBarcode() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS barcode TEXT NULL');
  await query('CREATE INDEX IF NOT EXISTS "Produto_point_barcode_idx" ON "Produto" ("pointId", barcode)');
}

async function ensureProdutoAutoAtendimento() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "autoAtendimento" BOOLEAN NOT NULL DEFAULT true');
}

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
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    await ensureProdutoBarcode();
    await ensureProdutoAutoAtendimento();

    const { id } = await params;

    const result = await query(
      'SELECT * FROM "Produto" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    const produto = result.rows[0];

    // Verificar se ORGANIZER tem acesso a este produto
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
        return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a este produto' }, { status: 403 }), request);
      }
    }

    return withCors(NextResponse.json(produto), request);
  } catch (error: any) {
    console.error('Erro ao obter produto:', error);
    return withCors(NextResponse.json({ mensagem: 'Erro ao obter produto', error: error.message }, { status: 500 }), request);
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
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    await ensureProdutoBarcode();
    await ensureProdutoAutoAtendimento();

    // Apenas ADMIN e ORGANIZER podem atualizar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(
        NextResponse.json({ mensagem: 'Você não tem permissão para atualizar produtos' }, { status: 403 }),
        request
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
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    const produtoAtual = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produtoAtual.pointId)) {
        return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a este produto' }, { status: 403 }), request);
      }
    }

    // Se está mudando o nome, verificar se não existe duplicata
    if (body.nome && body.nome !== produtoAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "Produto" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [produtoAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        return withCors(
          NextResponse.json({ mensagem: 'Já existe um produto com este nome nesta arena' }, { status: 400 }),
          request
        );
      }
    }

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    let alterouPreco = false;

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
      alterouPreco = true;
    }
    if (body.precoCusto !== undefined) {
      updates.push(`"precoCusto" = $${paramCount}`);
      values.push(body.precoCusto || null);
      paramCount++;
      alterouPreco = true;
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
    if (body.autoAtendimento !== undefined) {
      updates.push(`"autoAtendimento" = $${paramCount}`);
      values.push(body.autoAtendimento);
      paramCount++;
    }
    if (body.barcode !== undefined) {
      updates.push(`barcode = $${paramCount}`);
      values.push(body.barcode || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Nenhum campo para atualizar' }, { status: 400 }), request);
    }

    if (alterouPreco) {
      updates.push(`"dataUltimaAlteracaoPreco" = NOW()`);
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

    return withCors(NextResponse.json(result.rows[0]), request);
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao atualizar produto', error: error.message }, { status: 500 }),
      request
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
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    // Apenas ADMIN e ORGANIZER podem deletar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(
        NextResponse.json({ mensagem: 'Você não tem permissão para deletar produtos' }, { status: 403 }),
        request
      );
    }

    const { id } = await params;

    // Verificar se o produto existe
    const existe = await query(
      'SELECT "pointId" FROM "Produto" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    const produto = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
        return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a este produto' }, { status: 403 }), request);
      }
    }

    // Verificar se há itens de card usando este produto
    const itens = await query(
      'SELECT id FROM "ItemCard" WHERE "produtoId" = $1 LIMIT 1',
      [id]
    );

    if (itens.rows.length > 0) {
      return withCors(
        NextResponse.json(
          { mensagem: 'Não é possível deletar este produto pois ele está sendo utilizado em cards' },
          { status: 400 }
        ),
        request
      );
    }

    await query('DELETE FROM "Produto" WHERE id = $1', [id]);

    return withCors(NextResponse.json({ mensagem: 'Produto deletado com sucesso' }), request);
  } catch (error: any) {
    console.error('Erro ao deletar produto:', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao deletar produto', error: error.message }, { status: 500 }),
      request
    );
  }
}
