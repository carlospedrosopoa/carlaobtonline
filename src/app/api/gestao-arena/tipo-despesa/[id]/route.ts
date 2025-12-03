// app/api/gestao-arena/tipo-despesa/[id]/route.ts - API de Tipo de Despesa por ID
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { AtualizarTipoDespesaPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/tipo-despesa/[id] - Obter tipo de despesa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await query(
      'SELECT * FROM "TipoDespesa" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
    }

    const tipoDespesa = result.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
      }
    } else if (usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para visualizar tipos de despesa' },
        { status: 403 }
      );
    }

    return NextResponse.json(tipoDespesa);
  } catch (error: any) {
    console.error('Erro ao obter tipo de despesa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter tipo de despesa', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/gestao-arena/tipo-despesa/[id] - Atualizar tipo de despesa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { mensagem: 'Você não tem permissão para atualizar tipos de despesa' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: AtualizarTipoDespesaPayload = await request.json();
    const { nome, descricao, ativo } = body;

    // Verificar se existe
    const existe = await query(
      'SELECT * FROM "TipoDespesa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
    }

    const tipoDespesa = existe.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
      }
    }

    // Verificar se nome já existe (se foi alterado)
    if (nome && nome !== tipoDespesa.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "TipoDespesa" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [tipoDespesa.pointId, nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        return NextResponse.json(
          { mensagem: 'Já existe um tipo de despesa com este nome nesta arena' },
          { status: 400 }
        );
      }
    }

    // Atualizar
    const updates: string[] = [];
    const paramsArray: any[] = [];
    let paramCount = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramCount}`);
      paramsArray.push(nome);
      paramCount++;
    }
    if (descricao !== undefined) {
      updates.push(`descricao = $${paramCount}`);
      paramsArray.push(descricao || null);
      paramCount++;
    }
    if (ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      paramsArray.push(ativo);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    updates.push(`"updatedAt" = NOW()`);
    paramsArray.push(id);

    const sql = `UPDATE "TipoDespesa" SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await query(sql, paramsArray);

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar tipo de despesa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar tipo de despesa', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/gestao-arena/tipo-despesa/[id] - Deletar tipo de despesa
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { mensagem: 'Você não tem permissão para deletar tipos de despesa' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verificar se existe
    const existe = await query(
      'SELECT * FROM "TipoDespesa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
    }

    const tipoDespesa = existe.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
      }
    }

    // Verificar se está sendo usado (se houver relacionamento futuro)
    // Por enquanto, permitir deletar sem verificação de uso

    await query('DELETE FROM "TipoDespesa" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Tipo de despesa deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar tipo de despesa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar tipo de despesa', error: error.message },
      { status: 500 }
    );
  }
}

