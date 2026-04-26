import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

async function carregarConta(id: string) {
  const result = await query(`SELECT id, "pointId", nome FROM "ContaBancaria" WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function carregarMovimentacao(movimentacaoId: string) {
  const result = await query(
    `
    SELECT
      id,
      "contaBancariaId",
      origem,
      "transferenciaFinanceiraId",
      "liquidacaoContaPagarId"
    FROM "MovimentacaoContaBancaria"
    WHERE id = $1
    `,
    [movimentacaoId]
  );
  return result.rows[0] || null;
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movimentacaoId: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id, movimentacaoId } = await params;
    const conta = await carregarConta(id);
    if (!conta) {
      return withCors(NextResponse.json({ mensagem: 'Conta bancária não encontrada' }, { status: 404 }), request);
    }
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, conta.pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    const movimentacao = await carregarMovimentacao(movimentacaoId);
    if (!movimentacao || movimentacao.contaBancariaId !== id) {
      return withCors(NextResponse.json({ mensagem: 'Movimentação não encontrada' }, { status: 404 }), request);
    }

    const ehManual =
      movimentacao.origem === 'MANUAL' &&
      !movimentacao.transferenciaFinanceiraId &&
      !movimentacao.liquidacaoContaPagarId;

    if (!ehManual) {
      return withCors(
        NextResponse.json({ mensagem: 'Apenas lançamentos manuais podem ser excluídos' }, { status: 400 }),
        request
      );
    }

    await query(`DELETE FROM "MovimentacaoContaBancaria" WHERE id = $1`, [movimentacaoId]);

    return withCors(NextResponse.json({ mensagem: 'Movimentação removida com sucesso' }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao remover movimentação', error: error.message }, { status: 500 }),
      request
    );
  }
}
