import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';
import { l2Normalize, projectToDim, toNumberArray, toPgVectorLiteral } from '@/lib/faceVector';

function pickDescriptor(body: any) {
  return body?.descriptor ?? body?.embedding ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const pointId = String(body?.pointId || '').trim();
    const modelVersion = body?.modelVersion ? String(body.modelVersion).trim() : null;
    const descriptorRaw = toNumberArray(pickDescriptor(body));

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    if (!descriptorRaw) {
      return withCors(NextResponse.json({ mensagem: 'descriptor é obrigatório' }, { status: 400 }), request);
    }

    const { id } = await params;

    const atletaRes = await query(
      'SELECT id, "pointIdPrincipal" FROM "Atleta" WHERE id = $1 LIMIT 1',
      [id]
    );
    if (atletaRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }
    if (String(atletaRes.rows[0].pointIdPrincipal || '') !== pointId) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não pertence a esta arena' }, { status: 403 }), request);
    }

    const descriptor128 = descriptorRaw.length === 128 ? descriptorRaw : projectToDim(descriptorRaw, 128);
    const descriptor = l2Normalize(descriptor128);
    const vectorLiteral = toPgVectorLiteral(descriptor);

    try {
      await query(
        'UPDATE "Atleta" SET "faceDescriptor" = $1::vector, "faceDescriptorModelVersion" = $2, "updatedAt" = NOW() WHERE id = $3',
        [vectorLiteral, modelVersion, id]
      );
    } catch (e: any) {
      if (e?.code === '42703' || e?.code === '42704') {
        return withCors(
          NextResponse.json(
            { mensagem: 'Reconhecimento facial não configurado no banco. Rode a migration de pgvector.' },
            { status: 500 }
          ),
          request
        );
      }
      throw e;
    }

    return withCors(NextResponse.json({ ok: true }), request);
  } catch (error: any) {
    console.error('Erro ao cadastrar reconhecimento facial (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao cadastrar reconhecimento facial', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

