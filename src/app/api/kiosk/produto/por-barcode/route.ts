import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

async function ensureProdutoBarcode() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS barcode TEXT NULL');
  await query('CREATE INDEX IF NOT EXISTS "Produto_point_barcode_idx" ON "Produto" ("pointId", barcode)');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = String(searchParams.get('pointId') || '').trim();
    const barcode = String(searchParams.get('barcode') || '').trim();

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }
    if (!barcode) {
      return withCors(NextResponse.json({ mensagem: 'barcode é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    await ensureProdutoBarcode();

    const res = await query(
      `SELECT id, nome, "precoVenda", ativo
       FROM "Produto"
       WHERE "pointId" = $1
         AND barcode = $2
       LIMIT 1`,
      [pointId, barcode]
    );

    if (res.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    if (res.rows[0].ativo !== true) {
      return withCors(NextResponse.json({ mensagem: 'Produto não está ativo' }, { status: 400 }), request);
    }

    return withCors(
      NextResponse.json({
        produto: {
          id: res.rows[0].id,
          nome: res.rows[0].nome,
          precoVenda: Number(res.rows[0].precoVenda),
          barcode,
        },
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao buscar produto por barcode (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar produto', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

