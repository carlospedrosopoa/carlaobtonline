import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { centroidFromGeojson, validarRegiaoGeojson } from '@/lib/regiaoGeo';
import type { CriarRegiaoPayload } from '@/types/regiao';

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

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const result = await query(
      `SELECT r.id, r.nome, r.ativo, r."centroLat", r."centroLng", r."limiteGeojson",
              COUNT(rp.id)::int AS "arenasCount",
              r."createdAt", r."updatedAt"
       FROM "Regiao" r
       LEFT JOIN "RegiaoPoint" rp ON rp."regiaoId" = r.id
       GROUP BY r.id
       ORDER BY LOWER(r.nome) ASC`
    );

    const rows = result.rows.map((row: any) => ({
      id: row.id,
      nome: row.nome,
      ativo: row.ativo,
      centroLat: row.centroLat ?? null,
      centroLng: row.centroLng ?? null,
      limiteGeojson: parseJsonb(row.limiteGeojson),
      arenasCount: row.arenasCount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return withCors(NextResponse.json(rows), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar regiões', error: error.message }, { status: 500 }), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const body = (await request.json()) as CriarRegiaoPayload;
    if (!body?.nome?.trim()) {
      return withCors(NextResponse.json({ mensagem: 'nome é obrigatório' }, { status: 400 }), request);
    }
    if (!Array.isArray(body.pointIds)) {
      return withCors(NextResponse.json({ mensagem: 'pointIds deve ser um array' }, { status: 400 }), request);
    }

    const valid = validarRegiaoGeojson(body.limiteGeojson);
    if (!valid.ok) {
      return withCors(NextResponse.json({ mensagem: valid.mensagem }, { status: 400 }), request);
    }

    const limiteGeojsonStr = JSON.stringify(valid.geojson);
    const ativo = body.ativo ?? true;
    const hasLimite = await temColunaLimite();

    const created = await transaction(async (client) => {
      let regiaoRow: any;
      if (hasLimite) {
        const insert = await client.query(
          `WITH g AS (
             SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)) AS geom
           )
           INSERT INTO "Regiao"(nome, ativo, "limiteGeojson", "centroLat", "centroLng", limite, "createdAt", "updatedAt")
           SELECT $1, $3, $4::jsonb,
                  ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)),
                  geom,
                  NOW(), NOW()
           FROM g
           RETURNING id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"`,
          [body.nome.trim(), limiteGeojsonStr, ativo, limiteGeojsonStr]
        );
        regiaoRow = insert.rows[0];
      } else {
        const centro = centroidFromGeojson(valid.geojson);
        const insert = await client.query(
          `INSERT INTO "Regiao"(nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt")
           VALUES ($1, $2, $3::jsonb, $4, $5, NOW(), NOW())
           RETURNING id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"`,
          [body.nome.trim(), ativo, limiteGeojsonStr, centro.lat, centro.lng]
        );
        regiaoRow = insert.rows[0];
      }

      const regiaoId = regiaoRow.id as string;
      if (body.pointIds.length > 0) {
        for (const pid of body.pointIds) {
          await client.query(
            `INSERT INTO "RegiaoPoint"("regiaoId", "pointId", "createdAt")
             VALUES ($1, $2, NOW())
             ON CONFLICT ("regiaoId", "pointId") DO NOTHING`,
            [regiaoId, pid]
          );
        }
      }

      const pointIdsRes = await client.query(`SELECT "pointId" FROM "RegiaoPoint" WHERE "regiaoId" = $1`, [regiaoId]);
      const pointIds = pointIdsRes.rows.map((r: any) => r.pointId);

      return {
        id: regiaoRow.id,
        nome: regiaoRow.nome,
        ativo: regiaoRow.ativo,
        centroLat: regiaoRow.centroLat ?? null,
        centroLng: regiaoRow.centroLng ?? null,
        limiteGeojson: parseJsonb(regiaoRow.limiteGeojson),
        createdAt: regiaoRow.createdAt,
        updatedAt: regiaoRow.updatedAt,
        pointIds,
        arenasCount: pointIds.length,
      };
    });

    return withCors(NextResponse.json(created, { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar região', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
