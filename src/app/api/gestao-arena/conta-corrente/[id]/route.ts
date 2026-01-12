// app/api/gestao-arena/conta-corrente/[id]/route.ts - API de Conta Corrente específica
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/conta-corrente/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/conta-corrente/[id] - Consultar conta corrente específica
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

    const { id } = await params;

    const result = await query(
      `SELECT 
        cc.id, cc."usuarioId", cc."pointId", cc.saldo, cc."createdAt", cc."updatedAt",
        u.name as "usuarioNome", u.email as "usuarioEmail",
        p.nome as "pointNome"
      FROM "ContaCorrenteCliente" cc
      INNER JOIN "User" u ON cc."usuarioId" = u.id
      INNER JOIN "Point" p ON cc."pointId" = p.id
      WHERE cc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, row.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

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

    const response = NextResponse.json(conta);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao consultar conta corrente:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao consultar conta corrente', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

