// app/api/gestao-arena/tipo-despesa/[id]/route.ts - API de Tipo de Despesa por ID
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarTipoDespesaPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/tipo-despesa/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/tipo-despesa/[id] - Obter tipo de despesa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    const result = await query(
      'SELECT * FROM "TipoDespesa" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const tipoDespesa = result.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    } else if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para visualizar tipos de despesa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(tipoDespesa);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter tipo de despesa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter tipo de despesa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar tipos de despesa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const tipoDespesa = existe.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se nome já existe (se foi alterado)
    if (nome && nome !== tipoDespesa.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "TipoDespesa" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [tipoDespesa.pointId, nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um tipo de despesa com este nome nesta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    paramsArray.push(id);

    const sql = `UPDATE "TipoDespesa" SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await query(sql, paramsArray);

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar tipo de despesa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar tipo de despesa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar tipos de despesa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    // Verificar se existe
    const existe = await query(
      'SELECT * FROM "TipoDespesa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Tipo de despesa não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const tipoDespesa = existe.rows[0];

    // Verificar permissão
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      if (tipoDespesa.pointId !== usuario.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este tipo de despesa' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se está sendo usado (se houver relacionamento futuro)
    // Por enquanto, permitir deletar sem verificação de uso

    await query('DELETE FROM "TipoDespesa" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Tipo de despesa deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar tipo de despesa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar tipo de despesa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

