// app/api/gestao-arena/saida-caixa/[id]/route.ts - API de Saída de Caixa individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// GET /api/gestao-arena/saida-caixa/[id] - Obter saída de caixa
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
        s.*,
        fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
        f.id as "fornecedor_id", f.nome as "fornecedor_nome",
        cs.id as "categoriaSaida_id", cs.nome as "categoriaSaida_nome",
        cc.id as "centroCusto_id", cc.nome as "centroCusto_nome"
      FROM "SaidaCaixa" s
      LEFT JOIN "FormaPagamento" fp ON s."formaPagamentoId" = fp.id
      LEFT JOIN "Fornecedor" f ON s."fornecedorId" = f.id
      LEFT JOIN "CategoriaSaida" cs ON s."categoriaSaidaId" = cs.id
      LEFT JOIN "CentroCusto" cc ON s."centroCustoId" = cc.id
      WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Saída de caixa não encontrada' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, row.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta saída de caixa' },
          { status: 403 }
        );
      }
    }

    const saida = {
      id: row.id,
      pointId: row.pointId,
      valor: parseFloat(row.valor),
      descricao: row.descricao,
      fornecedorId: row.fornecedorId,
      categoriaSaidaId: row.categoriaSaidaId,
      centroCustoId: row.centroCustoId,
      formaPagamentoId: row.formaPagamentoId,
      observacoes: row.observacoes,
      dataSaida: row.dataSaida,
      createdAt: row.createdAt,
      createdById: row.createdById,
      createdBy: row.createdBy, // Mantido para compatibilidade
      formaPagamento: row.formaPagamento_id ? {
        id: row.formaPagamento_id,
        nome: row.formaPagamento_nome,
        tipo: row.formaPagamento_tipo,
      } : null,
      fornecedor: row.fornecedor_id ? {
        id: row.fornecedor_id,
        nome: row.fornecedor_nome,
      } : null,
      categoriaSaida: row.categoriaSaida_id ? {
        id: row.categoriaSaida_id,
        nome: row.categoriaSaida_nome,
      } : null,
      centroCusto: row.centroCusto_id ? {
        id: row.centroCusto_id,
        nome: row.centroCusto_nome,
      } : null,
    };

    return NextResponse.json(saida);
  } catch (error: any) {
    console.error('Erro ao obter saída de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter saída de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/gestao-arena/saida-caixa/[id] - Deletar saída de caixa
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

    // Apenas ADMIN e ORGANIZER podem deletar saídas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar saídas de caixa' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verificar se a saída existe
    const existe = await query(
      'SELECT "pointId" FROM "SaidaCaixa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Saída de caixa não encontrada' },
        { status: 404 }
      );
    }

    const saida = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, saida.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta saída de caixa' },
          { status: 403 }
        );
      }
    }

    await query('DELETE FROM "SaidaCaixa" WHERE id = $1', [id]);

    return NextResponse.json({ mensagem: 'Saída de caixa deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar saída de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar saída de caixa', error: error.message },
      { status: 500 }
    );
  }
}

