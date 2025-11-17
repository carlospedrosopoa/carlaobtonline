// app/api/quadra/[id]/route.ts - Rotas de API para Quadra individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/quadra/[id] - Obter quadra por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      `SELECT 
        q.id, q.nome, q."pointId", q.tipo, q.capacidade, q.ativo, 
        q."createdAt", q."updatedAt",
        p.id as "point_id", p.nome as "point_nome"
      FROM "Quadra" q
      LEFT JOIN "Point" p ON q."pointId" = p.id
      WHERE q.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const quadra = {
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
    };

    return NextResponse.json(quadra);
  } catch (error: any) {
    console.error('Erro ao obter quadra:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter quadra', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/quadra/[id] - Atualizar quadra
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { nome, pointId, tipo, capacidade, ativo } = body;

    if (!nome) {
      return NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Se pointId foi alterado, verificar se existe
    if (pointId) {
      const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
      if (pointCheck.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Estabelecimento não encontrado' },
          { status: 404 }
        );
      }
    }

    const result = await query(
      `UPDATE "Quadra"
       SET nome = $1, "pointId" = COALESCE($2, "pointId"), tipo = $3, capacidade = $4, ativo = $5, "updatedAt" = NOW()
       WHERE id = $6
       RETURNING id, nome, "pointId", tipo, capacidade, ativo, "createdAt", "updatedAt"`,
      [nome, pointId || null, tipo || null, capacidade || null, ativo ?? true, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
    }

    // Buscar point para incluir no retorno
    const pointResult = await query('SELECT id, nome FROM "Point" WHERE id = $1', [result.rows[0].pointId]);
    const quadra = {
      ...result.rows[0],
      point: pointResult.rows[0] || null,
    };

    return NextResponse.json(quadra);
  } catch (error: any) {
    console.error('Erro ao atualizar quadra:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar quadra', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/quadra/[id] - Deletar quadra
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se há agendamentos vinculados
    const agendamentosResult = await query(
      `SELECT COUNT(*) as count FROM "Agendamento" WHERE "quadraId" = $1`,
      [params.id]
    );

    if (parseInt(agendamentosResult.rows[0].count) > 0) {
      return NextResponse.json(
        { mensagem: 'Não é possível deletar quadra com agendamentos vinculados' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM "Quadra" WHERE id = $1 RETURNING id`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ mensagem: 'Quadra deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar quadra:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar quadra', error: error.message },
      { status: 500 }
    );
  }
}

