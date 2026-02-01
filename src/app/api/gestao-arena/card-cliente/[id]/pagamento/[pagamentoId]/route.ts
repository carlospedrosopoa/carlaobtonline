// app/api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId]/route.ts - API de Pagamento individual do Card
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// DELETE /api/gestao-arena/card-cliente/[id]/pagamento/[pagamentoId] - Remover pagamento do card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagamentoId: string }> }
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
        { mensagem: 'Você não tem permissão para remover pagamentos do card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: cardId, pagamentoId } = await params;

    // Verificar se o card existe
    const cardResult = await query(
      `SELECT 
        c."pointId", c.status, c."numeroCard", c."usuarioId",
        u.email as "usuario_email", u.name as "usuario_name",
        at.fone as "atleta_fone"
      FROM "CardCliente" c
      LEFT JOIN "User" u ON c."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON at."usuarioId" = u.id
      WHERE c.id = $1`,
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = cardResult.rows[0];

    if (card.status === 'CANCELADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível remover pagamentos de um card cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se o pagamento existe e pertence ao card
    const pagamentoResult = await query(
      `SELECT p.id, p.valor, c."numeroCard", fp.nome as "formaPagamento_nome"
       FROM "PagamentoCard" p
       INNER JOIN "CardCliente" c ON p."cardId" = c.id
       LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
       WHERE p.id = $1 AND p."cardId" = $2`,
      [pagamentoId, cardId]
    );

    if (pagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Pagamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const pagamento = pagamentoResult.rows[0];
    const numeroCard = pagamento.numeroCard;
    const valorPagamento = parseFloat(pagamento.valor);
    const formaPagamentoNome = (pagamento.formaPagamento_nome as string | null) || null;
    const isContaCorrente = (formaPagamentoNome || '').trim().toUpperCase() === 'CONTA CORRENTE';

    await query('BEGIN');
    try {
      if (isContaCorrente) {
        const movDebitoResult = await query(
          `SELECT id, "contaCorrenteId"
           FROM "MovimentacaoContaCorrente"
           WHERE "pagamentoCardId" = $1 AND tipo = 'DEBITO'
           ORDER BY "createdAt" DESC
           LIMIT 1`,
          [pagamentoId]
        );

        let contaCorrenteId: string | null = movDebitoResult.rows[0]?.contaCorrenteId || null;

        if (!contaCorrenteId) {
          let contaCorrenteUsuarioId = card.usuarioId as string;

          const email = (card.usuario_email as string | null) || null;
          const nome = (card.usuario_name as string | null) || null;
          const atletaFone = (card.atleta_fone as string | null) || null;

          const emailTemp = !!email && email.startsWith('temp_') && email.endsWith('@pendente.local');

          const buscarContaPorUsuario = async (usuarioId: string) => {
            return await query(
              'SELECT id FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2 LIMIT 1',
              [usuarioId, card.pointId]
            );
          };

          let contaResult = await buscarContaPorUsuario(contaCorrenteUsuarioId);

          if (contaResult.rows.length === 0 && emailTemp) {
            let resolvedUserId: string | null = null;

            if (atletaFone) {
              const r = await query(
                `SELECT u2.id
                 FROM "Atleta" a2
                 INNER JOIN "User" u2 ON a2."usuarioId" = u2.id
                 WHERE REGEXP_REPLACE(a2.fone, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g')
                   AND u2.email NOT LIKE 'temp_%@pendente.local'
                 ORDER BY a2."createdAt" DESC
                 LIMIT 1`,
                [atletaFone]
              );
              resolvedUserId = (r.rows[0]?.id as string | undefined) || null;
            }

            if (!resolvedUserId && nome) {
              const r = await query(
                `SELECT a3."usuarioId" as id
                 FROM "Atleta" a3
                 WHERE a3."pointIdPrincipal" = $1
                   AND a3."usuarioId" IS NOT NULL
                   AND a3.nome ILIKE $2
                 ORDER BY a3."createdAt" DESC
                 LIMIT 1`,
                [card.pointId, nome]
              );
              resolvedUserId = (r.rows[0]?.id as string | undefined) || null;
            }

            if (resolvedUserId) {
              contaCorrenteUsuarioId = resolvedUserId;
              contaResult = await buscarContaPorUsuario(contaCorrenteUsuarioId);
            }
          }

          if (contaResult.rows.length > 0) {
            contaCorrenteId = contaResult.rows[0].id as string;
          }
        }

        if (contaCorrenteId) {
          await query(
            'UPDATE "MovimentacaoContaCorrente" SET "pagamentoCardId" = NULL WHERE "pagamentoCardId" = $1',
            [pagamentoId]
          );

          const saldoAtualResult = await query(
            'SELECT saldo FROM "ContaCorrenteCliente" WHERE id = $1 LIMIT 1',
            [contaCorrenteId]
          );
          const saldoAtual = saldoAtualResult.rows.length ? parseFloat(saldoAtualResult.rows[0].saldo) : 0;
          const novoSaldo = saldoAtual + valorPagamento;

          await query(
            'UPDATE "ContaCorrenteCliente" SET "saldo" = $1, "updatedAt" = NOW() WHERE id = $2',
            [novoSaldo, contaCorrenteId]
          );

          await query(
            `INSERT INTO "MovimentacaoContaCorrente" (
              "id", "contaCorrenteId", "tipo", "valor", "justificativa", "createdById", "createdAt"
            ) VALUES (
              gen_random_uuid(), $1, 'CREDITO', $2, $3, $4, NOW()
            )`,
            [contaCorrenteId, valorPagamento, `Estorno de pagamento (Comanda #${numeroCard})`, usuario.id]
          );
        }
      } else {
        // Excluir entrada de caixa relacionada (se existir)
        // Buscar entrada manual que tenha descrição relacionada ao card
        try {
          const entradaResult = await query(
            `SELECT id FROM "EntradaCaixa" 
             WHERE "pointId" = $1 
             AND valor = $2
             AND descricao LIKE $3
             ORDER BY "createdAt" DESC
             LIMIT 1`,
            [card.pointId, valorPagamento, `%Card #${numeroCard}%`]
          );

          if (entradaResult.rows.length > 0) {
            await query('DELETE FROM "EntradaCaixa" WHERE id = $1', [entradaResult.rows[0].id]);
          }
        } catch (error: any) {
          // Log do erro mas não falha a exclusão do pagamento
          console.error('Erro ao excluir entrada de caixa relacionada:', error);
        }
      }

      await query('DELETE FROM "PagamentoItem" WHERE "pagamentoCardId" = $1', [pagamentoId]);
      await query('DELETE FROM "PagamentoCard" WHERE id = $1', [pagamentoId]);

      // Se o card estava fechado, reabrir se necessário
      if (card.status === 'FECHADO') {
        const pagamentosResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
          [cardId]
        );
        const totalPago = parseFloat(pagamentosResult.rows[0].total);
        const valorTotalResult = await query(
          'SELECT "valorTotal" FROM "CardCliente" WHERE id = $1',
          [cardId]
        );
        const valorTotal = parseFloat(valorTotalResult.rows[0].valorTotal);

        if (totalPago < valorTotal) {
          await query(
            `UPDATE "CardCliente" 
             SET status = 'ABERTO', "fechadoAt" = NULL, "fechadoBy" = NULL, "updatedAt" = NOW(), "updatedById" = $2 
             WHERE id = $1`,
            [cardId, usuario.id]
          );
        } else {
          // Atualizar updatedAt mesmo se não reabrir
          await query(
            'UPDATE "CardCliente" SET "updatedAt" = NOW(), "updatedById" = $2 WHERE id = $1',
            [cardId, usuario.id]
          );
        }
      } else {
        // Atualizar updatedAt mesmo se o card não estava fechado
        await query(
          'UPDATE "CardCliente" SET "updatedAt" = NOW(), "updatedById" = $2 WHERE id = $1',
          [cardId, usuario.id]
        );
      }

      await query('COMMIT');
    } catch (error: any) {
      await query('ROLLBACK');
      throw error;
    }

    const response = NextResponse.json({ mensagem: 'Pagamento removido com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao remover pagamento do card:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao remover pagamento do card', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

