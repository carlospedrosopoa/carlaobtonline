import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { handleCorsPreflight, withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) return preflightResponse;
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id: produtoId } = await params;
    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    const pointId = usuario.role === 'ORGANIZER' ? (usuario.pointIdGestor || null) : (pointIdParam || null);
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

    const paramsSql: any[] = [produtoId, pointId];
    let paramCount = 3;
    let filtroData = '';

    if (dataInicio) {
      const dt = new Date(dataInicio);
      if (!Number.isNaN(dt.getTime())) {
        filtroData += ` AND i."createdAt" >= $${paramCount}`;
        paramsSql.push(dt.toISOString());
        paramCount++;
      }
    }

    if (dataFim) {
      const dt = new Date(dataFim);
      if (!Number.isNaN(dt.getTime())) {
        filtroData += ` AND i."createdAt" <= $${paramCount}`;
        paramsSql.push(dt.toISOString());
        paramCount++;
      }
    }

    const sql = `SELECT
      i.id as "itemId",
      i."cardId",
      i.quantidade as quantidade,
      i."precoTotal" as "valorItem",
      i."createdAt" as "dataVenda",
      c."numeroCard",
      c."valorTotal" as "valorTotalComanda",
      c."usuarioId",
      c."nomeAvulso",
      u.name as "usuarioName",
      COALESCE(pag_agg.total_pago, 0) as "valorPagoComanda",
      CASE
        WHEN COALESCE(pag_agg.total_pago, 0) <= 0 THEN 0
        WHEN COALESCE(c."valorTotal", 0) <= 0 THEN 0
        ELSE LEAST(
          i."precoTotal",
          (i."precoTotal" / NULLIF(c."valorTotal", 0)) * COALESCE(pag_agg.total_pago, 0)
        )
      END as "valorPagoItem"
    FROM "ItemCard" i
    INNER JOIN "CardCliente" c ON c.id = i."cardId"
    LEFT JOIN "User" u ON u.id = c."usuarioId"
    LEFT JOIN (
      SELECT "cardId", SUM(valor) as total_pago
      FROM "PagamentoCard"
      GROUP BY "cardId"
    ) pag_agg ON c.id = pag_agg."cardId"
    WHERE i."produtoId" = $1
      AND c."pointId" = $2
      ${filtroData}
    ORDER BY i."createdAt" DESC
    LIMIT 500`;

    const result = await query(sql, paramsSql);

    const itens = result.rows.map((row: any) => {
      const valorTotalComanda = Number(row.valorTotalComanda) || 0;
      const valorPagoComanda = Number(row.valorPagoComanda) || 0;
      const valorPagoItem = Number(row.valorPagoItem) || 0;
      const valorItem = Number(row.valorItem) || 0;
      return {
        itemId: String(row.itemId),
        cardId: String(row.cardId),
        numeroCard: Number(row.numeroCard) || 0,
        cliente: String(row.usuarioName || row.nomeAvulso || 'Sem cliente'),
        dataVenda: row.dataVenda ? new Date(row.dataVenda).toISOString() : new Date().toISOString(),
        quantidade: Number(row.quantidade) || 0,
        valorItem,
        valorTotalComanda,
        valorPagoComanda,
        saldoComanda: valorTotalComanda - valorPagoComanda,
        valorPagoItem,
        saldoItem: valorItem - valorPagoItem,
      };
    });

    return withCors(NextResponse.json(itens), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao obter histórico de vendas', error: error.message }, { status: 500 }),
      request
    );
  }
}
