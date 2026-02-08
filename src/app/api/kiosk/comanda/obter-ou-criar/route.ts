import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pointId = String(body?.pointId || '').trim();
    const atletaId = String(body?.atletaId || '').trim();

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }
    if (!atletaId) {
      return withCors(NextResponse.json({ mensagem: 'atletaId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    const atletaRes = await query(
      `SELECT id, nome, fone, "usuarioId"
       FROM "Atleta"
       WHERE id = $1
       LIMIT 1`,
      [atletaId]
    );
    if (atletaRes.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }

    const atleta = atletaRes.rows[0];
    const usuarioId = atleta.usuarioId || null;
    const nomeAvulso = usuarioId ? null : atleta.nome;
    const telefoneAvulso = usuarioId ? null : atleta.fone;

    let card: any | null = null;
    if (usuarioId) {
      const cardOpen = await query(
        `SELECT *
         FROM "CardCliente"
         WHERE "pointId" = $1
           AND "usuarioId" = $2
           AND status = 'ABERTO'
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [pointId, usuarioId]
      );
      card = cardOpen.rows[0] || null;
    } else {
      const tel = typeof telefoneAvulso === 'string' ? telefoneAvulso.replace(/\D/g, '') : '';
      const cardOpen = await query(
        `SELECT *
         FROM "CardCliente"
         WHERE "pointId" = $1
           AND status = 'ABERTO'
           AND "nomeAvulso" = $2
           AND REGEXP_REPLACE(COALESCE("telefoneAvulso", ''), '[^0-9]', '', 'g') = $3
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [pointId, nomeAvulso, tel]
      );
      card = cardOpen.rows[0] || null;
    }

    if (!card) {
      const numeroResult = await query('SELECT proximo_numero_card($1) as "numeroCard"', [pointId]);
      const numeroCard = numeroResult.rows[0].numeroCard;

      const insertRes = await query(
        `INSERT INTO "CardCliente" (
          id, "pointId", "numeroCard", status, observacoes, "valorTotal", "usuarioId",
          "nomeAvulso", "telefoneAvulso", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, 'ABERTO', NULL, 0, $3, $4, $5, NOW(), NOW()
        ) RETURNING *`,
        [pointId, numeroCard, usuarioId, nomeAvulso, telefoneAvulso]
      );
      card = insertRes.rows[0];
    }

    const response = NextResponse.json({
      card: {
        id: card.id,
        pointId: card.pointId,
        numeroCard: Number(card.numeroCard),
        status: card.status,
        valorTotal: Number(card.valorTotal) || 0,
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter/criar comanda (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao obter/criar comanda', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

