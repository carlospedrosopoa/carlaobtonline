import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { centroidFromGeojson, validarRegiaoGeojson } from '@/lib/regiaoGeo';
import type { AtualizarRegiaoPayload } from '@/types/regiao';

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN') return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);

    const { id } = await context.params;
    const regiaoRes = await query(
      `SELECT id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"
       FROM "Regiao"
       WHERE id = $1`,
      [id]
    );
    if (regiaoRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Região não encontrada' }, { status: 404 }), request);
    }
    const regiao = regiaoRes.rows[0];
    const pointsRes = await query(`SELECT "pointId" FROM "RegiaoPoint" WHERE "regiaoId" = $1`, [id]);
    const pointIds = pointsRes.rows.map((r: any) => r.pointId);

    return withCors(
      NextResponse.json({
        id: regiao.id,
        nome: regiao.nome,
        ativo: regiao.ativo,
        centroLat: regiao.centroLat ?? null,
        centroLng: regiao.centroLng ?? null,
        limiteGeojson: parseJsonb(regiao.limiteGeojson),
        createdAt: regiao.createdAt,
        updatedAt: regiao.updatedAt,
        pointIds,
        arenasCount: pointIds.length,
      }),
      request
    );
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao buscar região', error: error.message }, { status: 500 }), request);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN') return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);

    const { id } = await context.params;
    const body = (await request.json()) as AtualizarRegiaoPayload;
    const hasLimite = await temColunaLimite();

    const updated = await transaction(async (client) => {
      const currentRes = await client.query(
        `SELECT id, nome, ativo, "limiteGeojson", "centroLat", "centroLng"
         FROM "Regiao"
         WHERE id = $1`,
        [id]
      );
      if (currentRes.rows.length === 0) return null;
      const current = currentRes.rows[0];

      const nome = typeof body.nome === 'string' ? body.nome.trim() : String(current.nome);
      const ativo = typeof body.ativo === 'boolean' ? body.ativo : Boolean(current.ativo);

      let limiteGeojsonObj: any = parseJsonb(current.limiteGeojson);
      if (body.limiteGeojson !== undefined) {
        const valid = validarRegiaoGeojson(body.limiteGeojson);
        if (!valid.ok) {
          throw new Error(valid.mensagem);
        }
        limiteGeojsonObj = valid.geojson;
      }

      const limiteGeojsonStr = JSON.stringify(limiteGeojsonObj);
      let regiaoRow: any;

      if (hasLimite && body.limiteGeojson !== undefined) {
        const upd = await client.query(
          `WITH g AS (
             SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)) AS geom
           )
           UPDATE "Regiao"
           SET nome = $1,
               ativo = $2,
               "limiteGeojson" = $4::jsonb,
               limite = (SELECT geom FROM g),
               "centroLat" = (SELECT ST_Y(ST_Centroid(geom)) FROM g),
               "centroLng" = (SELECT ST_X(ST_Centroid(geom)) FROM g),
               "updatedAt" = NOW()
           WHERE id = $5
           RETURNING id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"`,
          [nome, ativo, limiteGeojsonStr, limiteGeojsonStr, id]
        );
        regiaoRow = upd.rows[0];
      } else if (!hasLimite && body.limiteGeojson !== undefined) {
        const centro = centroidFromGeojson(limiteGeojsonObj);
        const upd = await client.query(
          `UPDATE "Regiao"
           SET nome = $1,
               ativo = $2,
               "limiteGeojson" = $3::jsonb,
               "centroLat" = $4,
               "centroLng" = $5,
               "updatedAt" = NOW()
           WHERE id = $6
           RETURNING id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"`,
          [nome, ativo, limiteGeojsonStr, centro.lat, centro.lng, id]
        );
        regiaoRow = upd.rows[0];
      } else {
        const upd = await client.query(
          `UPDATE "Regiao"
           SET nome = $1,
               ativo = $2,
               "limiteGeojson" = $3::jsonb,
               "updatedAt" = NOW()
           WHERE id = $4
           RETURNING id, nome, ativo, "limiteGeojson", "centroLat", "centroLng", "createdAt", "updatedAt"`,
          [nome, ativo, limiteGeojsonStr, id]
        );
        regiaoRow = upd.rows[0];
      }

      if (Array.isArray(body.pointIds)) {
        await client.query(`DELETE FROM "RegiaoPoint" WHERE "regiaoId" = $1`, [id]);
        for (const pid of body.pointIds) {
          await client.query(
            `INSERT INTO "RegiaoPoint"("regiaoId", "pointId", "createdAt")
             VALUES ($1, $2, NOW())
             ON CONFLICT ("regiaoId", "pointId") DO NOTHING`,
            [id, pid]
          );
        }
      }

      const pointIdsRes = await client.query(`SELECT "pointId" FROM "RegiaoPoint" WHERE "regiaoId" = $1`, [id]);
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

    if (!updated) {
      return withCors(NextResponse.json({ mensagem: 'Região não encontrada' }, { status: 404 }), request);
    }

    return withCors(NextResponse.json(updated), request);
  } catch (error: any) {
    const status = String(error?.message || '').includes('GeoJSON') ? 400 : 500;
    return withCors(NextResponse.json({ mensagem: 'Erro ao atualizar região', error: error.message }, { status }), request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN') return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);

    const { id } = await context.params;
    const res = await query(
      `UPDATE "Regiao" SET ativo = false, "updatedAt" = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (res.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Região não encontrada' }, { status: 404 }), request);
    }
    return withCors(NextResponse.json({ ok: true }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao remover região', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
