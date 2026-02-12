import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireKioskAuth(request, id);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    const res = await query(
      `SELECT id, nome, "logoUrl", "pixChave"
       FROM "Point"
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Estabelecimento não encontrado' }, { status: 404 }), request);
    }

    return withCors(NextResponse.json(res.rows[0]), request);
  } catch (e: any) {
    console.error('Erro ao obter point (kiosk):', e);
    return withCors(NextResponse.json({ mensagem: 'Erro ao obter estabelecimento' }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

