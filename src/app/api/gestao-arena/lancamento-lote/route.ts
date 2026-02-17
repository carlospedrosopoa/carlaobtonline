import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    const body = await request.json();
    const {
      pointId,
      produtoId,
      quantidade = 1,
      valorUnitario,
      observacao,
      criarNovasComandas,
      atletas, // Array<{ id: string, nome?: string }>
    } = body;

    if (!pointId || !produtoId || !atletas || !Array.isArray(atletas) || atletas.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Dados incompletos' }, { status: 400 }), request);
    }

    // Verificar permissão
    if (usuario.role !== 'ADMIN') {
      const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!temAcesso) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para este estabelecimento' }, { status: 403 }), request);
      }
    }

    // Verificar produto
    const produtoResult = await query(
      'SELECT nome, "precoVenda" FROM "Produto" WHERE id = $1 AND "pointId" = $2',
      [produtoId, pointId]
    );

    if (produtoResult.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Produto não encontrado' }, { status: 404 }), request);
    }

    const produto = produtoResult.rows[0];
    const precoFinal = valorUnitario !== undefined ? valorUnitario : parseFloat(produto.precoVenda);
    const valorTotalItem = precoFinal * quantidade;

    const resultados = {
      sucesso: 0,
      falha: 0,
      detalhes: [] as any[],
    };

    await transaction(async (client) => {
      for (const atleta of atletas) {
        try {
          let cardId: string | null = null;
          let novoCard = false;

          // Se não for para forçar criar novas comandas, tentar encontrar uma aberta
          if (!criarNovasComandas) {
            // Buscar usuário associado ao atleta
            const atletaResult = await client.query(
              'SELECT "usuarioId" FROM "Atleta" WHERE id = $1',
              [atleta.id]
            );
            
            const usuarioId = atletaResult.rows[0]?.usuarioId;

            if (usuarioId) {
              const cardAbertoResult = await client.query(
                `SELECT id FROM "CardCliente" 
                 WHERE "pointId" = $1 AND "usuarioId" = $2 AND status = 'ABERTO' 
                 ORDER BY "createdAt" DESC LIMIT 1`,
                [pointId, usuarioId]
              );

              if (cardAbertoResult.rows.length > 0) {
                cardId = cardAbertoResult.rows[0].id;
              }
            }
          }

          // Se não encontrou card aberto ou forçou criar novo
          if (!cardId) {
            novoCard = true;
            // Buscar usuarioId novamente para garantir
            const atletaResult = await client.query(
              'SELECT "usuarioId" FROM "Atleta" WHERE id = $1',
              [atleta.id]
            );
            const usuarioId = atletaResult.rows[0]?.usuarioId;

            // Gerar número sequencial
            const numeroCardResult = await client.query(
              'SELECT proximo_numero_card($1) as numero',
              [pointId]
            );
            const numeroCard = numeroCardResult.rows[0].numero;

            // Criar Card
            const novoCardResult = await client.query(
              `INSERT INTO "CardCliente" 
               ("pointId", "numeroCard", "status", "valorTotal", "usuarioId", "nomeAvulso", "createdById", "createdAt", "updatedAt")
               VALUES ($1, $2, 'ABERTO', 0, $3, $4, $5, NOW(), NOW())
               RETURNING id`,
              [pointId, numeroCard, usuarioId || null, usuarioId ? null : (atleta.nome || 'Atleta'), usuario.id]
            );
            cardId = novoCardResult.rows[0].id;
          }

          // Adicionar Item
          await client.query(
            `INSERT INTO "ItemCard"
             ("cardId", "produtoId", "quantidade", "precoUnitario", "precoTotal", "observacoes", "createdById", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [cardId, produtoId, quantidade, precoFinal, valorTotalItem, observacao || null, usuario.id]
          );

          // Atualizar valor total do card
          await client.query(
            `UPDATE "CardCliente"
             SET "valorTotal" = (SELECT COALESCE(SUM("precoTotal"), 0) FROM "ItemCard" WHERE "cardId" = $1),
                 "updatedAt" = NOW()
             WHERE id = $1`,
            [cardId]
          );

          resultados.sucesso++;
          resultados.detalhes.push({
            atletaId: atleta.id,
            atletaNome: atleta.nome,
            status: 'sucesso',
            cardId,
            novoCard
          });

        } catch (erro: any) {
          console.error(`Erro ao processar atleta ${atleta.id}:`, erro);
          resultados.falha++;
          resultados.detalhes.push({
            atletaId: atleta.id,
            atletaNome: atleta.nome,
            status: 'erro',
            mensagem: erro.message
          });
        }
      }
    });

    return withCors(NextResponse.json({
      mensagem: 'Processamento concluído',
      resultados
    }), request);

  } catch (error: any) {
    console.error('Erro no lançamento em lote:', error);
    return withCors(NextResponse.json(
      { mensagem: 'Erro interno no servidor', error: error.message },
      { status: 500 }
    ), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
