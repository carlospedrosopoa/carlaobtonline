import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

async function ensureProdutoBarcode() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS barcode TEXT NULL');
  await query('CREATE INDEX IF NOT EXISTS "Produto_point_barcode_idx" ON "Produto" ("pointId", barcode)');
}

async function ensureProdutoAutoAtendimento() {
  await query('ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "autoAtendimento" BOOLEAN NOT NULL DEFAULT true');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = String(searchParams.get('pointId') || '').trim();

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    await ensureProdutoBarcode();
    await ensureProdutoAutoAtendimento();

    const rapidosRes = await query(
      `SELECT 
        p.id, p.nome, p."precoVenda", p.categoria, p.barcode,
        COUNT(i.id) as qtd
      FROM "Produto" p
      JOIN "ItemCard" i ON i."produtoId" = p.id
      WHERE p."pointId" = $1
        AND p.ativo = true
        AND p."autoAtendimento" = true
        AND i."createdAt" >= (NOW() - INTERVAL '45 days')
      GROUP BY p.id, p.nome, p."precoVenda", p.categoria, p.barcode
      ORDER BY qtd DESC, p.nome ASC
      LIMIT 5`,
      [pointId]
    );

    const produtosRes = await query(
      `SELECT id, nome, "precoVenda", categoria, barcode
       FROM "Produto"
       WHERE "pointId" = $1
         AND ativo = true
         AND "autoAtendimento" = true
       ORDER BY COALESCE(categoria, ''), nome ASC`,
      [pointId]
    );

    const rapidosIds = new Set(rapidosRes.rows.map((r) => String(r.id)));
    const produtos = produtosRes.rows
      .filter((r) => !rapidosIds.has(String(r.id)))
      .map((row) => ({
        id: row.id,
        nome: row.nome,
        precoVenda: Number(row.precoVenda),
        categoria: row.categoria ?? null,
        barcode: row.barcode ?? null,
      }));

    const rapidos = rapidosRes.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      precoVenda: Number(row.precoVenda),
      categoria: row.categoria ?? null,
      barcode: row.barcode ?? null,
    }));

    return withCors(NextResponse.json({ rapidos, produtos }), request);
  } catch (error: any) {
    console.error('Erro ao listar produtos (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao listar produtos', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

