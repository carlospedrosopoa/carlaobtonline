// app/api/gestao-arena/conta-corrente/route.ts - API de Conta Corrente
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/conta-corrente - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/conta-corrente - Listar contas correntes
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const usuarioId = searchParams.get('usuarioId');

    let sql = `SELECT 
      cc.id, cc."usuarioId", cc."pointId", cc.saldo, cc."createdAt", cc."updatedAt",
      u.name as "usuarioNome", u.email as "usuarioEmail",
      p.nome as "pointNome"
    FROM "ContaCorrenteCliente" cc
    INNER JOIN "User" u ON cc."usuarioId" = u.id
    INNER JOIN "Point" p ON cc."pointId" = p.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas contas da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND cc."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      // ADMIN pode filtrar por pointId
      sql += ` AND cc."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    }

    // Filtrar por usuário se informado
    if (usuarioId) {
      sql += ` AND cc."usuarioId" = $${paramCount}`;
      params.push(usuarioId);
      paramCount++;
    }

    sql += ` ORDER BY cc."updatedAt" DESC`;

    const result = await query(sql, params);

    const contas = result.rows.map((row) => ({
      id: row.id,
      usuarioId: row.usuarioId,
      pointId: row.pointId,
      saldo: parseFloat(row.saldo),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      usuario: {
        id: row.usuarioId,
        name: row.usuarioNome,
        email: row.usuarioEmail,
      },
      point: {
        id: row.pointId,
        nome: row.pointNome,
      },
    }));

    const response = NextResponse.json(contas);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar contas correntes:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar contas correntes', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/conta-corrente - Abrir conta corrente (opcionalmente com crédito inicial)
export async function POST(request: NextRequest) {
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
        { mensagem: 'Você não tem permissão para abrir conta corrente' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const usuarioId = body?.usuarioId as string | undefined;
    const pointIdBody = body?.pointId as string | undefined;
    const creditoInicialRaw = body?.creditoInicial as number | string | undefined | null;
    const justificativaRaw = body?.justificativa as string | undefined;

    if (!usuarioId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'usuarioId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    let pointId: string | null = null;
    if (usuario.role === 'ORGANIZER') {
      if (!usuario.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Arena do organizador não identificada' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      pointId = usuario.pointIdGestor;
    } else {
      pointId = pointIdBody ?? null;
    }

    if (!pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'pointId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este point' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const creditoInicial = creditoInicialRaw === null || creditoInicialRaw === undefined
      ? 0
      : typeof creditoInicialRaw === 'string'
        ? parseFloat(creditoInicialRaw)
        : creditoInicialRaw;

    if (Number.isNaN(creditoInicial) || creditoInicial < 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'creditoInicial deve ser um número maior ou igual a zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const justificativa = (justificativaRaw ?? '').trim();
    if (creditoInicial > 0 && !justificativa) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Justificativa é obrigatória para crédito inicial' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const existente = await query(
      'SELECT id FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2',
      [usuarioId, pointId]
    );

    if (existente.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente já existe para este cliente nesta arena' },
        { status: 409 }
      );
      return withCors(errorResponse, request);
    }

    const novaContaResult = await query(
      `INSERT INTO "ContaCorrenteCliente" (id, "usuarioId", "pointId", saldo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 0, NOW(), NOW())
       RETURNING id`,
      [usuarioId, pointId]
    );

    const contaCorrenteId = novaContaResult.rows[0].id as string;

    if (creditoInicial > 0) {
      await query(
        `INSERT INTO "MovimentacaoContaCorrente" (
          id, "contaCorrenteId", tipo, valor, justificativa, "createdById", "createdAt"
        ) VALUES (
          gen_random_uuid()::text, $1, 'CREDITO', $2, $3, $4, NOW()
        )`,
        [contaCorrenteId, creditoInicial, justificativa, usuario.id]
      );

      await query(
        `UPDATE "ContaCorrenteCliente"
         SET saldo = saldo + $1, "updatedAt" = NOW()
         WHERE id = $2`,
        [creditoInicial, contaCorrenteId]
      );
    }

    const contaResult = await query(
      `SELECT 
        cc.id, cc."usuarioId", cc."pointId", cc.saldo, cc."createdAt", cc."updatedAt",
        u.name as "usuarioNome", u.email as "usuarioEmail",
        p.nome as "pointNome"
      FROM "ContaCorrenteCliente" cc
      INNER JOIN "User" u ON cc."usuarioId" = u.id
      INNER JOIN "Point" p ON cc."pointId" = p.id
      WHERE cc.id = $1`,
      [contaCorrenteId]
    );

    const row = contaResult.rows[0];
    const conta = {
      id: row.id,
      usuarioId: row.usuarioId,
      pointId: row.pointId,
      saldo: parseFloat(row.saldo),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      usuario: {
        id: row.usuarioId,
        name: row.usuarioNome,
        email: row.usuarioEmail,
      },
      point: {
        id: row.pointId,
        nome: row.pointNome,
      },
    };

    const response = NextResponse.json(conta, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao abrir conta corrente:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao abrir conta corrente', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

