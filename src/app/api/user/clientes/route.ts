// app/api/user/clientes/route.ts - API para buscar clientes (usuários com role USER)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/user/clientes - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/user/clientes - Listar clientes (usuários com role USER)
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

    // ADMIN e ORGANIZER podem buscar clientes
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para buscar clientes' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';

    let sql = `SELECT id, name, email, role, "createdAt" 
               FROM "User" 
               WHERE role = 'USER'`;

    const params: any[] = [];
    let paramCount = 1;

    if (busca.trim()) {
      sql += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
      params.push(`%${busca.toLowerCase()}%`);
      paramCount++;
    }

    sql += ` ORDER BY name ASC LIMIT 50`;

    const result = await query(sql, params);

    const clientes = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt,
    }));

    const response = NextResponse.json(clientes);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao buscar clientes:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao buscar clientes', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

