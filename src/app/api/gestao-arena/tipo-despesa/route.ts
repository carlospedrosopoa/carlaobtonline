// app/api/gestao-arena/tipo-despesa/route.ts - API de Tipo de Despesa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarTipoDespesaPayload, AtualizarTipoDespesaPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/tipo-despesa - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/tipo-despesa - Listar tipos de despesa
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
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true';

    let sql = `SELECT 
      id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt"
    FROM "TipoDespesa"
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND "pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      sql += ` AND "pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para listar tipos de despesa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    if (apenasAtivos) {
      sql += ` AND ativo = true`;
    }

    sql += ` ORDER BY nome ASC`;

    const result = await query(sql, params);
    
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar tipos de despesa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar tipos de despesa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/tipo-despesa - Criar tipo de despesa
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
        { mensagem: 'Você não tem permissão para criar tipos de despesa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarTipoDespesaPayload = await request.json();
    const { pointId, nome, descricao, ativo = true } = body;

    if (!pointId || !nome) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PointId e nome são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const existe = await query(
      'SELECT id FROM "TipoDespesa" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe um tipo de despesa com este nome nesta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "TipoDespesa" (
        id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, descricao || null, ativo]
    );

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar tipo de despesa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar tipo de despesa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

