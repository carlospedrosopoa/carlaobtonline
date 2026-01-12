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

