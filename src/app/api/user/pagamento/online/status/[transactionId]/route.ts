import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { transactionId } = await params;

    const result = await query(
      `SELECT h.status
       FROM "PagamentoHub" h
       INNER JOIN "CardCliente" c ON h."cardId" = c.id
       WHERE h."transactionId" = $1 AND c."usuarioId" = $2
       LIMIT 1`,
      [transactionId, user.id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Transação não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ status: result.rows[0].status });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao consultar status do pagamento', error: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

