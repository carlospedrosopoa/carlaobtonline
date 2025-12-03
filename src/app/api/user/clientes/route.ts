// app/api/user/clientes/route.ts - API para buscar clientes (usuários com role USER)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';

// GET /api/user/clientes - Listar clientes (usuários com role USER)
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // ADMIN e ORGANIZER podem buscar clientes
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para buscar clientes' },
        { status: 403 }
      );
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

    return NextResponse.json(clientes);
  } catch (error: any) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao buscar clientes', error: error.message },
      { status: 500 }
    );
  }
}

