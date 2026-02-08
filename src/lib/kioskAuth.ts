import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function requireKioskAuth(
  request: NextRequest,
  pointId: string
): Promise<{ pointId: string } | NextResponse> {
  const kioskKey =
    request.headers.get('x-kiosk-key') ||
    request.headers.get('x-kiosk_key') ||
    request.headers.get('x-kiosk-api-key') ||
    '';

  if (!kioskKey) {
    return NextResponse.json({ mensagem: 'Chave do kiosk ausente' }, { status: 401 });
  }

  let pointKey: string | null = null;
  try {
    const res = await query('SELECT "kioskApiKey" FROM "Point" WHERE id = $1 LIMIT 1', [pointId]);
    pointKey = res.rows[0]?.kioskApiKey ?? null;
  } catch (e: any) {
    if (e?.code !== '42703') {
      throw e;
    }
    pointKey = null;
  }

  const effectiveKey = pointKey || process.env.KIOSK_API_KEY || null;
  if (!effectiveKey || kioskKey !== effectiveKey) {
    return NextResponse.json({ mensagem: 'Não autorizado' }, { status: 401 });
  }

  return { pointId };
}

