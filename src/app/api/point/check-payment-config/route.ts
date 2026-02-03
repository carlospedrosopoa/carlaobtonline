import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointIdsRaw = searchParams.get('pointIds') || '';
    const ids = pointIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'pointIds é obrigatório' }, { status: 400 }),
        request
      );
    }

    const uniqueIds = Array.from(new Set(ids)).slice(0, 200);
    const configs: Record<
      string,
      { onlinePayments: boolean; pagBank: boolean; infinitePay: boolean }
    > = {};

    for (const id of uniqueIds) {
      configs[id] = { onlinePayments: false, pagBank: false, infinitePay: false };
    }

    let result;
    try {
      result = await query(
        `SELECT id, "pagamentoOnlineAtivo", "pagBankAtivo", "infinitePayHandle"
         FROM "Point"
         WHERE id = ANY($1::text[])`,
        [uniqueIds]
      );
    } catch (e: any) {
      if (e?.code !== '42703') {
        throw e;
      }
      result = await query(
        `SELECT id, "pagBankAtivo", "infinitePayHandle"
         FROM "Point"
         WHERE id = ANY($1::text[])`,
        [uniqueIds]
      );
    }

    for (const row of result.rows) {
      configs[row.id] = {
        onlinePayments: row.pagamentoOnlineAtivo === true,
        pagBank: row.pagBankAtivo === true,
        infinitePay: typeof row.infinitePayHandle === 'string' && row.infinitePayHandle.trim().length > 0,
      };
    }

    return withCors(NextResponse.json({ configs }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao verificar configuração de pagamento', error: error?.message },
        { status: 500 }
      ),
      request
    );
  }
}
