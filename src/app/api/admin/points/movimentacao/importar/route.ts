import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query, transaction } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

type ImportarMovimentacaoBody = {
  sourcePointId: string;
  targetPointId: string;
  cardIds: string[];
};

async function getExistingColumns(runQuery: (text: string, params?: any[]) => Promise<any>, tableName: string) {
  const result = await runQuery(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((r: any) => r.column_name));
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;

    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const body: ImportarMovimentacaoBody = await request.json().catch(() => ({} as any));
    const sourcePointId = String(body?.sourcePointId || '');
    const targetPointId = String(body?.targetPointId || '');
    const cardIds = Array.isArray(body?.cardIds) ? body.cardIds.filter(Boolean) : [];

    if (!sourcePointId || !targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'sourcePointId e targetPointId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (sourcePointId === targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'A arena de origem e destino devem ser diferentes' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (cardIds.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Selecione ao menos uma comanda para importar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const pontos = await query(
      `SELECT id FROM "Point" WHERE id IN ($1, $2)`,
      [sourcePointId, targetPointId]
    );
    if (pontos.rows.length !== 2) {
      const errorResponse = NextResponse.json({ mensagem: 'Point de origem ou destino não encontrado' }, { status: 404 });
      return withCors(errorResponse, request);
    }

    const caixaAberto = await query(
      `SELECT id
       FROM "AberturaCaixa"
       WHERE "pointId" = $1
         AND status = 'ABERTA'
       ORDER BY "dataAbertura" DESC, "createdAt" DESC
       LIMIT 1`,
      [targetPointId]
    );
    const aberturaCaixaIdDestino = caixaAberto.rows[0]?.id;
    if (!aberturaCaixaIdDestino) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não há caixa aberto na arena de destino. Abra o caixa antes de importar.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const resultado = await transaction(async (client) => {
      const runQuery = (text: string, params?: any[]) => client.query(text, params);

      const produtoCols = await getExistingColumns(runQuery, 'Produto');
      const formaCols = await getExistingColumns(runQuery, 'FormaPagamento');
      const cardCols = await getExistingColumns(runQuery, 'CardCliente');
      const itemCols = await getExistingColumns(runQuery, 'ItemCard');
      const pagamentoCols = await getExistingColumns(runQuery, 'PagamentoCard');

      const cardsResult = await runQuery(
        `SELECT *
         FROM "CardCliente"
         WHERE "pointId" = $1
           AND id = ANY($2::text[])
         ORDER BY "createdAt" ASC, "numeroCard" ASC`,
        [sourcePointId, cardIds]
      );

      if (cardsResult.rows.length === 0) {
        throw new Error('Nenhuma comanda encontrada para importar');
      }

      const cardsOrigem = cardsResult.rows;

      const produtoExtras: string[] = [];
      if (produtoCols.has('descricao')) produtoExtras.push(`p.descricao as "produto_descricao"`);
      if (produtoCols.has('precoVenda')) produtoExtras.push(`p."precoVenda" as "produto_precoVenda"`);
      if (produtoCols.has('precoCusto')) produtoExtras.push(`p."precoCusto" as "produto_precoCusto"`);
      if (produtoCols.has('categoria')) produtoExtras.push(`p.categoria as "produto_categoria"`);
      if (produtoCols.has('ativo')) produtoExtras.push(`p.ativo as "produto_ativo"`);
      if (produtoCols.has('acessoRapido')) produtoExtras.push(`p."acessoRapido" as "produto_acessoRapido"`);
      if (produtoCols.has('autoAtendimento')) produtoExtras.push(`p."autoAtendimento" as "produto_autoAtendimento"`);
      if (produtoCols.has('barcode')) produtoExtras.push(`p.barcode as "produto_barcode"`);
      if (produtoCols.has('createdAt')) produtoExtras.push(`p."createdAt" as "produto_createdAt"`);
      if (produtoCols.has('updatedAt')) produtoExtras.push(`p."updatedAt" as "produto_updatedAt"`);

      const itensSql = `
        SELECT
          i.*,
          p.nome as "produto_nome"
          ${produtoExtras.length ? `, ${produtoExtras.join(', ')}` : ''}
        FROM "ItemCard" i
        INNER JOIN "Produto" p ON p.id = i."produtoId"
        WHERE i."cardId" = ANY($1::text[])
      `;
      const itensResult = await runQuery(itensSql, [cardIds]);

      const pagamentosResult = await runQuery(
        `SELECT p.*, fp.nome as "forma_nome", fp.tipo as "forma_tipo", fp.descricao as "forma_descricao"
         FROM "PagamentoCard" p
         INNER JOIN "FormaPagamento" fp ON fp.id = p."formaPagamentoId"
         WHERE p."cardId" = ANY($1::text[])
         ORDER BY p."createdAt" ASC`,
        [cardIds]
      );

      const pagamentoIds = pagamentosResult.rows.map((p: any) => p.id);
      const pagamentoItensResult =
        pagamentoIds.length > 0
          ? await runQuery(
              `SELECT *
               FROM "PagamentoItem"
               WHERE "pagamentoCardId" = ANY($1::text[])`,
              [pagamentoIds]
            )
          : { rows: [] as any[] };

      const produtoNomeToTargetId = new Map<string, string>();
      const formaNomeToTargetId = new Map<string, string>();

      const ensureProduto = async (produto: any) => {
        const nome = String(produto.produto_nome || produto.nome || '').trim();
        if (!nome) {
          throw new Error('Produto sem nome na origem');
        }
        const cached = produtoNomeToTargetId.get(nome);
        if (cached) return cached;

        const existing = await runQuery(
          `SELECT id FROM "Produto" WHERE "pointId" = $1 AND nome = $2 LIMIT 1`,
          [targetPointId, nome]
        );
        if (existing.rows[0]?.id) {
          produtoNomeToTargetId.set(nome, existing.rows[0].id);
          return existing.rows[0].id;
        }

        const id = uuidv4();
        const fields: any = {
          id,
          pointId: targetPointId,
          nome,
          descricao: produtoCols.has('descricao') ? produto.produto_descricao ?? null : undefined,
          precoVenda: produtoCols.has('precoVenda') ? produto.produto_precoVenda ?? 0 : undefined,
          precoCusto: produtoCols.has('precoCusto') ? produto.produto_precoCusto ?? null : undefined,
          categoria: produtoCols.has('categoria') ? produto.produto_categoria ?? null : undefined,
          ativo: produtoCols.has('ativo') ? produto.produto_ativo ?? true : undefined,
          acessoRapido: produtoCols.has('acessoRapido') ? produto.produto_acessoRapido ?? false : undefined,
          autoAtendimento: produtoCols.has('autoAtendimento') ? produto.produto_autoAtendimento ?? true : undefined,
          barcode: produtoCols.has('barcode') ? produto.produto_barcode ?? null : undefined,
          createdAt: produtoCols.has('createdAt') ? produto.produto_createdAt ?? new Date() : undefined,
          updatedAt: produtoCols.has('updatedAt') ? produto.produto_updatedAt ?? new Date() : undefined,
        };

        const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
        const values = cols.map((k) => fields[k]);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`);

        await runQuery(
          `INSERT INTO "Produto" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );

        produtoNomeToTargetId.set(nome, id);
        return id;
      };

      const ensureFormaPagamento = async (forma: any) => {
        const nome = String(forma.forma_nome || forma.nome || '').trim();
        if (!nome) {
          throw new Error('Forma de pagamento sem nome na origem');
        }
        const cached = formaNomeToTargetId.get(nome);
        if (cached) return cached;

        const existing = await runQuery(
          `SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2 LIMIT 1`,
          [targetPointId, nome]
        );
        if (existing.rows[0]?.id) {
          formaNomeToTargetId.set(nome, existing.rows[0].id);
          return existing.rows[0].id;
        }

        const id = uuidv4();
        const fields: any = {
          id,
          pointId: targetPointId,
          nome,
          descricao: formaCols.has('descricao') ? forma.forma_descricao ?? null : undefined,
          tipo: formaCols.has('tipo') ? forma.forma_tipo ?? 'OUTRO' : undefined,
          ativo: formaCols.has('ativo') ? forma.ativo ?? true : undefined,
          createdAt: formaCols.has('createdAt') ? forma.createdAt ?? new Date() : undefined,
          updatedAt: formaCols.has('updatedAt') ? forma.updatedAt ?? new Date() : undefined,
        };

        const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
        const values = cols.map((k) => fields[k]);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`);

        await runQuery(
          `INSERT INTO "FormaPagamento" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );

        formaNomeToTargetId.set(nome, id);
        return id;
      };

      const maxNumeroResult = await runQuery(
        `SELECT COALESCE(MAX("numeroCard"), 0)::int as max_numero
         FROM "CardCliente"
         WHERE "pointId" = $1`,
        [targetPointId]
      );
      let nextNumero = (maxNumeroResult.rows[0]?.max_numero ?? 0) + 1;

      const cardIdMap = new Map<string, string>();
      const itemIdMap = new Map<string, string>();
      const pagamentoIdMap = new Map<string, string>();

      let cardsImportados = 0;
      let itensImportados = 0;
      let pagamentosImportados = 0;
      let pagamentoItensImportados = 0;

      for (const cardOrigem of cardsOrigem) {
        const newCardId = uuidv4();
        cardIdMap.set(cardOrigem.id, newCardId);

        const fields: any = {
          id: newCardId,
          pointId: targetPointId,
          numeroCard: nextNumero++,
          status: cardOrigem.status,
          observacoes: cardCols.has('observacoes') ? cardOrigem.observacoes ?? null : undefined,
          valorTotal: cardCols.has('valorTotal') ? cardOrigem.valorTotal ?? 0 : undefined,
          createdAt: cardCols.has('createdAt') ? cardOrigem.createdAt ?? new Date() : undefined,
          updatedAt: cardCols.has('updatedAt') ? cardOrigem.updatedAt ?? new Date() : undefined,
          createdBy: cardCols.has('createdBy') ? (cardOrigem.createdBy ?? cardOrigem.createdById ?? null) : undefined,
          fechadoAt: cardCols.has('fechadoAt') ? cardOrigem.fechadoAt ?? null : undefined,
          fechadoBy: cardCols.has('fechadoBy') ? cardOrigem.fechadoBy ?? null : undefined,
          usuarioId: cardCols.has('usuarioId') ? cardOrigem.usuarioId ?? null : undefined,
          nomeAvulso: cardCols.has('nomeAvulso') ? cardOrigem.nomeAvulso ?? null : undefined,
          telefoneAvulso: cardCols.has('telefoneAvulso') ? cardOrigem.telefoneAvulso ?? null : undefined,
          createdById: cardCols.has('createdById') ? cardOrigem.createdById ?? null : undefined,
          updatedById: cardCols.has('updatedById') ? cardOrigem.updatedById ?? null : undefined,
        };

        if (cardCols.has('pagamentoPendente')) {
          fields.pagamentoPendente = false;
        }
        if (cardCols.has('pagamentoPendenteAt')) {
          fields.pagamentoPendenteAt = null;
        }
        if (cardCols.has('pagamentoPendenteById')) {
          fields.pagamentoPendenteById = null;
        }

        const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
        const values = cols.map((k) => fields[k]);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`);

        await runQuery(
          `INSERT INTO "CardCliente" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
        cardsImportados++;
      }

      const itensOrigem = itensResult.rows as any[];
      for (const item of itensOrigem) {
        const newCardId = cardIdMap.get(item.cardId);
        if (!newCardId) continue;

        const targetProdutoId = await ensureProduto(item);
        const newItemId = uuidv4();
        itemIdMap.set(item.id, newItemId);

        const fields: any = {
          id: newItemId,
          cardId: newCardId,
          produtoId: targetProdutoId,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          precoTotal: item.precoTotal,
          observacoes: itemCols.has('observacoes') ? item.observacoes ?? null : undefined,
          createdAt: itemCols.has('createdAt') ? item.createdAt ?? new Date() : undefined,
          updatedAt: itemCols.has('updatedAt') ? item.updatedAt ?? new Date() : undefined,
          createdById: itemCols.has('createdById') ? item.createdById ?? null : undefined,
          updatedById: itemCols.has('updatedById') ? item.updatedById ?? null : undefined,
        };

        const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
        const values = cols.map((k) => fields[k]);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`);

        await runQuery(
          `INSERT INTO "ItemCard" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
        itensImportados++;
      }

      const pagamentosOrigem = pagamentosResult.rows as any[];
      for (const pagamento of pagamentosOrigem) {
        const newCardId = cardIdMap.get(pagamento.cardId);
        if (!newCardId) continue;

        const targetFormaId = await ensureFormaPagamento(pagamento);
        const newPagamentoId = uuidv4();
        pagamentoIdMap.set(pagamento.id, newPagamentoId);

        const fields: any = {
          id: newPagamentoId,
          cardId: newCardId,
          formaPagamentoId: targetFormaId,
          valor: pagamento.valor,
          observacoes: pagamentoCols.has('observacoes') ? pagamento.observacoes ?? null : undefined,
          createdAt: pagamentoCols.has('createdAt') ? pagamento.createdAt ?? new Date() : undefined,
          createdBy: pagamentoCols.has('createdBy') ? (pagamento.createdBy ?? pagamento.createdById ?? null) : undefined,
          aberturaCaixaId: aberturaCaixaIdDestino,
          infinitePayOrderId: pagamentoCols.has('infinitePayOrderId') ? pagamento.infinitePayOrderId ?? null : undefined,
          infinitePayTransactionId: pagamentoCols.has('infinitePayTransactionId') ? pagamento.infinitePayTransactionId ?? null : undefined,
          createdById: pagamentoCols.has('createdById') ? pagamento.createdById ?? null : undefined,
          updatedById: pagamentoCols.has('updatedById') ? pagamento.updatedById ?? null : undefined,
          pagBankReferenceId: pagamentoCols.has('pagBankReferenceId') ? pagamento.pagBankReferenceId ?? null : undefined,
          pagBankCheckoutId: pagamentoCols.has('pagBankCheckoutId') ? pagamento.pagBankCheckoutId ?? null : undefined,
          pagBankChargeId: pagamentoCols.has('pagBankChargeId') ? pagamento.pagBankChargeId ?? null : undefined,
          pagBankPaymentMethod: pagamentoCols.has('pagBankPaymentMethod') ? pagamento.pagBankPaymentMethod ?? null : undefined,
        };

        const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
        const values = cols.map((k) => fields[k]);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`);

        await runQuery(
          `INSERT INTO "PagamentoCard" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
        pagamentosImportados++;
      }

      for (const pi of pagamentoItensResult.rows as any[]) {
        const newPagamentoId = pagamentoIdMap.get(pi.pagamentoCardId);
        const newItemId = itemIdMap.get(pi.itemCardId);
        if (!newPagamentoId || !newItemId) continue;

        await runQuery(
          `INSERT INTO "PagamentoItem" (id, "pagamentoCardId", "itemCardId", "createdAt")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("pagamentoCardId", "itemCardId") DO NOTHING`,
          [uuidv4(), newPagamentoId, newItemId, pi.createdAt ?? new Date()]
        );
        pagamentoItensImportados++;
      }

      return {
        cardsSelecionados: cardIds.length,
        cardsImportados,
        itensImportados,
        pagamentosImportados,
        pagamentoItensImportados,
        aberturaCaixaIdDestino,
      };
    });

    const response = NextResponse.json(resultado, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao importar movimentação', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
