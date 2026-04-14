import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

function csvCell(value: any): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
    const dataInicio = (searchParams.get('dataInicio') || '').trim();
    const dataFim = (searchParams.get('dataFim') || '').trim();

    if (!dataInicio || !dataFim) {
      return withCors(NextResponse.json({ mensagem: 'dataInicio e dataFim são obrigatórios (YYYY-MM-DD)' }, { status: 400 }), request);
    }

    const pointId = usuario.role === 'ORGANIZER' ? (usuario.pointIdGestor || null) : (pointIdParam || null);
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

    const sql = `
      SELECT
        COALESCE(p.categoria, 'Sem categoria') as categoria,
        COALESCE(p.nome, '(produto removido)') as produto,
        c."numeroCard" as "numeroCard",
        COALESCE(u.name, c."nomeAvulso", 'Sem cliente') as cliente,
        to_char(i."createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') as "dataInclusaoItem",
        i.quantidade as quantidade,
        i."precoTotal" as "valorItem"
      FROM "ItemCard" i
      INNER JOIN "CardCliente" c ON c.id = i."cardId"
      LEFT JOIN "Produto" p ON p.id = i."produtoId"
      LEFT JOIN "User" u ON u.id = c."usuarioId"
      WHERE c."pointId" = $1
        AND c.status <> 'CANCELADO'
        AND (i."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (i."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      ORDER BY categoria ASC, produto ASC, "dataInclusaoItem" ASC, "numeroCard" ASC
      LIMIT 50000
    `;

    const result = await query(sql, [pointId, dataInicio, dataFim]);

    const header = [
      'Categoria',
      'Produto',
      'NumeroComanda',
      'Cliente',
      'DataInclusaoItem',
      'Quantidade',
      'ValorItem',
    ];

    const lines = [header.map(csvCell).join(';')];
    for (const row of result.rows) {
      const valor = Number(row.valorItem) || 0;
      const valorPt = valor.toFixed(2).replace('.', ',');
      lines.push(
        [
          row.categoria,
          row.produto,
          row.numeroCard,
          row.cliente,
          row.dataInclusaoItem,
          Number(row.quantidade) || 0,
          valorPt,
        ]
          .map(csvCell)
          .join(';')
      );
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    const filename = `receitas-por-categoria-${dataInicio}-a-${dataFim}.csv`;

    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

    return withCors(res, request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao exportar receitas por categoria', error: error?.message || 'Erro interno' },
        { status: 500 }
      ),
      request
    );
  }
}

