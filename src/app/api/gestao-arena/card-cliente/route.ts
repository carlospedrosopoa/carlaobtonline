// app/api/gestao-arena/card-cliente/route.ts - API de Cards de Clientes
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarCardClientePayload, AtualizarCardClientePayload, StatusCard } from '@/types/gestaoArena';

// GET /api/gestao-arena/card-cliente - Listar cards de clientes
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const status = searchParams.get('status') as StatusCard | null;
    const incluirItens = searchParams.get('incluirItens') === 'true';
    const incluirPagamentos = searchParams.get('incluirPagamentos') === 'true';

    // Query base - tentar com whatsapp primeiro, se falhar usar sem
    let sql = `SELECT 
      c.id, c."pointId", c."numeroCard", c.status, c.observacoes, c."valorTotal",
      c."usuarioId", c."nomeAvulso", c."telefoneAvulso", c."createdAt", c."updatedAt", c."createdBy", c."fechadoAt", c."fechadoBy",
      u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email", 
      u.whatsapp as "usuario_whatsapp",
      at.fone as "atleta_fone"
    FROM "CardCliente" c
    LEFT JOIN "User" u ON c."usuarioId" = u.id
    LEFT JOIN "Atleta" at ON u.id = at."usuarioId"
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas cards da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND c."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      sql += ` AND c."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar cards de clientes' },
        { status: 403 }
      );
    }

    if (status) {
      sql += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    sql += ` ORDER BY c."numeroCard" DESC`;

    let result;
    try {
      result = await query(sql, params);
    } catch (error: any) {
      // Se falhar por coluna whatsapp não encontrada, tentar sem whatsapp
      if (error.code === '42703' || error.message?.includes('whatsapp') || error.message?.includes('column')) {
        sql = `SELECT 
          c.id, c."pointId", c."numeroCard", c.status, c.observacoes, c."valorTotal",
          c."usuarioId", c."nomeAvulso", c."telefoneAvulso", c."createdAt", c."updatedAt", c."createdBy", c."fechadoAt", c."fechadoBy",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email", NULL as "usuario_whatsapp",
          at.fone as "atleta_fone"
        FROM "CardCliente" c
        LEFT JOIN "User" u ON c."usuarioId" = u.id
        LEFT JOIN "Atleta" at ON u.id = at."usuarioId"
        WHERE 1=1`;
        
        // Reconstruir WHERE clauses
        const params2: any[] = [];
        let paramCount2 = 1;
        
        if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
          sql += ` AND c."pointId" = $${paramCount2}`;
          params2.push(usuario.pointIdGestor);
          paramCount2++;
        } else if (pointId) {
          sql += ` AND c."pointId" = $${paramCount2}`;
          params2.push(pointId);
          paramCount2++;
        }
        
        if (status) {
          sql += ` AND c.status = $${paramCount2}`;
          params2.push(status);
          paramCount2++;
        }
        
        sql += ` ORDER BY c."numeroCard" DESC`;
        result = await query(sql, params2);
      } else {
        throw error;
      }
    }
    
    const cards = result.rows.map((row: any) => {
      const card: any = {
        id: row.id,
        pointId: row.pointId,
        numeroCard: row.numeroCard,
        status: row.status,
        observacoes: row.observacoes,
        valorTotal: parseFloat(row.valorTotal),
        usuarioId: row.usuarioId,
        nomeAvulso: row.nomeAvulso,
        telefoneAvulso: row.telefoneAvulso,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        fechadoAt: row.fechadoAt,
        fechadoBy: row.fechadoBy,
      };

      if (row.usuario_id) {
        card.usuario = {
          id: row.usuario_id,
          name: row.usuario_name,
          email: row.usuario_email,
          whatsapp: row.usuario_whatsapp || null,
          telefone: row.atleta_fone || null, // Telefone vem do atleta vinculado
        };
      }

      return card;
    });

    // Se solicitado, incluir itens e pagamentos
    if (incluirItens || incluirPagamentos) {
      for (const card of cards) {
        if (incluirItens) {
          const itensResult = await query(
            `SELECT 
              i.id, i."cardId", i."produtoId", i.quantidade, i."precoUnitario", i."precoTotal", i.observacoes,
              i."createdAt", i."updatedAt",
              p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
              p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria"
            FROM "ItemCard" i
            LEFT JOIN "Produto" p ON i."produtoId" = p.id
            WHERE i."cardId" = $1
            ORDER BY i."createdAt" ASC`,
            [card.id]
          );

          card.itens = itensResult.rows.map((itemRow: any) => ({
            id: itemRow.id,
            cardId: itemRow.cardId,
            produtoId: itemRow.produtoId,
            quantidade: parseFloat(itemRow.quantidade),
            precoUnitario: parseFloat(itemRow.precoUnitario),
            precoTotal: parseFloat(itemRow.precoTotal),
            observacoes: itemRow.observacoes,
            createdAt: itemRow.createdAt,
            updatedAt: itemRow.updatedAt,
            produto: itemRow.produto_id ? {
              id: itemRow.produto_id,
              nome: itemRow.produto_nome,
              descricao: itemRow.produto_descricao,
              precoVenda: parseFloat(itemRow.produto_precoVenda),
              categoria: itemRow.produto_categoria,
            } : null,
          }));
        }

        if (incluirPagamentos) {
          const pagamentosResult = await query(
            `SELECT 
              p.id, p."cardId", p."formaPagamentoId", p.valor, p.observacoes, p."createdAt", p."createdBy",
              fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo"
            FROM "PagamentoCard" p
            LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
            WHERE p."cardId" = $1
            ORDER BY p."createdAt" ASC`,
            [card.id]
          );

          // Buscar itens vinculados a cada pagamento
          card.pagamentos = await Promise.all(
            pagamentosResult.rows.map(async (pagRow: any) => {
              const itensResult = await query(
                `SELECT 
                  i.*,
                  p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
                  p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria"
                FROM "PagamentoItem" pi
                INNER JOIN "ItemCard" i ON pi."itemCardId" = i.id
                LEFT JOIN "Produto" p ON i."produtoId" = p.id
                WHERE pi."pagamentoCardId" = $1
                ORDER BY i."createdAt" ASC`,
                [pagRow.id]
              );

              const itens = itensResult.rows.map((itemRow: any) => ({
                id: itemRow.id,
                cardId: itemRow.cardId,
                produtoId: itemRow.produtoId,
                quantidade: parseFloat(itemRow.quantidade),
                precoUnitario: parseFloat(itemRow.precoUnitario),
                precoTotal: parseFloat(itemRow.precoTotal),
                observacoes: itemRow.observacoes,
                createdAt: itemRow.createdAt,
                updatedAt: itemRow.updatedAt,
                produto: itemRow.produto_id ? {
                  id: itemRow.produto_id,
                  nome: itemRow.produto_nome,
                  descricao: itemRow.produto_descricao,
                  precoVenda: parseFloat(itemRow.produto_precoVenda),
                  categoria: itemRow.produto_categoria,
                } : null,
              }));

              return {
                id: pagRow.id,
                cardId: pagRow.cardId,
                formaPagamentoId: pagRow.formaPagamentoId,
                valor: parseFloat(pagRow.valor),
                observacoes: pagRow.observacoes,
                createdAt: pagRow.createdAt,
                createdBy: pagRow.createdBy,
                formaPagamento: pagRow.formaPagamento_id ? {
                  id: pagRow.formaPagamento_id,
                  nome: pagRow.formaPagamento_nome,
                  tipo: pagRow.formaPagamento_tipo,
                } : null,
                itens: itens.length > 0 ? itens : undefined,
              };
            })
          );
        }

        // Calcular saldo (valorTotal - totalPago)
        const totalPagoResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
          [card.id]
        );
        const totalPago = parseFloat(totalPagoResult.rows[0].total);
        card.totalPago = totalPago;
        card.saldo = card.valorTotal - totalPago;
      }
    }
    
    return NextResponse.json(cards);
  } catch (error: any) {
    console.error('Erro ao listar cards de clientes:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar cards de clientes', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/card-cliente - Criar card de cliente
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem criar cards
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para criar cards de clientes' },
        { status: 403 }
      );
    }

    const body: CriarCardClientePayload = await request.json();
    const { pointId, observacoes, usuarioId, nomeAvulso, telefoneAvulso } = body;

    if (!pointId) {
      return NextResponse.json(
        { mensagem: 'PointId é obrigatório' },
        { status: 400 }
      );
    }

    // Se não há usuário vinculado, nome avulso é obrigatório (telefone é opcional)
    if (!usuarioId && !nomeAvulso) {
      return NextResponse.json(
        { mensagem: 'É necessário vincular um cliente ou informar o nome do cliente avulso' },
        { status: 400 }
      );
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
      }
    }

    // Obter próximo número de card usando a função do banco
    const numeroResult = await query(
      'SELECT proximo_numero_card($1) as "numeroCard"',
      [pointId]
    );
    const numeroCard = numeroResult.rows[0].numeroCard;

    const result = await query(
      `INSERT INTO "CardCliente" (
        id, "pointId", "numeroCard", status, observacoes, "valorTotal", "usuarioId", 
        "nomeAvulso", "telefoneAvulso", "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, 'ABERTO', $3, 0, $4, $5, $6, NOW(), NOW(), $7
      ) RETURNING *`,
      [pointId, numeroCard, observacoes || null, usuarioId || null, nomeAvulso || null, telefoneAvulso || null, usuario.id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar card de cliente:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar card de cliente', error: error.message },
      { status: 500 }
    );
  }
}

