// app/api/gestao-arena/card-cliente/[id]/item/route.ts - API de Itens do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarItemCardPayload, AtualizarItemCardPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/card-cliente/[id]/item - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/card-cliente/[id]/item - Listar itens do card
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

    const { id: cardId } = await params;

    // Verificar se o card existe e se o usuário tem acesso
    const cardResult = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = cardResult.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const result = await query(
      `SELECT 
        i.*,
        p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
        p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria",
        uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
        uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
      FROM "ItemCard" i
      LEFT JOIN "Produto" p ON i."produtoId" = p.id
      LEFT JOIN "User" uc ON i."createdById" = uc.id
      LEFT JOIN "User" uu ON i."updatedById" = uu.id
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
      createdById: row.createdById || null,
      updatedById: row.updatedById || null,
      createdBy: row.createdBy_user_id ? {
        id: row.createdBy_user_id,
        name: row.createdBy_user_name,
        email: row.createdBy_user_email,
      } : null,
      updatedBy: row.updatedBy_user_id ? {
        id: row.updatedBy_user_id,
        name: row.updatedBy_user_name,
        email: row.updatedBy_user_email,
      } : null,
      produto: row.produto_id ? {
        id: row.produto_id,
        nome: row.produto_nome,
        descricao: row.produto_descricao,
        precoVenda: parseFloat(row.produto_precoVenda),
        categoria: row.produto_categoria,
      } : null,
    }));

    const response = NextResponse.json(itens);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar itens do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar itens do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para adicionar itens ao card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId } = await params;
    const body: CriarItemCardPayload = await request.json();
    const { produtoId, quantidade, precoUnitario, observacoes } = body;

    if (!produtoId || !quantidade || quantidade <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'ProdutoId e quantidade são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível adicionar itens a um card fechado ou cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Produto não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (!produtoResult.rows[0].ativo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Produto não está ativo' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Usar preço informado ou preço do produto
    const precoUnit = precoUnitario || parseFloat(produtoResult.rows[0].precoVenda);
    const precoTotal = precoUnit * quantidade;

    // Inserir item
    const itemResult = await query(
      `INSERT INTO "ItemCard" (
        id, "cardId", "produtoId", quantidade, "precoUnitario", "precoTotal", observacoes, "createdAt", "updatedAt", "createdById"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7
      ) RETURNING *`,
      [cardId, produtoId, quantidade, precoUnit, precoTotal, observacoes || null, usuario.id]
    );

    // Atualizar valor total do card (itens + agendamentos)
    const totalItensResult = await query(
      'SELECT COALESCE(SUM("precoTotal"), 0) as total FROM "ItemCard" WHERE "cardId" = $1',
      [cardId]
    );
    let totalAgendamentos = 0;
    try {
      const totalAgendamentosResult = await query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM "CardAgendamento" WHERE "cardId" = $1',
        [cardId]
      );
      totalAgendamentos = parseFloat(totalAgendamentosResult.rows[0].total);
    } catch (error: any) {
      // Se a tabela não existir, usar 0
      console.warn('Tabela CardAgendamento não encontrada, usando 0 para agendamentos');
      totalAgendamentos = 0;
    }
    const novoValorTotal = parseFloat(totalItensResult.rows[0].total) + totalAgendamentos;

    await query(
      'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW(), "updatedById" = $3 WHERE id = $2',
      [novoValorTotal, cardId, usuario.id]
    );

    const response = NextResponse.json(itemResult.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao adicionar item ao card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao adicionar item ao card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

