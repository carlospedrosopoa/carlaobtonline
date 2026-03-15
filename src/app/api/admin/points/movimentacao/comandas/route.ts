import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;

    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const sourcePointId = searchParams.get('sourcePointId') || '';
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const operadorId = searchParams.get('operadorId');

    if (!sourcePointId) {
      const errorResponse = NextResponse.json({ mensagem: 'sourcePointId é obrigatório' }, { status: 400 });
      return withCors(errorResponse, request);
    }

    const params: any[] = [sourcePointId];
    let pc = 2;

    let filtroPagamentos = `c."pointId" = $1`;
    if (dataInicio) {
      filtroPagamentos += ` AND p."createdAt"::date >= $${pc}`;
      params.push(dataInicio);
      pc++;
    }
    if (dataFim) {
      filtroPagamentos += ` AND p."createdAt"::date <= $${pc}`;
      params.push(dataFim);
      pc++;
    }
    if (operadorId) {
      filtroPagamentos += ` AND COALESCE(p."createdById", p."createdBy") = $${pc}`;
      params.push(operadorId);
      pc++;
    }

    const sql = `
      WITH pagamentos_filtrados AS (
        SELECT
          p."cardId",
          COUNT(*)::int as pagamentos_count,
          SUM(p.valor)::numeric(10,2) as total_pago
        FROM "PagamentoCard" p
        INNER JOIN "CardCliente" c ON p."cardId" = c.id
        WHERE ${filtroPagamentos}
        GROUP BY p."cardId"
      ),
      itens_por_card AS (
        SELECT
          i."cardId",
          COUNT(*)::int as itens_count
        FROM "ItemCard" i
        GROUP BY i."cardId"
      )
      SELECT
        c.id,
        c."numeroCard",
        c.status,
        c."createdAt",
        c."valorTotal",
        COALESCE(pf.total_pago, 0)::numeric(10,2) as "totalPagoFiltrado",
        COALESCE(pf.pagamentos_count, 0)::int as "pagamentosCountFiltrado",
        COALESCE(ipc.itens_count, 0)::int as "itensCount",
        COALESCE(u.name, c."nomeAvulso", 'Cliente') as "clienteNome",
        c."usuarioId"
      FROM pagamentos_filtrados pf
      INNER JOIN "CardCliente" c ON c.id = pf."cardId"
      LEFT JOIN itens_por_card ipc ON ipc."cardId" = c.id
      LEFT JOIN "User" u ON c."usuarioId" = u.id
      ORDER BY c."createdAt" DESC, c."numeroCard" DESC
      LIMIT 500
    `;

    const result = await query(sql, params);
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar comandas', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

