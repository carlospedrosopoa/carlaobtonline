import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) return preflightResponse;
  return new NextResponse(null, { status: 204 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id: cardId } = await params;
    const body = await request.json().catch(() => ({}));
    const favorito = body?.favorito === true;

    const cardResult = await query(`SELECT id, "pointId" FROM "CardCliente" WHERE id = $1`, [cardId]);
    if (cardResult.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Comanda não encontrada' }, { status: 404 }), request);
    }

    const pointId = cardResult.rows[0].pointId as string;
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

    if (favorito) {
      await query(
        `INSERT INTO "CardClienteFavorito" (id, "cardId", "createdAt")
         VALUES (gen_random_uuid()::text, $1, NOW())
         ON CONFLICT ("cardId") DO NOTHING`,
        [cardId]
      );
    } else {
      await query(`DELETE FROM "CardClienteFavorito" WHERE "cardId" = $1`, [cardId]);
    }

    return withCors(NextResponse.json({ id: cardId, favorito }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao atualizar favorito da comanda', error: error.message },
        { status: 500 }
      ),
      request
    );
  }
}
