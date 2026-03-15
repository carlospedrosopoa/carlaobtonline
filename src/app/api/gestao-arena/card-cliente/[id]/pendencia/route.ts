import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
      return withCors(errorResponse, request);
    }

    const { id: cardId } = await params;
    const body = await request.json().catch(() => ({}));
    const pendente = typeof body?.pendente === 'boolean' ? body.pendente : true;

    const cardResult = await query(
      `SELECT id, "pointId", status FROM "CardCliente" WHERE id = $1`,
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      const errorResponse = NextResponse.json({ mensagem: 'Card não encontrado' }, { status: 404 });
      return withCors(errorResponse, request);
    }

    const card = cardResult.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json({ mensagem: 'Você não tem acesso a este card' }, { status: 403 });
        return withCors(errorResponse, request);
      }
    }

    if (card.status !== 'ABERTO') {
      const errorResponse = NextResponse.json({ mensagem: 'Apenas cards abertos podem ficar pendentes' }, { status: 400 });
      return withCors(errorResponse, request);
    }

    await query(
      `UPDATE "CardCliente"
       SET
         "pagamentoPendente" = $2,
         "pagamentoPendenteAt" = CASE WHEN $2 THEN NOW() ELSE NULL END,
         "pagamentoPendenteById" = CASE WHEN $2 THEN $3 ELSE NULL END,
         "updatedAt" = NOW(),
         "updatedById" = $3
       WHERE id = $1`,
      [cardId, pendente, usuario.id]
    );

    const updatedResult = await query(
      `SELECT
         c.id,
         c."pagamentoPendente",
         c."pagamentoPendenteAt",
         c."pagamentoPendenteById",
         pu.id as "pendenteBy_user_id",
         pu.name as "pendenteBy_user_name",
         pu.email as "pendenteBy_user_email"
       FROM "CardCliente" c
       LEFT JOIN "User" pu ON c."pagamentoPendenteById" = pu.id
       WHERE c.id = $1`,
      [cardId]
    );

    const row = updatedResult.rows[0];
    const response = NextResponse.json({
      id: row.id,
      pagamentoPendente: row.pagamentoPendente,
      pagamentoPendenteAt: row.pagamentoPendenteAt,
      pagamentoPendenteById: row.pagamentoPendenteById,
      pagamentoPendenteBy: row.pendenteBy_user_id
        ? { id: row.pendenteBy_user_id, name: row.pendenteBy_user_name, email: row.pendenteBy_user_email }
        : null,
    });

    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao marcar pendência de pagamento', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

