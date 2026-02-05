import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { hubGetPublicKey } from '@/lib/hubPaymentsClient';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!('user' in authResult)) {
      return withCors(authResult as NextResponse, request);
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    let effectivePagBankToken: string | null = process.env.PAGBANK_TOKEN || null;

    if (cardId) {
      const cardRes = await query(
        `SELECT c.id, c."usuarioId", c."pointId"
         FROM "CardCliente" c
         WHERE c.id = $1 AND c."usuarioId" = $2
         LIMIT 1`,
        [cardId, user.id]
      );

      if (cardRes.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Card não encontrado' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      const pointId = cardRes.rows[0].pointId as string;
      try {
        const pointCfg = await query(
          `SELECT "pagBankToken"
           FROM "Point"
           WHERE id = $1
           LIMIT 1`,
          [pointId]
        );
        effectivePagBankToken = pointCfg.rows[0]?.pagBankToken || effectivePagBankToken;
      } catch (e: any) {
        if (e?.code !== '42703') {
          throw e;
        }
      }
    }

    const pk = await hubGetPublicKey({
      pagbankToken: effectivePagBankToken,
    });

    const response = NextResponse.json({
      publicKey: pk.public_key,
      createdAt: pk.created_at ?? null,
    });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      {
        mensagem: 'Erro ao obter chave pública do PagBank',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
