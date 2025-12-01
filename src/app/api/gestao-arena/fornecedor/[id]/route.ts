// app/api/gestao-arena/fornecedor/[id]/route.ts - API de Fornecedor individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { AtualizarFornecedorPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/fornecedor/[id] - Obter fornecedor
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
      'SELECT * FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
    }

    const fornecedor = result.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedor.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(fornecedor);
  } catch (error: any) {
    console.error('Erro ao obter fornecedor:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter fornecedor', error: error.message },
      { status: 500 }
    );
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
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar fornecedores' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: AtualizarFornecedorPayload = await request.json();

    const existe = await query(
      'SELECT "pointId" FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
    }

    const fornecedorAtual = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedorAtual.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
      }
    }

    if (body.nome && body.nome !== fornecedorAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "Fornecedor" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [fornecedorAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        return NextResponse.json(
          { mensagem: 'Já existe um fornecedor com este nome nesta arena' },
          { status: 400 }
        );
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
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
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

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar fornecedor:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar fornecedor', error: error.message },
      { status: 500 }
    );
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
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar fornecedores' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existe = await query(
      'SELECT "pointId" FROM "Fornecedor" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Fornecedor não encontrado' },
        { status: 404 }
      );
    }

    const fornecedor = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, fornecedor.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a este fornecedor' },
          { status: 403 }
        );
      }
    }

    // Verificar se há saídas usando este fornecedor
    const saidas = await query(
      'SELECT id FROM "SaidaCaixa" WHERE "fornecedorId" = $1 LIMIT 1',
      [id]
    );

    if (saidas.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Não é possível deletar este fornecedor pois ele está sendo utilizado em saídas de caixa' },
        { status: 400 }
      );
    }

    await query('DELETE FROM "Fornecedor" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Fornecedor deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar fornecedor:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar fornecedor', error: error.message },
      { status: 500 }
    );
  }
}

