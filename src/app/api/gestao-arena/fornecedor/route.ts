// app/api/gestao-arena/fornecedor/route.ts - API de Fornecedores
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarFornecedorPayload, AtualizarFornecedorPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/fornecedor - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/fornecedor - Listar fornecedores
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
      id, "pointId", nome, "nomeFantasia", cnpj, cpf, telefone, email, endereco, observacoes, ativo, "createdAt", "updatedAt"
    FROM "Fornecedor"
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas fornecedores da sua arena
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
        { mensagem: 'Você não tem permissão para listar fornecedores' },
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
    console.error('Erro ao listar fornecedores:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar fornecedores', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/fornecedor - Criar fornecedor
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
        { mensagem: 'Você não tem permissão para criar fornecedores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarFornecedorPayload = await request.json();
    const { pointId, nome, nomeFantasia, cnpj, cpf, telefone, email, endereco, observacoes, ativo = true } = body;

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
      'SELECT id FROM "Fornecedor" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe um fornecedor com este nome nesta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "Fornecedor" (
        id, "pointId", nome, "nomeFantasia", cnpj, cpf, telefone, email, endereco, observacoes, ativo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, nomeFantasia || null, cnpj || null, cpf || null, telefone || null, email || null, endereco || null, observacoes || null, ativo]
    );

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar fornecedor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar fornecedor', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

