// app/api/gestao-arena/produto/route.ts - API de Produtos
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarProdutoPayload, AtualizarProdutoPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/produto - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/produto - Listar produtos
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
    const categoria = searchParams.get('categoria');

    let sql = `SELECT 
      id, "pointId", nome, descricao, "precoVenda", "precoCusto", categoria, ativo, "createdAt", "updatedAt", "acessoRapido"
    FROM "Produto"
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas produtos da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND "pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      // ADMIN pode filtrar por pointId se quiser
      sql += ` AND "pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para listar produtos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    if (apenasAtivos) {
      sql += ` AND ativo = true`;
    }

    if (categoria) {
      sql += ` AND categoria = $${paramCount}`;
      params.push(categoria);
      paramCount++;
    }

    sql += ` ORDER BY nome ASC`;

    const result = await query(sql, params);
    
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar produtos:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar produtos', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/produto - Criar produto
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

    // Apenas ADMIN e ORGANIZER podem criar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar produtos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarProdutoPayload = await request.json();
    const { pointId, nome, descricao, precoVenda, precoCusto, categoria, ativo = true, acessoRapido = false } = body;

    if (!pointId || !nome || precoVenda === undefined) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PointId, nome e precoVenda são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se já existe produto com mesmo nome nesta arena
    const existe = await query(
      'SELECT id FROM "Produto" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe um produto com este nome nesta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "Produto" (
        id, "pointId", nome, descricao, "precoVenda", "precoCusto", categoria, ativo, "acessoRapido", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, descricao || null, precoVenda, precoCusto || null, categoria || null, ativo, acessoRapido]
    );

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar produto', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

