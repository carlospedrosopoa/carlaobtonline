import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { haversineMeters, pointInGeojson, validarRegiaoGeojson } from '@/lib/regiaoGeo';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return withCors(NextResponse.json({ mensagem: 'lat e lng são obrigatórios' }, { status: 400 }), request);
    }

    const hasLimite = await temColunaLimite();
    if (hasLimite) {
      const r = await query(
        `WITH p AS (
           SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326) AS pt
         )
         SELECT r.id, r.nome, r.ativo, r."centroLat", r."centroLng",
                ST_AsGeoJSON(r.limite) AS "limiteGeojson",
                ST_Contains(r.limite, p.pt) AS contem,
                CASE WHEN ST_Contains(r.limite, p.pt)
                     THEN 0
                     ELSE ST_Distance(r.limite::geography, p.pt::geography)
                END AS distancia
         FROM "Regiao" r, p
         WHERE r.ativo = true AND r.limite IS NOT NULL
         ORDER BY contem DESC, distancia ASC
         LIMIT 1`,
        [lat, lng]
      );
      if (r.rows.length === 0) {
        return withCors(NextResponse.json({ regiao: null }), request);
      }
      const row: any = r.rows[0];
      const limite = parseJsonb(row.limiteGeojson);
      const limiteValid = validarRegiaoGeojson(limite);
      const limiteGeojson = limiteValid.ok ? limiteValid.geojson : null;

      return withCors(
        NextResponse.json({
          regiao: {
            id: row.id,
            nome: row.nome,
            ativo: row.ativo,
            centroLat: row.centroLat ?? null,
            centroLng: row.centroLng ?? null,
            limiteGeojson,
            contem: Boolean(row.contem),
            distancia: Number(row.distancia ?? 0),
          },
        }),
        request
      );
    }

    const all = await query(
      `SELECT id, nome, ativo, "centroLat", "centroLng", "limiteGeojson"
       FROM "Regiao"
       WHERE ativo = true`
    );

    let melhor: any = null;
    for (const row of all.rows) {
      const limite = parseJsonb(row.limiteGeojson);
      const valid = validarRegiaoGeojson(limite);
      if (!valid.ok) continue;

      const contem = pointInGeojson({ lat, lng }, valid.geojson);
      const centro = { lat: Number(row.centroLat ?? 0), lng: Number(row.centroLng ?? 0) };
      const distancia = contem ? 0 : haversineMeters({ lat, lng }, centro);

      if (!melhor || distancia < melhor.distancia) {
        melhor = {
          id: row.id,
          nome: row.nome,
          ativo: row.ativo,
          centroLat: row.centroLat ?? null,
          centroLng: row.centroLng ?? null,
          limiteGeojson: valid.geojson,
          contem,
          distancia,
        };
      }
    }

    return withCors(NextResponse.json({ regiao: melhor }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao buscar região mais próxima', error: error.message }, { status: 500 }), request);
  }
}
