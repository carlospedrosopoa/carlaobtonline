import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

function parseIso(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');
    const qParam = searchParams.get('q');

    const limitRaw = parseInt(searchParams.get('limit') || '500', 10);
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);
    const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 500, 1, 2000);
    const offset = clampInt(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0, 1_000_000);

    const dataInicio = parseIso(dataInicioParam);
    const dataFim = parseIso(dataFimParam);
    if (!dataInicio || !dataFim) {
      return withCors(
        NextResponse.json({ mensagem: 'dataInicio e dataFim são obrigatórios (ISO)' }, { status: 400 }),
        request
      );
    }

    let pointId: string | null = null;
    if (usuario.role === 'ORGANIZER') {
      pointId = usuario.pointIdGestor || null;
    } else {
      pointId = pointIdParam || null;
    }

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

    const q = qParam && qParam.trim() ? `%${qParam.trim().toLowerCase()}%` : null;

    const sql = `
      WITH card_totals AS (
        SELECT
          c.id as "cardId",
          c."numeroCard"::int as "numeroCard",
          c.status::text as status,
          COALESCE(u.name, c."nomeAvulso", 'Sem cliente') as "clienteNome",
          COALESCE(SUM(i.quantidade), 0)::int as "totalItens",
          COALESCE(SUM(i."precoTotal"), 0)::numeric as total,
          MIN(i."createdAt") as "primeiroItemAt",
          MAX(i."createdAt") as "ultimoItemAt"
        FROM "ItemCard" i
        JOIN "CardCliente" c ON c.id = i."cardId"
        LEFT JOIN "User" u ON u.id = c."usuarioId"
        WHERE c."pointId" = $1
          AND c.status <> 'CANCELADO'
          AND i."createdAt" >= $2
          AND i."createdAt" <= $3
          AND (
            $4::text IS NULL
            OR CAST(c."numeroCard" as text) ILIKE $4
            OR LOWER(COALESCE(u.name, c."nomeAvulso", '')) ILIKE $4
          )
        GROUP BY c.id, c."numeroCard", c.status, u.name, c."nomeAvulso"
      )
      SELECT
        "cardId" as id,
        "numeroCard",
        status,
        "clienteNome",
        "totalItens",
        total,
        "primeiroItemAt",
        "ultimoItemAt",
        COUNT(*) OVER()::int as "totalCount"
      FROM card_totals
      ORDER BY total DESC, "ultimoItemAt" DESC
      LIMIT $5 OFFSET $6
    `;

    const params = [pointId, dataInicio.toISOString(), dataFim.toISOString(), q, limit, offset];
    const result = await query(sql, params);
    const total = result.rows?.[0]?.totalCount ? Number(result.rows[0].totalCount) : 0;

    const itens = result.rows.map((r: any) => ({
      id: String(r.id),
      numeroCard: Number(r.numeroCard) || 0,
      status: String(r.status),
      clienteNome: String(r.clienteNome || ''),
      totalItens: Number(r.totalItens) || 0,
      total: Number(r.total) || 0,
      primeiroItemAt: new Date(r.primeiroItemAt).toISOString(),
      ultimoItemAt: new Date(r.ultimoItemAt).toISOString(),
    }));

    return withCors(NextResponse.json({ total, itens }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao listar comandas do dashboard operacional', error: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

