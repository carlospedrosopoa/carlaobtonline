export function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const v of value) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out.length > 0 ? out : null;
}

export function requireVectorDim(vec: number[], dim: number) {
  if (vec.length !== dim) {
    throw new Error(`Vetor inválido: esperado ${dim} dimensões, recebido ${vec.length}`);
  }
}

export function projectToDim(vec: number[], dim: number) {
  const out = new Array(dim).fill(0);
  for (let i = 0; i < vec.length; i++) {
    const j = i % dim;
    const sign = ((Math.imul(i + 1, 2654435761) >>> 0) & 1) === 0 ? 1 : -1;
    out[j] += vec[i] * sign;
  }
  return out;
}

export function l2Normalize(vec: number[]) {
  let sum = 0;
  for (const v of vec) sum += v * v;
  if (sum === 0) return vec;
  const inv = 1 / Math.sqrt(sum);
  return vec.map((v) => v * inv);
}

export function toPgVectorLiteral(vec: number[]) {
  const parts = vec.map((n) => {
    const x = Number.isFinite(n) ? n : 0;
    const y = Object.is(x, -0) ? 0 : x;
    return String(y);
  });
  return `[${parts.join(',')}]`;
}
