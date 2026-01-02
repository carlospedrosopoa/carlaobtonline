// app/api/gestao-arena/entrada-caixa/[id]/route.ts - API de Entrada de Caixa individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// GET /api/gestao-arena/entrada-caixa/[id] - Obter entrada de caixa
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
      `SELECT 
        e.*,
        fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
        uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
        uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
      FROM "EntradaCaixa" e
      LEFT JOIN "FormaPagamento" fp ON e."formaPagamentoId" = fp.id
      LEFT JOIN "User" uc ON e."createdById" = uc.id
      LEFT JOIN "User" uu ON e."updatedById" = uu.id
      WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Entrada de caixa não encontrada' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, row.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta entrada de caixa' },
          { status: 403 }
        );
      }
    }

    const entrada = {
      id: row.id,
      pointId: row.pointId,
      valor: parseFloat(row.valor),
      descricao: row.descricao,
      formaPagamentoId: row.formaPagamentoId,
      observacoes: row.observacoes,
      dataEntrada: row.dataEntrada,
      createdAt: row.createdAt,
      createdById: row.createdById || null,
      createdBy: row.createdBy_user_id ? {
        id: row.createdBy_user_id,
        name: row.createdBy_user_name,
        email: row.createdBy_user_email,
      } : null,
      updatedById: row.updatedById || null,
      updatedBy: row.updatedBy_user_id ? {
        id: row.updatedBy_user_id,
        name: row.updatedBy_user_name,
        email: row.updatedBy_user_email,
      } : null,
      formaPagamento: row.formaPagamento_id ? {
        id: row.formaPagamento_id,
        nome: row.formaPagamento_nome,
        tipo: row.formaPagamento_tipo,
      } : null,
    };

    return NextResponse.json(entrada);
  } catch (error: any) {
    console.error('Erro ao obter entrada de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter entrada de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/gestao-arena/entrada-caixa/[id] - Deletar entrada de caixa
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

    // Apenas ADMIN e ORGANIZER podem deletar entradas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar entradas de caixa' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verificar se a entrada existe
    const existe = await query(
      'SELECT "pointId" FROM "EntradaCaixa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Entrada de caixa não encontrada' },
        { status: 404 }
      );
    }

    const entrada = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, entrada.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta entrada de caixa' },
          { status: 403 }
        );
      }
    }

    await query('DELETE FROM "EntradaCaixa" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Entrada de caixa deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar entrada de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar entrada de caixa', error: error.message },
      { status: 500 }
    );
  }
}

