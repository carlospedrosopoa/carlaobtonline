import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

async function ensureAtletaFaceColumns() {
  await query('ALTER TABLE "Atleta" ADD COLUMN IF NOT EXISTS "faceEmbedding" JSONB NULL');
  await query('ALTER TABLE "Atleta" ADD COLUMN IF NOT EXISTS "faceEmbeddingModelVersion" TEXT NULL');
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const v of value) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out.length > 0 ? out : null;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pointId = String(body?.pointId || '').trim();
    const topK = Math.max(1, Math.min(10, Number(body?.topK || 5)));
    const threshold = Number(body?.threshold ?? 0.5);
    const modelVersion = body?.modelVersion ? String(body.modelVersion) : null;
    const embedding = toNumberArray(body?.embedding);

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    if (!embedding) {
      return withCors(NextResponse.json({ mensagem: 'embedding é obrigatório' }, { status: 400 }), request);
    }

    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      return withCors(NextResponse.json({ mensagem: 'threshold inválido' }, { status: 400 }), request);
    }

    await ensureAtletaFaceColumns();

    const res = await query(
      `SELECT id, nome, fone as telefone, "faceEmbedding", "faceEmbeddingModelVersion"
       FROM "Atleta"
       WHERE "pointIdPrincipal" = $1
         AND "faceEmbedding" IS NOT NULL`,
      [pointId]
    );

    const candidates = res.rows
      .map((row: any) => {
        if (modelVersion && row.faceEmbeddingModelVersion && String(row.faceEmbeddingModelVersion) !== modelVersion) {
          return null;
        }
        const ref = toNumberArray(row.faceEmbedding);
        if (!ref) return null;
        const score = cosineSimilarity(embedding, ref);
        return {
          id: row.id,
          nome: row.nome,
          telefone: row.telefone,
          score,
        };
      })
      .filter(Boolean)
      .filter((c: any) => c.score >= threshold)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK);

    return withCors(NextResponse.json({ candidatos: candidates }), request);
  } catch (error: any) {
    console.error('Erro ao reconhecer atleta (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao reconhecer atleta', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

