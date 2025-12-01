// app/api/gestao-arena/produto/route.ts - API de Produtos
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarProdutoPayload, AtualizarProdutoPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/produto - Listar produtos
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true';
    const categoria = searchParams.get('categoria');

    let sql = `SELECT 
      id, "pointId", nome, descricao, "precoVenda", "precoCusto", categoria, ativo, "createdAt", "updatedAt"
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
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar produtos' },
        { status: 403 }
      );
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
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar produtos:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar produtos', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/produto - Criar produto
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem criar produtos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para criar produtos' },
        { status: 403 }
      );
    }

    const body: CriarProdutoPayload = await request.json();
    const { pointId, nome, descricao, precoVenda, precoCusto, categoria, ativo = true } = body;

    if (!pointId || !nome || precoVenda === undefined) {
      return NextResponse.json(
        { mensagem: 'PointId, nome e precoVenda são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
      }
    }

    // Verificar se já existe produto com mesmo nome nesta arena
    const existe = await query(
      'SELECT id FROM "Produto" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Já existe um produto com este nome nesta arena' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO "Produto" (
        id, "pointId", nome, descricao, "precoVenda", "precoCusto", categoria, ativo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, descricao || null, precoVenda, precoCusto || null, categoria || null, ativo]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar produto', error: error.message },
      { status: 500 }
    );
  }
}

