// app/api/gestao-arena/card-cliente/[id]/item/route.ts - API de Itens do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarItemCardPayload, AtualizarItemCardPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/card-cliente/[id]/item - Listar itens do card
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

    const { id: cardId } = await params;

    // Verificar se o card existe e se o usuário tem acesso
    const cardResult = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
    }

    const card = cardResult.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
      }
    }

    const result = await query(
      `SELECT 
        i.*,
        p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
        p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria"
      FROM "ItemCard" i
      LEFT JOIN "Produto" p ON i."produtoId" = p.id
      WHERE i."cardId" = $1
      ORDER BY i."createdAt" ASC`,
      [cardId]
    );

    const itens = result.rows.map((row: any) => ({
      id: row.id,
      cardId: row.cardId,
      produtoId: row.produtoId,
      quantidade: parseFloat(row.quantidade),
      precoUnitario: parseFloat(row.precoUnitario),
      precoTotal: parseFloat(row.precoTotal),
      observacoes: row.observacoes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      produto: row.produto_id ? {
        id: row.produto_id,
        nome: row.produto_nome,
        descricao: row.produto_descricao,
        precoVenda: parseFloat(row.produto_precoVenda),
        categoria: row.produto_categoria,
      } : null,
    }));

    return NextResponse.json(itens);
  } catch (error: any) {
    console.error('Erro ao listar itens do card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar itens do card', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/card-cliente/[id]/item - Adicionar item ao card
export async function POST(
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

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para adicionar itens ao card' },
        { status: 403 }
      );
    }

    const { id: cardId } = await params;
    const body: CriarItemCardPayload = await request.json();
    const { produtoId, quantidade, precoUnitario, observacoes } = body;

    if (!produtoId || !quantidade || quantidade <= 0) {
      return NextResponse.json(
        { mensagem: 'ProdutoId e quantidade são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o card existe e se está aberto
    const cardResult = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
    }

    const card = cardResult.rows[0];

    if (card.status !== 'ABERTO') {
      return NextResponse.json(
        { mensagem: 'Não é possível adicionar itens a um card fechado ou cancelado' },
        { status: 400 }
      );
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
      }
    }

    // Verificar se o produto existe e está ativo
    const produtoResult = await query(
      'SELECT "precoVenda", ativo FROM "Produto" WHERE id = $1',
      [produtoId]
    );

    if (produtoResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    if (!produtoResult.rows[0].ativo) {
      return NextResponse.json(
        { mensagem: 'Produto não está ativo' },
        { status: 400 }
      );
    }

    // Usar preço informado ou preço do produto
    const precoUnit = precoUnitario || parseFloat(produtoResult.rows[0].precoVenda);
    const precoTotal = precoUnit * quantidade;

    // Inserir item
    const itemResult = await query(
      `INSERT INTO "ItemCard" (
        id, "cardId", "produtoId", quantidade, "precoUnitario", "precoTotal", observacoes, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW()
      ) RETURNING *`,
      [cardId, produtoId, quantidade, precoUnit, precoTotal, observacoes || null]
    );

    // Atualizar valor total do card
    const totalResult = await query(
      'SELECT COALESCE(SUM("precoTotal"), 0) as total FROM "ItemCard" WHERE "cardId" = $1',
      [cardId]
    );
    const novoValorTotal = parseFloat(totalResult.rows[0].total);

    await query(
      'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2',
      [novoValorTotal, cardId]
    );

    return NextResponse.json(itemResult.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao adicionar item ao card:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao adicionar item ao card', error: error.message },
      { status: 500 }
    );
  }
}

