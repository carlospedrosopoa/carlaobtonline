import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    if (user.role !== 'ADMIN' && user.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const body = await request.json();
    const embedding = toNumberArray(body?.embedding);
    const modelVersion = body?.modelVersion ? String(body.modelVersion).trim() : null;

    if (!embedding) {
      return withCors(NextResponse.json({ mensagem: 'embedding é obrigatório' }, { status: 400 }), request);
    }

    const atletaRes = await query('SELECT id, "pointIdPrincipal" FROM "Atleta" WHERE id = $1 LIMIT 1', [id]);
    if (atletaRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }

    const pointId = atletaRes.rows[0].pointIdPrincipal as string;
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'Atleta sem arena principal' }, { status: 400 }), request);
    }

    if (user.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(user, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Você não tem acesso a esta arena' }, { status: 403 }), request);
    }

    await ensureAtletaFaceColumns();

    await query(
      'UPDATE "Atleta" SET "faceEmbedding" = $1, "faceEmbeddingModelVersion" = $2, "updatedAt" = NOW() WHERE id = $3',
      [JSON.stringify(embedding), modelVersion, id]
    );

    return withCors(NextResponse.json({ ok: true }), request);
  } catch (error: any) {
    console.error('Erro ao salvar embedding facial do atleta:', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao salvar face do atleta', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

