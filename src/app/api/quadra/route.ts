// app/api/quadra/route.ts - Rotas de API para Quadras (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/quadra - Listar todas as quadras (com filtro opcional por pointId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');

    let sql = `SELECT 
      q.id, q.nome, q."pointId", q.tipo, q.capacidade, q.ativo, 
      q."createdAt", q."updatedAt",
      p.id as "point_id", p.nome as "point_nome"
    FROM "Quadra" q
    LEFT JOIN "Point" p ON q."pointId" = p.id`;

    const params: any[] = [];
    if (pointId) {
      sql += ` WHERE q."pointId" = $1`;
      params.push(pointId);
    }

    sql += ` ORDER BY q.nome ASC`;

    const result = await query(sql, params);
    
    // Formatar resultado para incluir point como objeto
    const quadras = result.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      pointId: row.pointId,
      tipo: row.tipo,
      capacidade: row.capacidade,
      ativo: row.ativo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
    }));

    return NextResponse.json(quadras);
  } catch (error: any) {
    console.error('Erro ao listar quadras:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar quadras', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/quadra - Criar nova quadra
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, pointId, tipo, capacidade, ativo = true } = body;

    if (!nome || !pointId) {
      return NextResponse.json(
        { mensagem: 'Nome e estabelecimento são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o point existe
    const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
    if (pointCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    const result = await query(
      `INSERT INTO "Quadra" (id, nome, "pointId", tipo, capacidade, ativo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, nome, "pointId", tipo, capacidade, ativo, "createdAt", "updatedAt"`,
      [nome, pointId, tipo || null, capacidade || null, ativo]
    );

    // Buscar point para incluir no retorno
    const pointResult = await query('SELECT id, nome FROM "Point" WHERE id = $1', [pointId]);
    const quadra = {
      ...result.rows[0],
      point: pointResult.rows[0] || null,
    };

    return NextResponse.json(quadra, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar quadra:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar quadra', error: error.message },
      { status: 500 }
    );
  }
}

