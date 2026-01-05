// app/api/gestao-arena/entrada-caixa/[id]/route.ts - API de Entrada de Caixa individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/entrada-caixa/[id] - Preflight CORS
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/entrada-caixa/[id] - Obter entrada de caixa
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Entrada de caixa não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, row.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta entrada de caixa' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
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

    const response = NextResponse.json(entrada);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter entrada de caixa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter entrada de caixa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem deletar entradas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar entradas de caixa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    // Verificar se a entrada existe
    const existe = await query(
      'SELECT "pointId" FROM "EntradaCaixa" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Entrada de caixa não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const entrada = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, entrada.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta entrada de caixa' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    await query('DELETE FROM "EntradaCaixa" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Entrada de caixa deletada com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar entrada de caixa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar entrada de caixa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

