// app/api/gestao-arena/card-cliente/[id]/item/[itemId]/route.ts - API de Item individual do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarItemCardPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/card-cliente/[id]/item/[itemId] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// PUT /api/gestao-arena/card-cliente/[id]/item/[itemId] - Atualizar item do card
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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
        { mensagem: 'Você não tem permissão para atualizar itens do card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId, itemId } = await params;
    const body: AtualizarItemCardPayload = await request.json();

    // Verificar se o card existe e se está aberto
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

    if (card.status !== 'ABERTO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível atualizar itens de um card fechado ou cancelado' },
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

    // Verificar se o item existe e pertence ao card
    const itemResult = await query(
      'SELECT "produtoId" FROM "ItemCard" WHERE id = $1 AND "cardId" = $2',
      [itemId, cardId]
    );

    if (itemResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Item não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const itemAtual = itemResult.rows[0];

    // Construir query de atualização
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Se está mudando quantidade ou preço unitário, recalcular preço total
    let novaQuantidade = body.quantidade;
    let novoPrecoUnitario = body.precoUnitario;

    if (body.quantidade !== undefined || body.precoUnitario !== undefined) {
      // Obter valores atuais se não foram informados
      const itemAtualCompleto = await query(
        'SELECT quantidade, "precoUnitario" FROM "ItemCard" WHERE id = $1',
        [itemId]
      );
      const atual = itemAtualCompleto.rows[0];

      novaQuantidade = body.quantidade !== undefined ? body.quantidade : parseFloat(atual.quantidade);
      novoPrecoUnitario = body.precoUnitario !== undefined ? body.precoUnitario : parseFloat(atual.precoUnitario);

      const novoPrecoTotal = novaQuantidade * novoPrecoUnitario;
      updates.push(`"precoTotal" = $${paramCount}`);
      values.push(novoPrecoTotal);
      paramCount++;
    }

    if (body.quantidade !== undefined) {
      if (body.quantidade <= 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Quantidade deve ser maior que zero' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      updates.push(`quantidade = $${paramCount}`);
      values.push(body.quantidade);
      paramCount++;
    }
    if (body.precoUnitario !== undefined) {
      if (body.precoUnitario <= 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Preço unitário deve ser maior que zero' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      updates.push(`"precoUnitario" = $${paramCount}`);
      values.push(body.precoUnitario);
      paramCount++;
    }
    if (body.observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      values.push(body.observacoes || null);
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
    values.push(itemId);

    const result = await query(
      `UPDATE "ItemCard" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
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
      'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2',
      [novoValorTotal, cardId]
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar item do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar item do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/card-cliente/[id]/item/[itemId] - Remover item do card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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
        { mensagem: 'Você não tem permissão para remover itens do card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId, itemId } = await params;

    // Verificar se o card existe e se está aberto
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

    if (card.status !== 'ABERTO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível remover itens de um card fechado ou cancelado' },
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

    // Verificar se o item existe e pertence ao card
    const itemResult = await query(
      'SELECT id FROM "ItemCard" WHERE id = $1 AND "cardId" = $2',
      [itemId, cardId]
    );

    if (itemResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Item não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "ItemCard" WHERE id = $1', [itemId]);

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
      'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2',
      [novoValorTotal, cardId]
    );

    const response = NextResponse.json({ mensagem: 'Item removido com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao remover item do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao remover item do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

