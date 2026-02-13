import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pointId = String(body?.pointId || '').trim();
    const numeroCard = Number(body?.numeroCard);
    const incluirItens = body?.incluirItens === false ? false : true;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }
    if (!Number.isFinite(numeroCard) || numeroCard <= 0) {
      return withCors(NextResponse.json({ mensagem: 'numeroCard inválido' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    const cardRes = await query(
      `SELECT id, "pointId", "numeroCard", status, "valorTotal"
       FROM "CardCliente"
       WHERE "pointId" = $1 AND "numeroCard" = $2
       LIMIT 1`,
      [pointId, numeroCard]
    );
    if (cardRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Comanda não encontrada' }, { status: 404 }), request);
    }

    const card = cardRes.rows[0];
    let itens: any[] = [];

    if (incluirItens) {
      const itensRes = await query(
        `SELECT 
          i.id, i."produtoId", i.quantidade, i."precoUnitario", i."precoTotal",
          p.nome as "produto_nome", p."precoVenda" as "produto_precoVenda"
        FROM "ItemCard" i
        LEFT JOIN "Produto" p ON p.id = i."produtoId"
        WHERE i."cardId" = $1
        ORDER BY i."createdAt" DESC`,
        [card.id]
      );
      itens = itensRes.rows.map((row) => ({
        id: row.id,
        produtoId: row.produtoId,
        quantidade: Number(row.quantidade),
        precoUnitario: Number(row.precoUnitario),
        precoTotal: Number(row.precoTotal),
        produto: row.produto_nome
          ? {
              id: row.produtoId,
              nome: row.produto_nome,
              precoVenda: Number(row.produto_precoVenda),
            }
          : null,
      }));
    }

    return withCors(
      NextResponse.json({
        card: {
          id: card.id,
          pointId: card.pointId,
          numeroCard: Number(card.numeroCard),
          status: card.status,
          valorTotal: Number(card.valorTotal) || 0,
        },
        itens,
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao buscar comanda por numero (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar comanda', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

