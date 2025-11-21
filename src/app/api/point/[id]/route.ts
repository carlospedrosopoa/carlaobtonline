// app/api/point/[id]/route.ts - Rotas de API para Point individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/point/[id] - Obter point por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await query(
      `SELECT 
        id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo, 
        "createdAt", "updatedAt"
      FROM "Point"
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter point:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter estabelecimento', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/point/[id] - Atualizar point
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, endereco, telefone, email, descricao, logoUrl, latitude, longitude, ativo } = body;

    if (!nome) {
      return NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE "Point"
       SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, latitude = $7, longitude = $8, ativo = $9, "updatedAt" = NOW()
       WHERE id = $10
       RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo, "createdAt", "updatedAt"`,
      [nome, endereco || null, telefone || null, email || null, descricao || null, logoUrl || null, latitude || null, longitude || null, ativo ?? true, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar point:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar estabelecimento', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/point/[id] - Deletar point
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verificar se há quadras vinculadas
    const quadrasResult = await query(
      `SELECT COUNT(*) as count FROM "Quadra" WHERE "pointId" = $1`,
      [id]
    );

    if (parseInt(quadrasResult.rows[0].count) > 0) {
      return NextResponse.json(
        { mensagem: 'Não é possível deletar estabelecimento com quadras vinculadas' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM "Point" WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ mensagem: 'Estabelecimento deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar point:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar estabelecimento', error: error.message },
      { status: 500 }
    );
  }
}

