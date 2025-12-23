// app/api/gestao-arena/fornecedor/[id]/route.ts - API de Fornecedor individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { AtualizarFornecedorPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/fornecedor/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/fornecedor/[id] - Obter fornecedor
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
      'SELECT * FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const fornecedor = result.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedor.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const response = NextResponse.json(fornecedor);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter fornecedor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter fornecedor', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/gestao-arena/fornecedor/[id] - Atualizar fornecedor
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
        { mensagem: 'Você não tem permissão para atualizar fornecedores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body: AtualizarFornecedorPayload = await request.json();

    const existe = await query(
      'SELECT "pointId" FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const fornecedorAtual = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedorAtual.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    if (body.nome && body.nome !== fornecedorAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "Fornecedor" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [fornecedorAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um fornecedor com este nome nesta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.nome !== undefined) {
      updates.push(`nome = $${paramCount}`);
      values.push(body.nome);
      paramCount++;
    }
    if (body.nomeFantasia !== undefined) {
      updates.push(`"nomeFantasia" = $${paramCount}`);
      values.push(body.nomeFantasia || null);
      paramCount++;
    }
    if (body.cnpj !== undefined) {
      updates.push(`cnpj = $${paramCount}`);
      values.push(body.cnpj || null);
      paramCount++;
    }
    if (body.cpf !== undefined) {
      updates.push(`cpf = $${paramCount}`);
      values.push(body.cpf || null);
      paramCount++;
    }
    if (body.telefone !== undefined) {
      updates.push(`telefone = $${paramCount}`);
      values.push(body.telefone || null);
      paramCount++;
    }
    if (body.email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(body.email || null);
      paramCount++;
    }
    if (body.endereco !== undefined) {
      updates.push(`endereco = $${paramCount}`);
      values.push(body.endereco || null);
      paramCount++;
    }
    if (body.observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      values.push(body.observacoes || null);
      paramCount++;
    }
    if (body.ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      values.push(body.ativo);
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
    values.push(id);

    const result = await query(
      `UPDATE "Fornecedor" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar fornecedor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar fornecedor', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/fornecedor/[id] - Deletar fornecedor
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
        { mensagem: 'Você não tem permissão para deletar fornecedores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    const existe = await query(
      'SELECT "pointId" FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const fornecedor = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedor.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se há saídas usando este fornecedor
    const saidas = await query(
      'SELECT id FROM "SaidaCaixa" WHERE "fornecedorId" = $1 LIMIT 1',
      [id]
    );

    if (saidas.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar este fornecedor pois ele está sendo utilizado em saídas de caixa' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "Fornecedor" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Fornecedor deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar fornecedor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar fornecedor', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

