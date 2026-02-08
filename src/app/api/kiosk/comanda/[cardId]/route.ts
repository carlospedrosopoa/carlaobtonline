import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = String(searchParams.get('pointId') || '').trim();
    const incluirItens = String(searchParams.get('incluirItens') || 'false') === 'true';
    const { cardId } = await params;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    const cardRes = await query(
      `SELECT id, "pointId", "numeroCard", status, "valorTotal"
       FROM "CardCliente"
       WHERE id = $1 AND "pointId" = $2
       LIMIT 1`,
      [cardId, pointId]
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
        [cardId]
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
    console.error('Erro ao buscar comanda (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar comanda', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

