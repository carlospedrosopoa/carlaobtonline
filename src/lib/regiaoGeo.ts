export type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };
export type GeoJsonMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] };
export type RegiaoGeojson = GeoJsonPolygon | GeoJsonMultiPolygon;

function isNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isLngLatPair(v: any): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && isNumber(v[0]) && isNumber(v[1]);
}

function normalizeRing(ring: number[][] | null | undefined): number[][] {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

export function validarRegiaoGeojson(input: any): { ok: true; geojson: RegiaoGeojson } | { ok: false; mensagem: string } {
  if (!input || typeof input !== 'object') return { ok: false, mensagem: 'limiteGeojson inválido' };
  if (input.type !== 'Polygon' && input.type !== 'MultiPolygon') return { ok: false, mensagem: 'GeoJSON deve ser Polygon ou MultiPolygon' };

  if (input.type === 'Polygon') {
    const coords = input.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) return { ok: false, mensagem: 'Polygon sem coordenadas' };
    for (const ring of coords) {
      if (!Array.isArray(ring) || ring.length < 4) return { ok: false, mensagem: 'Polygon com anel inválido' };
      for (const p of ring) {
        if (!isLngLatPair(p)) return { ok: false, mensagem: 'Polygon com ponto inválido' };
      }
    }
    return { ok: true, geojson: input as GeoJsonPolygon };
  }

  const coords = input.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return { ok: false, mensagem: 'MultiPolygon sem coordenadas' };
  for (const poly of coords) {
    if (!Array.isArray(poly) || poly.length === 0) return { ok: false, mensagem: 'MultiPolygon com polígono inválido' };
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) return { ok: false, mensagem: 'MultiPolygon com anel inválido' };
      for (const p of ring) {
        if (!isLngLatPair(p)) return { ok: false, mensagem: 'MultiPolygon com ponto inválido' };
      }
    }
  }
  return { ok: true, geojson: input as GeoJsonMultiPolygon };
}

function polygonAreaAndCentroid(ringRaw: number[][] | null | undefined): { area: number; lng: number; lat: number } | null {
  if (!Array.isArray(ringRaw) || ringRaw.length < 4) return null;
  const ring = normalizeRing(ringRaw);
  if (ring.length < 4) return null;

  let a = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }

  if (a === 0) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ringRaw) {
      sx += x;
      sy += y;
    }
    const n = ringRaw.length;
    return { area: 0, lng: sx / n, lat: sy / n };
  }

  const area = a / 2;
  const lng = cx / (6 * a);
  const lat = cy / (6 * a);
  return { area, lng, lat };
}

export function centroidFromGeojson(geojson: RegiaoGeojson): { lat: number; lng: number } {
  if (geojson.type === 'Polygon') {
    const outer = geojson.coordinates?.[0];
    const c = polygonAreaAndCentroid(outer);
    if (!c) {
      const first = outer?.[0];
      if (first && isLngLatPair(first)) return { lat: first[1], lng: first[0] };
      return { lat: 0, lng: 0 };
    }
    return { lat: c.lat, lng: c.lng };
  }

  let sumA = 0;
  let sumX = 0;
  let sumY = 0;

  for (const poly of geojson.coordinates) {
    const c = polygonAreaAndCentroid(poly?.[0]);
    if (!c) continue;
    const w = Math.abs(c.area);
    sumA += w;
    sumX += c.lng * w;
    sumY += c.lat * w;
  }

  if (sumA === 0) {
    const first = geojson.coordinates?.[0]?.[0]?.[0];
    if (first && isLngLatPair(first)) return { lat: first[1], lng: first[0] };
    return { lat: 0, lng: 0 };
  }

  return { lat: sumY / sumA, lng: sumX / sumA };
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointInRing(point: { lng: number; lat: number }, ringRaw: number[][]): boolean {
  const ring = normalizeRing(ringRaw);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeojson(point: { lng: number; lat: number }, geojson: RegiaoGeojson): boolean {
  if (geojson.type === 'Polygon') {
    return pointInRing(point, geojson.coordinates[0]);
  }
  return geojson.coordinates.some((poly) => pointInRing(point, poly[0]));
}
