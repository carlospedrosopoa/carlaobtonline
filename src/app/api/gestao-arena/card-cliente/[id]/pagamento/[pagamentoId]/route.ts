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
      `SELECT 
        p.id, p.valor, p.observacoes, p."aberturaCaixaId", p."formaPagamentoId", p."createdAt", c."numeroCard",
        fp.nome as "formaPagamento_nome",
        fp."origemFinanceiraPadrao" as "formaPagamento_origemFinanceiraPadrao",
        fp."contaBancariaIdPadrao" as "formaPagamento_contaBancariaIdPadrao"
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
    const origemFinanceiraPadrao = (pagamento.formaPagamento_origemFinanceiraPadrao as string | null) || 'CAIXA';
    const contaBancariaIdPadrao = (pagamento.formaPagamento_contaBancariaIdPadrao as string | null) || null;

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
      } else if (origemFinanceiraPadrao === 'CONTA_BANCARIA') {
        let contaBancariaId = contaBancariaIdPadrao;

        try {
          const movEntradaResult = await query(
            `SELECT id, "contaBancariaId"
             FROM "MovimentacaoContaBancaria"
             WHERE "pagamentoCardId" = $1 AND tipo = 'ENTRADA'
             ORDER BY "createdAt" DESC
             LIMIT 1`,
            [pagamentoId]
          );
          if (movEntradaResult.rows.length > 0) {
            contaBancariaId = movEntradaResult.rows[0].contaBancariaId;
          }
        } catch {}

        if (!contaBancariaId) {
          const movFallbackResult = await query(
            `SELECT id, "contaBancariaId"
             FROM "MovimentacaoContaBancaria"
             WHERE origem = 'PAGAMENTO_COMANDA'
               AND tipo = 'ENTRADA'
               AND valor = $1
               AND descricao = $2
             ORDER BY "createdAt" DESC
             LIMIT 1`,
            [valorPagamento, `Pagamento de Comanda #${numeroCard}`]
          );
          if (movFallbackResult.rows.length > 0) {
            contaBancariaId = movFallbackResult.rows[0].contaBancariaId;
          }
        }

        if (contaBancariaId) {
          await query(
            `
            INSERT INTO "MovimentacaoContaBancaria" (
              id, "contaBancariaId", tipo, valor, data, descricao, origem, observacoes, "pagamentoCardId", "createdAt", "createdById"
            ) VALUES (
              gen_random_uuid()::text, $1, 'SAIDA', $2, NOW()::date, $3, 'ESTORNO_PAGAMENTO_COMANDA', $4, $5, NOW(), $6
            )
            `,
            [
              contaBancariaId,
              valorPagamento,
              `Estorno pagamento de Comanda #${numeroCard}`,
              pagamento.observacoes || null,
              pagamentoId,
              usuario.id,
            ]
          );
        }
      } else {
        if (pagamento.aberturaCaixaId) {
          let formaPagamentoIdEstorno: string | null = pagamento.formaPagamentoId || null;
          if (!formaPagamentoIdEstorno) {
            const formaPagamentoResult = await query(
              `
              SELECT id
              FROM "FormaPagamento"
              WHERE "pointId" = $1 AND ativo = true
              ORDER BY CASE WHEN UPPER(nome) = 'DINHEIRO' THEN 0 ELSE 1 END, nome ASC
              LIMIT 1
              `,
              [card.pointId]
            );
            formaPagamentoIdEstorno = formaPagamentoResult.rows[0]?.id || null;
          }
          if (!formaPagamentoIdEstorno) {
            throw new Error('Não foi possível localizar forma de pagamento para lançar estorno no caixa');
          }

          let centroCustoIdEstorno: string | null = null;
          const centroCustoPreferencialResult = await query(
            `
            SELECT id
            FROM "CentroCusto"
            WHERE "pointId" = $1 AND ativo = true
            ORDER BY CASE WHEN nome ILIKE '%estorno%' THEN 0 ELSE 1 END, nome ASC
            LIMIT 1
            `,
            [card.pointId]
          );
          centroCustoIdEstorno = centroCustoPreferencialResult.rows[0]?.id || null;

          if (!centroCustoIdEstorno) {
            const centroCustoNovoResult = await query(
              `
              INSERT INTO "CentroCusto" (id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt")
              VALUES (gen_random_uuid()::text, $1, 'Estornos', 'Lançamentos automáticos de estorno', true, NOW(), NOW())
              RETURNING id
              `,
              [card.pointId]
            );
            centroCustoIdEstorno = centroCustoNovoResult.rows[0].id;
          }

          await query(
            `
            INSERT INTO "EntradaCaixa" (
              id, "pointId", "aberturaCaixaId", valor, descricao, "formaPagamentoId", observacoes, "dataEntrada", "createdAt", "createdById"
            ) VALUES (
              gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), $8
            )
            `,
            [
              card.pointId,
              pagamento.aberturaCaixaId,
              valorPagamento,
              `Pagamento Card #${numeroCard} - registro histórico`,
              formaPagamentoIdEstorno,
              pagamento.observacoes || null,
              pagamento.createdAt,
              usuario.id,
            ]
          );

          await query(
            `
            INSERT INTO "SaidaCaixa" (
              id, "pointId", "aberturaCaixaId", valor, descricao, "fornecedorId", "categoriaSaidaId", "tipoDespesaId", "centroCustoId",
              "formaPagamentoId", observacoes, "dataSaida", "createdAt", "createdById"
            ) VALUES (
              gen_random_uuid()::text, $1, $2, $3, $4, NULL, NULL, NULL, $5, $6, $7, NOW()::date, NOW(), $8
            )
            `,
            [
              card.pointId,
              pagamento.aberturaCaixaId,
              valorPagamento,
              `Estorno pagamento de Comanda #${numeroCard}`,
              centroCustoIdEstorno,
              formaPagamentoIdEstorno,
              pagamento.observacoes || null,
              usuario.id,
            ]
          );
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

