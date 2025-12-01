// app/api/gestao-arena/forma-pagamento/[id]/route.ts - API de Forma de Pagamento individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { AtualizarFormaPagamentoPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/forma-pagamento/[id] - Obter forma de pagamento
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
      'SELECT * FROM "FormaPagamento" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
    }

    const formaPagamento = result.rows[0];

    // Verificar se ORGANIZER tem acesso a esta forma de pagamento
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, formaPagamento.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta forma de pagamento' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(formaPagamento);
  } catch (error: any) {
    console.error('Erro ao obter forma de pagamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter forma de pagamento', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/gestao-arena/forma-pagamento/[id] - Atualizar forma de pagamento
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

    // Apenas ADMIN e ORGANIZER podem atualizar formas de pagamento
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar formas de pagamento' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: AtualizarFormaPagamentoPayload = await request.json();

    // Verificar se a forma de pagamento existe
    const existe = await query(
      'SELECT "pointId" FROM "FormaPagamento" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
    }

    const formaPagamentoAtual = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, formaPagamentoAtual.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta forma de pagamento' },
          { status: 403 }
        );
      }
    }

    // Se está mudando o nome, verificar se não existe duplicata
    if (body.nome && body.nome !== formaPagamentoAtual.nome) {
      const nomeExiste = await query(
        'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2 AND id != $3',
        [formaPagamentoAtual.pointId, body.nome, id]
      );

      if (nomeExiste.rows.length > 0) {
        return NextResponse.json(
          { mensagem: 'Já existe uma forma de pagamento com este nome nesta arena' },
          { status: 400 }
        );
      }
    }

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.nome !== undefined) {
      updates.push(`nome = $${paramCount}`);
      values.push(body.nome);
      paramCount++;
    }
    if (body.descricao !== undefined) {
      updates.push(`descricao = $${paramCount}`);
      values.push(body.descricao || null);
      paramCount++;
    }
    if (body.tipo !== undefined) {
      updates.push(`tipo = $${paramCount}`);
      values.push(body.tipo);
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
      `UPDATE "FormaPagamento" 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar forma de pagamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar forma de pagamento', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/gestao-arena/forma-pagamento/[id] - Deletar forma de pagamento
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

    // Apenas ADMIN e ORGANIZER podem deletar formas de pagamento
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar formas de pagamento' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verificar se a forma de pagamento existe
    const existe = await query(
      'SELECT "pointId" FROM "FormaPagamento" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
    }

    const formaPagamento = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, formaPagamento.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta forma de pagamento' },
          { status: 403 }
        );
      }
    }

    // Verificar se há pagamentos usando esta forma de pagamento
    const pagamentos = await query(
      'SELECT id FROM "PagamentoCard" WHERE "formaPagamentoId" = $1 LIMIT 1',
      [id]
    );

    const entradas = await query(
      'SELECT id FROM "EntradaCaixa" WHERE "formaPagamentoId" = $1 LIMIT 1',
      [id]
    );

    const saidas = await query(
      'SELECT id FROM "SaidaCaixa" WHERE "formaPagamentoId" = $1 LIMIT 1',
      [id]
    );

    if (pagamentos.rows.length > 0 || entradas.rows.length > 0 || saidas.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Não é possível deletar esta forma de pagamento pois ela está sendo utilizada' },
        { status: 400 }
      );
    }

    await query('DELETE FROM "FormaPagamento" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Forma de pagamento deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar forma de pagamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar forma de pagamento', error: error.message },
      { status: 500 }
    );
  }
}

