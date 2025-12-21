// app/api/user/pagamento/infinite-pay/status/[orderId]/route.ts - Verificar status do pagamento
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

// GET /api/user/pagamento/infinite-pay/status/[orderId] - Verificar status do pagamento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { orderId } = await params;

    // Buscar pagamento pelo orderId
    const pagamentoResult = await query(
      `SELECT p.*, c."usuarioId"
       FROM "PagamentoInfinitePay" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       WHERE p."orderId" = $1`,
      [orderId]
    );

    if (pagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];

    // Verificar se o pagamento pertence ao usuário
    if (pagamento.usuarioId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para ver este pagamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({
      status: pagamento.status.toLowerCase(), // 'pending', 'approved', 'rejected', 'cancelled'
      transactionId: pagamento.transactionId || null,
      message: pagamento.message || null,
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[INFINITE PAY STATUS] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao verificar status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

