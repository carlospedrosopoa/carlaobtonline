// app/api/gestao-arena/centro-custo/route.ts - API de Centro de Custo
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarCentroCustoPayload, AtualizarCentroCustoPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/centro-custo - Listar centros de custo
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

    let sql = `SELECT 
      id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt"
    FROM "CentroCusto"
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
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar centros de custo' },
        { status: 403 }
      );
    }

    if (apenasAtivos) {
      sql += ` AND ativo = true`;
    }

    sql += ` ORDER BY nome ASC`;

    const result = await query(sql, params);
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar centros de custo:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar centros de custo', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/centro-custo - Criar centro de custo
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para criar centros de custo' },
        { status: 403 }
      );
    }

    const body: CriarCentroCustoPayload = await request.json();
    const { pointId, nome, descricao, ativo = true } = body;

    if (!pointId || !nome) {
      return NextResponse.json(
        { mensagem: 'PointId e nome são obrigatórios' },
        { status: 400 }
      );
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
      }
    }

    const existe = await query(
      'SELECT id FROM "CentroCusto" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Já existe um centro de custo com este nome nesta arena' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO "CentroCusto" (
        id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, descricao || null, ativo]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar centro de custo:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar centro de custo', error: error.message },
      { status: 500 }
    );
  }
}

