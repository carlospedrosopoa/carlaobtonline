// app/api/gestao-arena/card-cliente/limpar-todos/route.ts - API para limpar todos os cards de uma arena (apenas desenvolvimento)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// POST /api/gestao-arena/card-cliente/limpar-todos - Limpar todos os cards de uma arena
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem limpar cards
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para limpar cards' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pointId } = body;

    if (!pointId) {
      return NextResponse.json(
        { mensagem: 'PointId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
      }
    }

    // Contar quantos cards serão deletados
    const countResult = await query(
      'SELECT COUNT(*) as total FROM "CardCliente" WHERE "pointId" = $1',
      [pointId]
    );
    const totalCards = parseInt(countResult.rows[0].total);

    if (totalCards === 0) {
      return NextResponse.json(
        { mensagem: 'Nenhum card encontrado para esta arena', totalCards: 0 },
        { status: 200 }
      );
    }

    // Deletar na ordem correta devido a foreign keys:
    // 1. PagamentoItem (relaciona pagamentos com itens)
    // 2. ItemCard (itens dos cards)
    // 3. PagamentoCard (pagamentos dos cards)
    // 4. CardCliente (cards)

    // 1. Deletar relacionamentos PagamentoItem
    try {
      await query(
        `DELETE FROM "PagamentoItem" 
         WHERE "pagamentoCardId" IN (
           SELECT p.id FROM "PagamentoCard" p
           INNER JOIN "CardCliente" c ON p."cardId" = c.id
           WHERE c."pointId" = $1
         )`,
        [pointId]
      );
    } catch (error: any) {
      // Se a tabela PagamentoItem não existir, apenas logar
      if (!error.message?.includes('does not exist') && error.code !== '42P01') {
        console.warn('Erro ao deletar PagamentoItem (pode não existir):', error.message);
      }
    }

    // 2. Deletar todos os itens dos cards
    await query(
      `DELETE FROM "ItemCard" 
       WHERE "cardId" IN (SELECT id FROM "CardCliente" WHERE "pointId" = $1)`,
      [pointId]
    );

    // 3. Deletar todos os pagamentos dos cards
    await query(
      `DELETE FROM "PagamentoCard" 
       WHERE "cardId" IN (SELECT id FROM "CardCliente" WHERE "pointId" = $1)`,
      [pointId]
    );

    // Deletar todos os cards
    const cardsResult = await query(
      'DELETE FROM "CardCliente" WHERE "pointId" = $1',
      [pointId]
    );

    return NextResponse.json({
      mensagem: `${totalCards} card(s) deletado(s) com sucesso`,
      totalCards,
    });
  } catch (error: any) {
    console.error('Erro ao limpar cards:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao limpar cards', error: error.message },
      { status: 500 }
    );
  }
}

