// app/api/user/meu-consumo/route.ts - Lista cards de cliente do usuário logado (Meu Consumo)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import type { StatusCard } from '@/types/gestaoArena';

// GET /api/user/meu-consumo
// Lista todos os cards de clientes em que o usuário autenticado é o titular (usuarioId)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as StatusCard | null;
    const incluirItens = searchParams.get('incluirItens') === 'true';
    const incluirPagamentos = searchParams.get('incluirPagamentos') === 'true';

    // Cards em que o usuário é o titular (usuarioId)
    let sql = `SELECT 
      c.id, c."pointId", c."numeroCard", c.status, c.observacoes, c."valorTotal",
      c."usuarioId", c."nomeAvulso", c."telefoneAvulso", c."createdAt", c."updatedAt", c."createdBy", c."fechadoAt", c."fechadoBy",
      p.nome as "point_nome", p."logoUrl" as "point_logoUrl", p."pagamentoOnlineAtivo" as "point_pagamentoOnlineAtivo"
    FROM "CardCliente" c
    INNER JOIN "Point" p ON c."pointId" = p.id
    WHERE c."usuarioId" = $1`;

    const params: any[] = [user.id];
    let paramCount = 2;

    if (status) {
      sql += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    sql += ` ORDER BY c."createdAt" DESC`;

    const result = await query(sql, params);

    const cards = result.rows.map((row: any) => {
      const card: any = {
        id: row.id,
        pointId: row.pointId,
        pointNome: row.point_nome,
        pointLogoUrl: row.point_logoUrl || null,
        pointPagamentoOnlineAtivo: row.point_pagamentoOnlineAtivo ?? false,
        numeroCard: row.numeroCard,
        status: row.status,
        observacoes: row.observacoes,
        valorTotal: parseFloat(row.valorTotal),
        usuarioId: row.usuarioId,
        nomeAvulso: row.nomeAvulso,
        telefoneAvulso: row.telefoneAvulso,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        fechadoAt: row.fechadoAt,
        fechadoBy: row.fechadoBy,
      };

      return card;
    });

    // Opcionalmente incluir itens, pagamentos e saldo
    if (incluirItens || incluirPagamentos) {
      for (const card of cards) {
        if (incluirItens) {
          const itensResult = await query(
            `SELECT 
              i.id, i."cardId", i."produtoId", i.quantidade, i."precoUnitario", i."precoTotal", i.observacoes,
              i."createdAt", i."updatedAt",
              p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
              p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria"
            FROM "ItemCard" i
            LEFT JOIN "Produto" p ON i."produtoId" = p.id
            WHERE i."cardId" = $1
            ORDER BY i."createdAt" ASC`,
            [card.id]
          );

          card.itens = itensResult.rows.map((itemRow: any) => ({
            id: itemRow.id,
            cardId: itemRow.cardId,
            produtoId: itemRow.produtoId,
            quantidade: parseFloat(itemRow.quantidade),
            precoUnitario: parseFloat(itemRow.precoUnitario),
            precoTotal: parseFloat(itemRow.precoTotal),
            observacoes: itemRow.observacoes,
            createdAt: itemRow.createdAt,
            updatedAt: itemRow.updatedAt,
            produto: itemRow.produto_id
              ? {
                  id: itemRow.produto_id,
                  nome: itemRow.produto_nome,
                  descricao: itemRow.produto_descricao,
                  precoVenda: parseFloat(itemRow.produto_precoVenda),
                  categoria: itemRow.produto_categoria,
                }
              : null,
          }));
        }

        if (incluirPagamentos) {
          const pagamentosResult = await query(
            `SELECT 
              p.id, p."cardId", p."formaPagamentoId", p.valor, p.observacoes, p."createdAt", p."createdBy",
              fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo"
            FROM "PagamentoCard" p
            LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
            WHERE p."cardId" = $1
            ORDER BY p."createdAt" ASC`,
            [card.id]
          );

          card.pagamentos = pagamentosResult.rows.map((pagRow: any) => ({
            id: pagRow.id,
            cardId: pagRow.cardId,
            formaPagamentoId: pagRow.formaPagamentoId,
            valor: parseFloat(pagRow.valor),
            observacoes: pagRow.observacoes,
            createdAt: pagRow.createdAt,
            createdBy: pagRow.createdBy,
            formaPagamento: pagRow.formaPagamento_id
              ? {
                  id: pagRow.formaPagamento_id,
                  nome: pagRow.formaPagamento_nome,
                  tipo: pagRow.formaPagamento_tipo,
                }
              : null,
          }));
        }

        // Calcular saldo (valorTotal - totalPago)
        const totalPagoResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
          [card.id]
        );
        const totalPago = parseFloat(totalPagoResult.rows[0].total);
        card.totalPago = totalPago;
        card.saldo = card.valorTotal - totalPago;
      }
    }

    const response = NextResponse.json(cards, {
      headers: {
        'Cache-Control': 'no-store',
        Vary: 'Authorization',
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar consumo do usuário:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar consumo do usuário', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// OPTIONS /api/user/meu-consumo - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}


