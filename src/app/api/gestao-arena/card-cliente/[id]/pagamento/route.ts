// app/api/gestao-arena/card-cliente/[id]/pagamento/route.ts - API de Pagamentos do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarPagamentoCardPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/card-cliente/[id]/pagamento - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/card-cliente/[id]/pagamento - Listar pagamentos do card
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
      'SELECT "pointId" FROM "CardCliente" WHERE id = $1',
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
        p.*, p."createdById", p."updatedById",
        fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
        uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
        uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
      FROM "PagamentoCard" p
      LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
      LEFT JOIN "User" uc ON p."createdById" = uc.id
      LEFT JOIN "User" uu ON p."updatedById" = uu.id
      WHERE p."cardId" = $1
      ORDER BY p."createdAt" ASC`,
      [cardId]
    );

    // Buscar itens vinculados a cada pagamento
    const pagamentos = await Promise.all(
      result.rows.map(async (row: any) => {
        const itensResult = await query(
          `SELECT 
            i.*,
            p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
            p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria"
          FROM "PagamentoItem" pi
          INNER JOIN "ItemCard" i ON pi."itemCardId" = i.id
          LEFT JOIN "Produto" p ON i."produtoId" = p.id
          WHERE pi."pagamentoCardId" = $1
          ORDER BY i."createdAt" ASC`,
          [row.id]
        );

        const itens = itensResult.rows.map((itemRow: any) => ({
          id: itemRow.id,
          cardId: itemRow.cardId,
          produtoId: itemRow.produtoId,
          quantidade: parseFloat(itemRow.quantidade),
          precoUnitario: parseFloat(itemRow.precoUnitario),
          precoTotal: parseFloat(itemRow.precoTotal),
          observacoes: itemRow.observacoes,
          createdAt: itemRow.createdAt,
          updatedAt: itemRow.updatedAt,
          produto: itemRow.produto_id ? {
            id: itemRow.produto_id,
            nome: itemRow.produto_nome,
            descricao: itemRow.produto_descricao,
            precoVenda: parseFloat(itemRow.produto_precoVenda),
            categoria: itemRow.produto_categoria,
          } : null,
        }));

        return {
          id: row.id,
          cardId: row.cardId,
          formaPagamentoId: row.formaPagamentoId,
          valor: parseFloat(row.valor),
          observacoes: row.observacoes,
          createdAt: row.createdAt,
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
          formaPagamento: row.formaPagamento_id ? {
            id: row.formaPagamento_id,
            nome: row.formaPagamento_nome,
            tipo: row.formaPagamento_tipo,
          } : null,
          itens: itens.length > 0 ? itens : undefined,
        };
      })
    );

    const response = NextResponse.json(pagamentos);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar pagamentos do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar pagamentos do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/card-cliente/[id]/pagamento - Adicionar pagamento ao card
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para adicionar pagamentos ao card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId } = await params;
    const body: CriarPagamentoCardPayload = await request.json();
    const { formaPagamentoId, valor, observacoes, itemIds } = body;

    if (!formaPagamentoId || !valor || valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'FormaPagamentoId e valor são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o card existe
    const cardResult = await query(
      'SELECT "pointId", status, "valorTotal", "numeroCard" FROM "CardCliente" WHERE id = $1',
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

    if (card.status === 'CANCELADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível adicionar pagamentos a um card cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se a forma de pagamento existe
    const formaPagamentoResult = await query(
      'SELECT id, ativo FROM "FormaPagamento" WHERE id = $1',
      [formaPagamentoId]
    );

    if (formaPagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (!formaPagamentoResult.rows[0].ativo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Forma de pagamento não está ativa' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se há uma abertura de caixa aberta
    const aberturaAbertaResult = await query(
      'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2 LIMIT 1',
      [card.pointId, 'ABERTA']
    );

    if (aberturaAbertaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'O caixa está fechado. Por favor, abra o caixa antes de realizar pagamentos.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Calcular total já pago
    const pagamentosResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
      [cardId]
    );
    const totalPago = parseFloat(pagamentosResult.rows[0].total);
    const valorTotal = parseFloat(card.valorTotal);

    // Permitir pagamentos parciais e múltiplos pagamentos
    // O card pode ter saldo pendente e será fechado manualmente quando necessário
    // Não há limite de pagamento, permitindo ajustes e trocos

    // Se há itens vinculados, validar que eles pertencem ao card e não estão totalmente pagos
    if (itemIds && itemIds.length > 0) {
      // Verificar se os itens pertencem ao card
      const itensResult = await query(
        `SELECT id, "precoTotal" FROM "ItemCard" WHERE id = ANY($1::text[]) AND "cardId" = $2`,
        [itemIds, cardId]
      );

      if (itensResult.rows.length !== itemIds.length) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Um ou mais itens não pertencem a este card' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      // Calcular valor total dos itens selecionados
      const valorItens = itensResult.rows.reduce((sum, item) => sum + parseFloat(item.precoTotal), 0);

      // Verificar se o valor do pagamento corresponde ao valor dos itens (ou é menor, permitindo pagamento parcial)
      if (valor > valorItens) {
        const errorResponse = NextResponse.json(
          { mensagem: `O valor do pagamento (R$ ${valor.toFixed(2)}) não pode ser maior que o valor dos itens selecionados (R$ ${valorItens.toFixed(2)})` },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      // Verificar se os itens já não estão totalmente pagos
      for (const item of itensResult.rows) {
        const pagamentosItemResult = await query(
          `SELECT COALESCE(SUM(p.valor), 0) as total
           FROM "PagamentoCard" p
           INNER JOIN "PagamentoItem" pi ON p.id = pi."pagamentoCardId"
           WHERE pi."itemCardId" = $1`,
          [item.id]
        );
        const totalPagoItem = parseFloat(pagamentosItemResult.rows[0].total);
        const valorItem = parseFloat(item.precoTotal);

        if (totalPagoItem >= valorItem) {
          const errorResponse = NextResponse.json(
            { mensagem: `O item já está totalmente pago` },
            { status: 400 }
          );
          return withCors(errorResponse, request);
        }
      }
    }

    // Buscar abertura de caixa aberta atual
    const aberturaResult = await query(
      'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2 LIMIT 1',
      [card.pointId, 'ABERTA']
    );
    const aberturaCaixaId = aberturaResult.rows.length > 0 ? aberturaResult.rows[0].id : null;

    // Inserir pagamento
    const pagamentoResult = await query(
      `INSERT INTO "PagamentoCard" (
        id, "cardId", "formaPagamentoId", valor, observacoes, "aberturaCaixaId", "createdAt", "createdById"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), $6
      ) RETURNING *`,
      [cardId, formaPagamentoId, valor, observacoes || null, aberturaCaixaId, usuario.id]
    );

    const pagamentoId = pagamentoResult.rows[0].id;

    // Vincular itens ao pagamento se informados
    if (itemIds && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await query(
          `INSERT INTO "PagamentoItem" (id, "pagamentoCardId", "itemCardId", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, NOW())`,
          [pagamentoId, itemId]
        );
      }
    }

    // Não criar entrada manual - a API de fluxo de caixa busca pagamentos de cards diretamente
    // Isso evita duplicação e garante que apareça como "ENTRADA_CARD" e não "ENTRADA_MANUAL"

    // Não fechar automaticamente - o card será fechado manualmente quando necessário
    // O sistema mantém o saldo (valorTotal - totalPago) para controle

    // Atualizar updatedAt do card
    await query(
      'UPDATE "CardCliente" SET "updatedAt" = NOW(), "updatedById" = $2 WHERE id = $1',
      [cardId, usuario.id]
    );

    const response = NextResponse.json(pagamentoResult.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao adicionar pagamento ao card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao adicionar pagamento ao card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

