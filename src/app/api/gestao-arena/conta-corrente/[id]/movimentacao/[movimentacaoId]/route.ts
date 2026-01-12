// app/api/gestao-arena/conta-corrente/[id]/movimentacao/[movimentacaoId]/route.ts - API de Movimentação específica
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/conta-corrente/[id]/movimentacao/[movimentacaoId] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// PUT /api/gestao-arena/conta-corrente/[id]/movimentacao/[movimentacaoId] - Editar movimentação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movimentacaoId: string }> }
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
        { mensagem: 'Você não tem permissão para editar movimentações' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: contaCorrenteId, movimentacaoId } = await params;
    const body = await request.json();
    const { tipo, valor, justificativa } = body;

    // Validações
    if (!tipo || !['CREDITO', 'DEBITO'].includes(tipo)) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Tipo deve ser CREDITO ou DEBITO' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!valor || valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Justificativa é obrigatória' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a conta corrente existe e se o usuário tem acesso
    const contaResult = await query(
      'SELECT "pointId" FROM "ContaCorrenteCliente" WHERE id = $1',
      [contaCorrenteId]
    );

    if (contaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, contaResult.rows[0].pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se a movimentação existe e pertence à conta corrente
    const movimentacaoResult = await query(
      'SELECT tipo, valor FROM "MovimentacaoContaCorrente" WHERE id = $1 AND "contaCorrenteId" = $2',
      [movimentacaoId, contaCorrenteId]
    );

    if (movimentacaoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Movimentação não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const movimentacaoAntiga = movimentacaoResult.rows[0];
    const valorAntigo = parseFloat(movimentacaoAntiga.valor);
    const tipoAntigo = movimentacaoAntiga.tipo;

    // Não permitir editar movimentações vinculadas a pagamentos de card (são automáticas)
    const movimentacaoComPagamento = await query(
      'SELECT "pagamentoCardId" FROM "MovimentacaoContaCorrente" WHERE id = $1',
      [movimentacaoId]
    );

    if (movimentacaoComPagamento.rows[0]?.pagamentoCardId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível editar movimentações vinculadas a pagamentos de card' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Reverter o saldo antigo
    const ajusteAntigo = tipoAntigo === 'CREDITO' ? -valorAntigo : valorAntigo;
    await query(
      `UPDATE "ContaCorrenteCliente"
       SET saldo = saldo + $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [ajusteAntigo, contaCorrenteId]
    );

    // Atualizar a movimentação
    await query(
      `UPDATE "MovimentacaoContaCorrente"
       SET tipo = $1, valor = $2, justificativa = $3
       WHERE id = $4`,
      [tipo, valor, justificativa.trim(), movimentacaoId]
    );

    // Aplicar o novo saldo
    const ajusteNovo = tipo === 'CREDITO' ? valor : -valor;
    await query(
      `UPDATE "ContaCorrenteCliente"
       SET saldo = saldo + $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [ajusteNovo, contaCorrenteId]
    );

    // Buscar movimentação atualizada
    const movimentacaoAtualizadaResult = await query(
      `SELECT m.*, u.name as "createdByNome", u.email as "createdByEmail"
       FROM "MovimentacaoContaCorrente" m
       LEFT JOIN "User" u ON m."createdById" = u.id
       WHERE m.id = $1`,
      [movimentacaoId]
    );

    const movimentacao = {
      id: movimentacaoAtualizadaResult.rows[0].id,
      contaCorrenteId: movimentacaoAtualizadaResult.rows[0].contaCorrenteId,
      tipo: movimentacaoAtualizadaResult.rows[0].tipo,
      valor: parseFloat(movimentacaoAtualizadaResult.rows[0].valor),
      justificativa: movimentacaoAtualizadaResult.rows[0].justificativa,
      createdAt: movimentacaoAtualizadaResult.rows[0].createdAt,
      createdBy: movimentacaoAtualizadaResult.rows[0].createdById ? {
        id: movimentacaoAtualizadaResult.rows[0].createdById,
        name: movimentacaoAtualizadaResult.rows[0].createdByNome,
        email: movimentacaoAtualizadaResult.rows[0].createdByEmail,
      } : null,
    };

    const response = NextResponse.json(movimentacao);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao editar movimentação:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao editar movimentação', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/conta-corrente/[id]/movimentacao/[movimentacaoId] - Excluir movimentação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movimentacaoId: string }> }
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
        { mensagem: 'Você não tem permissão para excluir movimentações' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: contaCorrenteId, movimentacaoId } = await params;

    // Verificar se a conta corrente existe e se o usuário tem acesso
    const contaResult = await query(
      'SELECT "pointId" FROM "ContaCorrenteCliente" WHERE id = $1',
      [contaCorrenteId]
    );

    if (contaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Conta corrente não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, contaResult.rows[0].pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta conta corrente' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se a movimentação existe e pertence à conta corrente
    const movimentacaoResult = await query(
      'SELECT tipo, valor FROM "MovimentacaoContaCorrente" WHERE id = $1 AND "contaCorrenteId" = $2',
      [movimentacaoId, contaCorrenteId]
    );

    if (movimentacaoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Movimentação não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const movimentacao = movimentacaoResult.rows[0];
    const valor = parseFloat(movimentacao.valor);
    const tipo = movimentacao.tipo;

    // Não permitir excluir movimentações vinculadas a pagamentos de card (são automáticas)
    const movimentacaoComPagamento = await query(
      'SELECT "pagamentoCardId" FROM "MovimentacaoContaCorrente" WHERE id = $1',
      [movimentacaoId]
    );

    if (movimentacaoComPagamento.rows[0]?.pagamentoCardId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível excluir movimentações vinculadas a pagamentos de card' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Reverter o saldo
    const ajuste = tipo === 'CREDITO' ? -valor : valor;
    await query(
      `UPDATE "ContaCorrenteCliente"
       SET saldo = saldo + $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [ajuste, contaCorrenteId]
    );

    // Excluir a movimentação
    await query(
      'DELETE FROM "MovimentacaoContaCorrente" WHERE id = $1',
      [movimentacaoId]
    );

    const response = NextResponse.json({ mensagem: 'Movimentação excluída com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao excluir movimentação:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao excluir movimentação', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

