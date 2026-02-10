import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

async function ensureProdutoBarcode() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS barcode TEXT NULL');
  await query('CREATE INDEX IF NOT EXISTS "Produto_point_barcode_idx" ON "Produto" ("pointId", barcode)');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = String(searchParams.get('pointId') || '').trim();
    const { cardId } = await params;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    const body = await request.json();
    const barcodeRaw = body?.barcode !== undefined ? String(body.barcode).trim() : '';
    const produtoIdRaw = body?.produtoId !== undefined ? String(body.produtoId).trim() : '';
    const quantidade = Number(body?.quantidade);

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return withCors(NextResponse.json({ mensagem: 'quantidade inválida' }, { status: 400 }), request);
    }

    if (!barcodeRaw && !produtoIdRaw) {
      return withCors(NextResponse.json({ mensagem: 'barcode ou produtoId é obrigatório' }, { status: 400 }), request);
    }

    const cardRes = await query(
      'SELECT id, "pointId", status FROM "CardCliente" WHERE id = $1 AND "pointId" = $2',
      [cardId, pointId]
    );
    if (cardRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Comanda não encontrada' }, { status: 404 }), request);
    }

    const card = cardRes.rows[0];
    if (card.status !== 'ABERTO') {
      return withCors(
        NextResponse.json({ mensagem: 'Não é possível adicionar itens a uma comanda fechada' }, { status: 400 }),
        request
      );
    }

    if (barcodeRaw) {
      await ensureProdutoBarcode();
    }

    const produtoRes = produtoIdRaw
      ? await query(
          'SELECT id, "precoVenda", ativo FROM "Produto" WHERE id = $1 AND "pointId" = $2 LIMIT 1',
          [produtoIdRaw, pointId]
        )
      : await query(
          'SELECT id, "precoVenda", ativo FROM "Produto" WHERE barcode = $1 AND "pointId" = $2 LIMIT 1',
          [barcodeRaw, pointId]
        );

    if (produtoRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    if (produtoRes.rows[0].ativo !== true) {
      return withCors(NextResponse.json({ mensagem: 'Produto não está ativo' }, { status: 400 }), request);
    }

    const produtoId = produtoRes.rows[0].id as string;
    const precoUnit = Number(produtoRes.rows[0].precoVenda);
    const precoTotal = precoUnit * quantidade;

    const itemRes = await query(
      `INSERT INTO "ItemCard" (
        id, "cardId", "produtoId", quantidade, "precoUnitario", "precoTotal", observacoes, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, NULL, NOW(), NOW()
      ) RETURNING *`,
      [cardId, produtoId, quantidade, precoUnit, precoTotal]
    );

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
      if (error?.code !== '42P01') {
        console.warn('Erro ao somar agendamentos no card (kiosk):', error);
      }
      totalAgendamentos = 0;
    }

    const novoValorTotal = parseFloat(totalItensResult.rows[0].total) + totalAgendamentos;
    await query('UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2', [
      novoValorTotal,
      cardId,
    ]);

    return withCors(
      NextResponse.json({
        item: itemRes.rows[0],
        cardValorTotal: novoValorTotal,
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao adicionar item na comanda (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao adicionar item', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

