// app/api/gestao-arena/conta-corrente/[id]/movimentacao/route.ts - API de Movimentações da Conta Corrente
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/conta-corrente/[id]/movimentacao - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/conta-corrente/[id]/movimentacao - Listar movimentações
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { id: contaCorrenteId } = await params;

    // Verificar se a conta corrente existe e se o usuário tem acesso
    const contaResult = await query(
      'SELECT "pointId" FROM "ContaCorrenteCliente" WHERE id = $1',
      [contaCorrenteId]
    );

    if (contaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, contaResult.rows[0].pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const result = await query(
      `SELECT 
        m.id, m."contaCorrenteId", m.tipo, m.valor, m.justificativa, 
        m."pagamentoCardId", m."createdById", m."createdAt",
        u.name as "createdByNome", u.email as "createdByEmail",
        pc."cardId", c."numeroCard"
      FROM "MovimentacaoContaCorrente" m
      LEFT JOIN "User" u ON m."createdById" = u.id
      LEFT JOIN "PagamentoCard" pc ON m."pagamentoCardId" = pc.id
      LEFT JOIN "CardCliente" c ON pc."cardId" = c.id
      WHERE m."contaCorrenteId" = $1
      ORDER BY m."createdAt" DESC`,
      [contaCorrenteId]
    );

    const movimentacoes = result.rows.map((row) => ({
      id: row.id,
      contaCorrenteId: row.contaCorrenteId,
      tipo: row.tipo,
      valor: parseFloat(row.valor),
      justificativa: row.justificativa,
      pagamentoCardId: row.pagamentoCardId || null,
      createdAt: row.createdAt,
      createdBy: row.createdById ? {
        id: row.createdById,
        name: row.createdByNome,
        email: row.createdByEmail,
      } : null,
      card: row.cardId ? {
        id: row.cardId,
        numeroCard: row.numeroCard,
      } : null,
    }));

    const response = NextResponse.json(movimentacoes);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar movimentações:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar movimentações', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/conta-corrente/[id]/movimentacao - Criar movimentação manual (crédito ou débito)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar movimentações' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: contaCorrenteId } = await params;
    const body = await request.json();
    const { tipo, valor, justificativa } = body;

    // Validações
    if (!tipo || !['CREDITO', 'DEBITO'].includes(tipo)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Tipo deve ser CREDITO ou DEBITO' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!valor || valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Justificativa é obrigatória' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a conta corrente existe e se o usuário tem acesso
    const contaResult = await query(
      'SELECT "pointId" FROM "ContaCorrenteCliente" WHERE id = $1',
      [contaCorrenteId]
    );

    if (contaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, contaResult.rows[0].pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Criar movimentação
    const movimentacaoResult = await query(
      `INSERT INTO "MovimentacaoContaCorrente" (
        id, "contaCorrenteId", tipo, valor, justificativa, "createdById", "createdAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW()
      ) RETURNING *`,
      [contaCorrenteId, tipo, valor, justificativa.trim(), usuario.id]
    );

    // Atualizar saldo da conta corrente
    const saldoAtualizacao = tipo === 'CREDITO' ? valor : -valor;
    await query(
      `UPDATE "ContaCorrenteCliente"
       SET saldo = saldo + $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [saldoAtualizacao, contaCorrenteId]
    );

    const movimentacao = {
      id: movimentacaoResult.rows[0].id,
      contaCorrenteId: movimentacaoResult.rows[0].contaCorrenteId,
      tipo: movimentacaoResult.rows[0].tipo,
      valor: parseFloat(movimentacaoResult.rows[0].valor),
      justificativa: movimentacaoResult.rows[0].justificativa,
      createdAt: movimentacaoResult.rows[0].createdAt,
      createdBy: {
        id: usuario.id,
        name: usuario.name,
        email: usuario.email,
      },
    };

    const response = NextResponse.json(movimentacao, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar movimentação:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar movimentação', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

