// app/api/gestao-arena/conta-corrente/usuario/[usuarioId]/route.ts - API de Conta Corrente por Usuário
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/conta-corrente/usuario/[usuarioId] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/conta-corrente/usuario/[usuarioId] - Consultar contas correntes de um usuário
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ usuarioId: string }> }
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

    const { usuarioId } = await params;

    // Verificar se o usuário pode acessar (próprio usuário, ADMIN ou ORGANIZER da arena)
    if (usuario.role !== 'ADMIN' && usuario.id !== usuarioId) {
      // Se for ORGANIZER, pode ver contas das suas arenas
      if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
        // Verificar se há conta corrente do usuário na arena do organizador
        const contaResult = await query(
          'SELECT "pointId" FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2',
          [usuarioId, usuario.pointIdGestor]
        );
        
        if (contaResult.rows.length === 0) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Você não tem acesso a esta conta corrente' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
      } else {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para acessar esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const result = await query(
      `SELECT 
        cc.id, cc."usuarioId", cc."pointId", cc.saldo, cc."createdAt", cc."updatedAt",
        u.name as "usuarioNome", u.email as "usuarioEmail",
        p.nome as "pointNome"
      FROM "ContaCorrenteCliente" cc
      INNER JOIN "User" u ON cc."usuarioId" = u.id
      INNER JOIN "Point" p ON cc."pointId" = p.id
      WHERE cc."usuarioId" = $1
      ORDER BY cc."updatedAt" DESC`,
      [usuarioId]
    );

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
    console.error('Erro ao consultar contas correntes do usuário:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao consultar contas correntes', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

