import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { validarRegiaoGeojson } from '@/lib/regiaoGeo';

async function temColunaLimite(): Promise<boolean> {
  const r = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'Regiao'
         AND column_name = 'limite'
     ) AS ok`
  );
  return Boolean(r.rows?.[0]?.ok);
}

function parseJsonb(v: any) {
  if (!v) return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const hasLimite = await temColunaLimite();

    const regiaoRes = hasLimite
      ? await query(
          `SELECT id, nome, ativo, "centroLat", "centroLng",
                  ST_AsGeoJSON(limite) AS "limiteGeojson",
                  "createdAt", "updatedAt"
           FROM "Regiao"
           WHERE id = $1`,
          [id]
        )
      : await query(
          `SELECT id, nome, ativo, "centroLat", "centroLng",
                  "limiteGeojson",
                  "createdAt", "updatedAt"
           FROM "Regiao"
           WHERE id = $1`,
          [id]
        );

    if (regiaoRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Região não encontrada' }, { status: 404 }), request);
    }

    const regiao = regiaoRes.rows[0];
    const limiteRaw = parseJsonb(regiao.limiteGeojson);
    const limiteValid = validarRegiaoGeojson(limiteRaw);
    const limiteGeojson = limiteValid.ok ? limiteValid.geojson : null;

    const pointsRes = await query(
      `SELECT p.id, p.nome, p.endereco, p.latitude, p.longitude, p."logoUrl", p.ativo
       FROM "RegiaoPoint" rp
       JOIN "Point" p ON p.id = rp."pointId"
       WHERE rp."regiaoId" = $1
       ORDER BY p.nome ASC`,
      [id]
    );

    const points = pointsRes.rows.map((p: any) => ({
      id: p.id,
      nome: p.nome,
      endereco: p.endereco ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      logoUrl: p.logoUrl ?? null,
      ativo: p.ativo ?? null,
    }));

    return withCors(
      NextResponse.json({
        regiao: {
          id: regiao.id,
          nome: regiao.nome,
          ativo: regiao.ativo,
          centroLat: regiao.centroLat ?? null,
          centroLng: regiao.centroLng ?? null,
          limiteGeojson,
          createdAt: regiao.createdAt,
          updatedAt: regiao.updatedAt,
        },
        arenas: points,
      }),
      request
    );
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao buscar região', error: error.message }, { status: 500 }), request);
  }
}
