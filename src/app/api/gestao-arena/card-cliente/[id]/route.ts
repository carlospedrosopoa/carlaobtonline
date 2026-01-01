// app/api/gestao-arena/card-cliente/[id]/route.ts - API de Card de Cliente individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import bcrypt from 'bcryptjs';
import type { AtualizarCardClientePayload, StatusCard } from '@/types/gestaoArena';

// GET /api/gestao-arena/card-cliente/[id] - Obter card de cliente
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
    const { searchParams } = new URL(request.url);
    const incluirItens = searchParams.get('incluirItens') !== 'false'; // Por padrão inclui
    const incluirPagamentos = searchParams.get('incluirPagamentos') !== 'false'; // Por padrão inclui
    const incluirAgendamentos = searchParams.get('incluirAgendamentos') !== 'false'; // Por padrão inclui

    // Query sem whatsapp pois a coluna não existe na tabela User
    const result = await query(
      `SELECT 
        c.id, c."pointId", c."numeroCard", c.status, c.observacoes, c."valorTotal",
        c."usuarioId", c."nomeAvulso", c."telefoneAvulso", c."createdAt", c."updatedAt", 
        c."createdById", c."updatedById",
        u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email", 
        NULL as "usuario_whatsapp",
        at.fone as "atleta_fone",
        uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
        uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
      FROM "CardCliente" c
      LEFT JOIN "User" u ON c."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON u.id = at."usuarioId"
      LEFT JOIN "User" uc ON c."createdById" = uc.id
      LEFT JOIN "User" uu ON c."updatedById" = uu.id
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card de cliente não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];
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
      createdById: row.createdById || null,
      updatedById: row.updatedById || null,
      createdBy: row.createdBy_user_id ? {
        id: row.createdBy_user_id,
        name: row.createdBy_user_name,
        email: row.createdBy_user_email,
      } : null,
      updatedBy: row.updatedBy_user_id ? {
        id: row.updatedBy_user_id,
        name: row.updatedBy_user_name,
        email: row.updatedBy_user_email,
      } : null,
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

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Incluir itens se solicitado
    if (incluirItens) {
      const itensResult = await query(
        `SELECT 
          i.*,
          p.id as "produto_id", p.nome as "produto_nome", p.descricao as "produto_descricao",
          p."precoVenda" as "produto_precoVenda", p.categoria as "produto_categoria",
          uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
          uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
        FROM "ItemCard" i
        LEFT JOIN "Produto" p ON i."produtoId" = p.id
        LEFT JOIN "User" uc ON i."createdById" = uc.id
        LEFT JOIN "User" uu ON i."updatedById" = uu.id
        WHERE i."cardId" = $1
        ORDER BY i."createdAt" ASC`,
        [id]
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
        createdById: itemRow.createdById || null,
        updatedById: itemRow.updatedById || null,
        createdBy: itemRow.createdBy_user_id ? {
          id: itemRow.createdBy_user_id,
          name: itemRow.createdBy_user_name,
          email: itemRow.createdBy_user_email,
        } : null,
        updatedBy: itemRow.updatedBy_user_id ? {
          id: itemRow.updatedBy_user_id,
          name: itemRow.updatedBy_user_name,
          email: itemRow.updatedBy_user_email,
        } : null,
        produto: itemRow.produto_id ? {
          id: itemRow.produto_id,
          nome: itemRow.produto_nome,
          descricao: itemRow.produto_descricao,
          precoVenda: parseFloat(itemRow.produto_precoVenda),
          categoria: itemRow.produto_categoria,
        } : null,
      }));
    }

    // Incluir pagamentos se solicitado
    if (incluirPagamentos) {
      const pagamentosResult = await query(
        `SELECT 
          p.*,
          fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
          uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
          uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
        FROM "PagamentoCard" p
        LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
        LEFT JOIN "User" uc ON p."createdById" = uc.id
        LEFT JOIN "User" uu ON p."updatedById" = uu.id
        WHERE p."cardId" = $1
        ORDER BY p."createdAt" ASC`,
        [id]
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
            createdById: pagRow.createdById || null,
            updatedById: pagRow.updatedById || null,
            createdBy: pagRow.createdBy_user_id ? {
              id: pagRow.createdBy_user_id,
              name: pagRow.createdBy_user_name,
              email: pagRow.createdBy_user_email,
            } : null,
            updatedBy: pagRow.updatedBy_user_id ? {
              id: pagRow.updatedBy_user_id,
              name: pagRow.updatedBy_user_name,
              email: pagRow.updatedBy_user_email,
            } : null,
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

    // Incluir agendamentos se solicitado
    if (incluirAgendamentos) {
      try {
        // Verificar se a tabela CardAgendamento existe
        const tableExists = await query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'CardAgendamento'
          )`
        );

        if (tableExists.rows[0]?.exists) {
          const agendamentosResult = await query(
            `SELECT 
              ca.id, ca."cardId", ca."agendamentoId", ca.valor, ca."createdAt",
              a.id as "agendamento_id", a."dataHora", a.duracao, a."valorCalculado", a."valorNegociado", a.status,
              q.id as "quadra_id", q.nome as "quadra_nome"
            FROM "CardAgendamento" ca
            INNER JOIN "Agendamento" a ON ca."agendamentoId" = a.id
            INNER JOIN "Quadra" q ON a."quadraId" = q.id
            WHERE ca."cardId" = $1
            ORDER BY a."dataHora" DESC`,
            [id]
          );

          card.agendamentos = agendamentosResult.rows.map((row: any) => ({
            id: row.id,
            cardId: row.cardId,
            agendamentoId: row.agendamentoId,
            valor: parseFloat(row.valor),
            createdAt: row.createdAt,
            agendamento: {
              id: row.agendamento_id,
              quadra: {
                id: row.quadra_id,
                nome: row.quadra_nome,
              },
              dataHora: row.dataHora,
              duracao: row.duracao,
              valorCalculado: row.valorCalculado ? parseFloat(row.valorCalculado) : null,
              valorNegociado: row.valorNegociado ? parseFloat(row.valorNegociado) : null,
              status: row.status,
            },
          }));
        } else {
          // Tabela não existe ainda, retornar array vazio
          card.agendamentos = [];
        }
      } catch (error: any) {
        // Se houver erro, logar mas não quebrar a requisição
        console.error('Erro ao buscar agendamentos do card:', error);
        card.agendamentos = [];
      }
    }

    // Calcular saldo (valorTotal - totalPago)
    const totalPagoResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
      [id]
    );
    const totalPago = parseFloat(totalPagoResult.rows[0].total);
    card.totalPago = totalPago;
    card.saldo = card.valorTotal - totalPago;

    const response = NextResponse.json(card);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter card de cliente:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter card de cliente', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/gestao-arena/card-cliente/[id] - Atualizar card de cliente
export async function PUT(
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

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar cards de clientes' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body: AtualizarCardClientePayload = await request.json();

    // Verificar se o card existe
    const existe = await query(
      'SELECT "pointId", status FROM "CardCliente" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card de cliente não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const cardAtual = existe.rows[0];

    // Verificar se ORGANIZER tem acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, cardAtual.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Se está fechando o card, verificar se está totalmente pago
    // O card pode permanecer aberto com saldo pendente para permitir pagamentos parciais
    if (body.status === 'FECHADO' && cardAtual.status !== 'FECHADO') {
      // Calcular valor total dos pagamentos
      const pagamentosResult = await query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM "PagamentoCard" WHERE "cardId" = $1',
        [id]
      );
      const totalPago = parseFloat(pagamentosResult.rows[0].total);

      // Obter valor total do card
      const cardResult = await query(
        'SELECT "valorTotal" FROM "CardCliente" WHERE id = $1',
        [id]
      );
      const valorTotal = parseFloat(cardResult.rows[0].valorTotal);
      const saldoPendente = valorTotal - totalPago;

      if (totalPago < valorTotal) {
        const errorResponse = NextResponse.json(
          { mensagem: `Não é possível fechar o card com saldo pendente. Valor total: R$ ${valorTotal.toFixed(2)}, já pago: R$ ${totalPago.toFixed(2)}, saldo pendente: R$ ${saldoPendente.toFixed(2)}. O card pode permanecer aberto para receber pagamentos parciais.` },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(body.status);
      paramCount++;

      // Se está fechando, registrar data e usuário
      if (body.status === 'FECHADO' && cardAtual.status !== 'FECHADO') {
        updates.push(`"fechadoAt" = NOW()`);
        updates.push(`"fechadoBy" = $${paramCount}`);
        values.push(usuario.id);
        paramCount++;
      } else if (body.status !== 'FECHADO' && cardAtual.status === 'FECHADO') {
        // Se está reabrindo, limpar dados de fechamento
        updates.push(`"fechadoAt" = NULL`);
        updates.push(`"fechadoBy" = NULL`);
      }
    }
    if (body.observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      values.push(body.observacoes || null);
      paramCount++;
    }
    if (body.usuarioId !== undefined) {
      updates.push(`"usuarioId" = $${paramCount}`);
      values.push(body.usuarioId || null);
      paramCount++;
      
      // Se está removendo o usuário, limpar campos avulsos se não foram informados
      if (!body.usuarioId && body.nomeAvulso === undefined && body.telefoneAvulso === undefined) {
        updates.push(`"nomeAvulso" = NULL`);
        updates.push(`"telefoneAvulso" = NULL`);
      }
    }
    if (body.nomeAvulso !== undefined) {
      updates.push(`"nomeAvulso" = $${paramCount}`);
      values.push(body.nomeAvulso || null);
      paramCount++;
    }
    if (body.telefoneAvulso !== undefined) {
      updates.push(`"telefoneAvulso" = $${paramCount}`);
      values.push(body.telefoneAvulso || null);
      paramCount++;
    }

    // Validação: se está atualizando campos de cliente, verificar se há cliente vinculado ou nome avulso
    // Esta validação só deve ser executada quando os campos de cliente estão sendo alterados
    if (body.usuarioId !== undefined || body.nomeAvulso !== undefined || body.telefoneAvulso !== undefined) {
      const novoUsuarioId = body.usuarioId !== undefined ? body.usuarioId : cardAtual.usuarioId;
      const novoNomeAvulso = body.nomeAvulso !== undefined ? body.nomeAvulso : cardAtual.nomeAvulso;
      
      if (!novoUsuarioId && !novoNomeAvulso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'É necessário vincular um cliente ou informar o nome do cliente avulso' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE "CardCliente" 
       SET ${updates.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING *`,
      values
    );

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar card de cliente:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar card de cliente', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// OPTIONS /api/gestao-arena/card-cliente/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// DELETE /api/gestao-arena/card-cliente/[id] - Deletar card de cliente
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

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar cards de clientes' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    
    // Fazer parse do body
    let body: any = {};
    try {
      body = await request.json();
    } catch (error: any) {
      // Se não conseguir fazer parse (body vazio ou inválido), body permanece como objeto vazio
      console.error('Erro ao fazer parse do body DELETE:', error?.message);
    }
    
    const { senha } = body;

    // Validar senha
    if (!senha) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Senha é obrigatória para excluir o card' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar usuário no banco para validar senha
    const usuarioResult = await query(
      'SELECT id, email, password FROM "User" WHERE id = $1',
      [usuario.id]
    );

    if (usuarioResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const usuarioDb = usuarioResult.rows[0];
    const senhaHash = usuarioDb.password;

    if (!senhaHash) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro na configuração do usuário' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    // Validar senha
    const senhaValida = await bcrypt.compare(senha, senhaHash);

    if (!senhaValida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Senha incorreta' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const existe = await query(
      'SELECT "pointId" FROM "CardCliente" WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card de cliente não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = existe.rows[0];

    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, card.pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este card' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Apenas cards cancelados ou abertos sem itens podem ser deletados
    const cardInfo = await query(
      'SELECT status FROM "CardCliente" WHERE id = $1',
      [id]
    );
    const status = cardInfo.rows[0].status;

    if (status === 'FECHADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar um card fechado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se há itens ou pagamentos
    const itens = await query(
      'SELECT id FROM "ItemCard" WHERE "cardId" = $1 LIMIT 1',
      [id]
    );
    const pagamentos = await query(
      'SELECT id FROM "PagamentoCard" WHERE "cardId" = $1 LIMIT 1',
      [id]
    );

    if (itens.rows.length > 0 || pagamentos.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar um card que possui itens ou pagamentos. Cancele o card ao invés de deletá-lo.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    await query('DELETE FROM "CardCliente" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Card de cliente deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar card de cliente:', error);
    console.error('Stack trace:', error.stack);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar card de cliente', error: error.message, details: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

