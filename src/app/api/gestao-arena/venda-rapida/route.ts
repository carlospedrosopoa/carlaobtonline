// app/api/gestao-arena/venda-rapida/route.ts - API para criar venda completa em uma única chamada
import { NextRequest, NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarVendaRapidaPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/venda-rapida - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/gestao-arena/venda-rapida - Criar card + itens + pagamento em uma única transação
export async function POST(request: NextRequest) {
  let client;
  let clientLiberado = false;
  
  try {
    client = await pool.connect();
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      if (client && !clientLiberado) {
        client.release();
        clientLiberado = true;
      }
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem criar vendas
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      if (client && !clientLiberado) {
        client.release();
        clientLiberado = true;
      }
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar vendas' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarVendaRapidaPayload = await request.json();
    const { pointId, usuarioId, nomeAvulso, telefoneAvulso, observacoes, itens, pagamento } = body;

    // Validações antes de iniciar transação
    if (!pointId) {
      if (client && !clientLiberado) {
        client.release();
        clientLiberado = true;
      }
      const errorResponse = NextResponse.json(
        { mensagem: 'PointId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se não há usuário vinculado, nome avulso é obrigatório (telefone é opcional)
    if (!usuarioId && !nomeAvulso) {
      if (client && !clientLiberado) {
        client.release();
        clientLiberado = true;
      }
      const errorResponse = NextResponse.json(
        { mensagem: 'É necessário vincular um cliente ou informar o nome do cliente avulso' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!itens || itens.length === 0) {
      if (client) client.release();
      const errorResponse = NextResponse.json(
        { mensagem: 'É necessário adicionar pelo menos um item' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        if (client) client.release();
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    await client.query('BEGIN');

    try {
      // 1. Obter próximo número de card
      const numeroResult = await client.query(
        'SELECT proximo_numero_card($1) as "numeroCard"',
        [pointId]
      );
      const numeroCard = numeroResult.rows[0].numeroCard;

      // 2. Criar card
      const cardResult = await client.query(
        `INSERT INTO "CardCliente" (
          id, "pointId", "numeroCard", status, observacoes, "valorTotal", "usuarioId", 
          "nomeAvulso", "telefoneAvulso", "createdAt", "updatedAt", "createdBy"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, 'ABERTO', $3, 0, $4, $5, $6, NOW(), NOW(), $7
        ) RETURNING id, "pointId", "numeroCard", status, observacoes, "valorTotal", "usuarioId", 
          "nomeAvulso", "telefoneAvulso", "createdAt", "updatedAt", "createdBy"`,
        [pointId, numeroCard, observacoes || null, usuarioId || null, nomeAvulso || null, telefoneAvulso || null, usuario.id]
      );

      const cardId = cardResult.rows[0].id;
      let valorTotal = 0;
      const itemIds: string[] = [];

      // 3. Adicionar itens
      for (const item of itens) {
        // Buscar produto para obter preço se não informado
        const produtoResult = await client.query(
          'SELECT "precoVenda" FROM "Produto" WHERE id = $1 AND "pointId" = $2',
          [item.produtoId, pointId]
        );

        if (produtoResult.rows.length === 0) {
          throw new Error(`Produto ${item.produtoId} não encontrado`);
        }

        const precoVendaProduto = produtoResult.rows[0].precoVenda;
        const precoVendaNumero = typeof precoVendaProduto === 'string' 
          ? parseFloat(precoVendaProduto) 
          : parseFloat(String(precoVendaProduto));
        const precoUnitario = item.precoUnitario ?? precoVendaNumero;
        const precoTotal = precoUnitario * item.quantidade;
        valorTotal += precoTotal;

        const itemResult = await client.query(
          `INSERT INTO "ItemCard" (
            id, "cardId", "produtoId", quantidade, "precoUnitario", "precoTotal", observacoes, "createdAt", "updatedAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7
          ) RETURNING id`,
          [cardId, item.produtoId, item.quantidade, precoUnitario, precoTotal, item.observacoes || null, usuario.id]
        );

        itemIds.push(itemResult.rows[0].id);
      }

      // 4. Atualizar valor total do card
      await client.query(
        'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2',
        [valorTotal, cardId]
      );

      // 5. Adicionar pagamento se informado
      let pagamentoId: string | null = null;
      if (pagamento) {
        const formaPagamentoResult = await client.query(
          `SELECT id, nome, ativo, "origemFinanceiraPadrao", "contaBancariaIdPadrao" FROM "FormaPagamento" WHERE id = $1`,
          [pagamento.formaPagamentoId]
        );
        if (formaPagamentoResult.rows.length === 0 || !formaPagamentoResult.rows[0].ativo) {
          throw new Error('Forma de pagamento inválida para o pagamento');
        }
        const formaPagamento = formaPagamentoResult.rows[0];
        const origemFinanceira = formaPagamento.origemFinanceiraPadrao === 'CONTA_BANCARIA' ? 'CONTA_BANCARIA' : 'CAIXA';
        const contaBancariaIdPadrao = formaPagamento.contaBancariaIdPadrao || null;

        // Validar valor do pagamento
        if (pagamento.valor > valorTotal) {
          throw new Error(`O valor do pagamento (R$ ${pagamento.valor.toFixed(2)}) não pode ser maior que o valor total (R$ ${valorTotal.toFixed(2)})`);
        }

        // Se não informou itemIds, vincular a todos os itens
        const itemIdsParaPagamento = pagamento.itemIds && pagamento.itemIds.length > 0 
          ? pagamento.itemIds 
          : itemIds;

        // Validar que os itemIds pertencem ao card
        if (itemIdsParaPagamento.some(id => !itemIds.includes(id))) {
          throw new Error('Um ou mais itens não pertencem a este card');
        }

        let aberturaCaixaId = null;
        if (origemFinanceira === 'CAIXA') {
          const aberturaResult = await client.query(
            'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2 LIMIT 1',
            [pointId, 'ABERTA']
          );
          if (aberturaResult.rows.length === 0) {
            throw new Error('O caixa está fechado. Por favor, abra o caixa antes de realizar pagamentos.');
          }
          aberturaCaixaId = aberturaResult.rows[0].id;
        } else {
          if (!contaBancariaIdPadrao) {
            throw new Error('A forma de pagamento não possui conta bancária padrão configurada');
          }
          const contaBancariaResult = await client.query(
            `SELECT id, ativo, "pointId" FROM "ContaBancaria" WHERE id = $1`,
            [contaBancariaIdPadrao]
          );
          if (contaBancariaResult.rows.length === 0 || !contaBancariaResult.rows[0].ativo || contaBancariaResult.rows[0].pointId !== pointId) {
            throw new Error('Conta bancária padrão inválida para esta forma de pagamento');
          }
        }

        const pagamentoResult = await client.query(
          `INSERT INTO "PagamentoCard" (
            id, "cardId", "formaPagamentoId", valor, observacoes, "aberturaCaixaId", "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), $6
          ) RETURNING id`,
          [cardId, pagamento.formaPagamentoId, pagamento.valor, pagamento.observacoes || null, aberturaCaixaId, usuario.id]
        );

        pagamentoId = pagamentoResult.rows[0].id;

        if (origemFinanceira === 'CONTA_BANCARIA') {
          await client.query(
            `
            INSERT INTO "MovimentacaoContaBancaria" (
              id, "contaBancariaId", tipo, valor, data, descricao, origem, observacoes, "pagamentoCardId", "createdAt", "createdById"
            ) VALUES (
              gen_random_uuid()::text, $1, 'ENTRADA', $2, NOW()::date, $3, 'PAGAMENTO_COMANDA', $4, $5, NOW(), $6
            )
            `,
            [
              contaBancariaIdPadrao,
              pagamento.valor,
              `Pagamento de Comanda #${numeroCard}`,
              pagamento.observacoes || null,
              pagamentoId,
              usuario.id,
            ]
          );
        }

        // Vincular itens ao pagamento
        for (const itemId of itemIdsParaPagamento) {
          await client.query(
            `INSERT INTO "PagamentoItem" (id, "pagamentoCardId", "itemCardId", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, NOW())`,
            [pagamentoId, itemId]
          );
        }

        // Não criar entrada manual - a API de fluxo de caixa busca pagamentos de cards diretamente
        // Isso evita duplicação e garante que apareça como "ENTRADA_CARD" e não "ENTRADA_MANUAL"

        // Se o pagamento quitar o card, fechar automaticamente
        const totalPago = pagamento.valor;
        if (totalPago >= valorTotal) {
          await client.query(
            `UPDATE "CardCliente" 
             SET status = 'FECHADO', "pagamentoPendente" = FALSE, "pagamentoPendenteAt" = NULL, "pagamentoPendenteById" = NULL, "fechadoAt" = NOW(), "fechadoBy" = $1, "updatedAt" = NOW() 
             WHERE id = $2`,
            [usuario.id, cardId]
          );
        }
      }

      await client.query('COMMIT');
      console.log('Transação commitada com sucesso, cardId:', cardId);

      // Retornar card completo usando o mesmo client para garantir consistência
      console.log('Buscando card completo...');
      const cardCompletoResult = await client.query(
        `SELECT 
          c.*,
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
        FROM "CardCliente" c
        LEFT JOIN "User" u ON c."usuarioId" = u.id
        WHERE c.id = $1`,
        [cardId]
      );
      console.log('Card completo encontrado:', cardCompletoResult.rows.length);

      const cardRow = cardCompletoResult.rows[0];
      const cardCompleto: any = {
        id: cardRow.id,
        pointId: cardRow.pointId,
        numeroCard: cardRow.numeroCard,
        status: cardRow.status,
        observacoes: cardRow.observacoes,
        valorTotal: parseFloat(cardRow.valorTotal),
        createdAt: cardRow.createdAt,
        updatedAt: cardRow.updatedAt,
        createdBy: cardRow.createdBy,
        fechadoAt: cardRow.fechadoAt,
        fechadoBy: cardRow.fechadoBy,
        usuarioId: cardRow.usuarioId,
        nomeAvulso: cardRow.nomeAvulso,
        telefoneAvulso: cardRow.telefoneAvulso,
      };

      if (cardRow.usuario_id) {
        cardCompleto.usuario = {
          id: cardRow.usuario_id,
          name: cardRow.usuario_name,
          email: cardRow.usuario_email,
        };
      }

      console.log('Retornando card completo:', cardCompleto.id);
      const response = NextResponse.json(cardCompleto, { status: 201 });
      return withCors(response, request);
    } catch (error: any) {
      console.error('Erro na transação, fazendo rollback...', error);
      console.error('Detalhes do erro:', {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
      });
      try {
        await client.query('ROLLBACK');
        console.log('Rollback realizado com sucesso');
      } catch (rollbackError: any) {
        console.error('Erro ao fazer rollback:', rollbackError);
      }
      throw error;
    } finally {
      // Liberar client apenas uma vez no finally interno
      if (client && !clientLiberado) {
        console.log('Liberando client do pool (finally interno)');
        client.release();
        clientLiberado = true;
      }
    }
  } catch (error: any) {
    console.error('Erro ao criar venda rápida:', error);
    console.error('Stack trace:', error.stack);
    const mensagem = error.message || 'Erro ao criar venda rápida';
    const errorResponse = NextResponse.json(
      { mensagem, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: error.status || 500 }
    );
    return withCors(errorResponse, request);
  } finally {
    // Não liberar aqui - o client já foi liberado no finally interno
    // Isso evita tentar liberar duas vezes
  }
}

