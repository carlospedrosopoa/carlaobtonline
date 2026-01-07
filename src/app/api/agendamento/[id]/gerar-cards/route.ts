// app/api/agendamento/[id]/gerar-cards/route.ts - Gerar cards de cliente a partir de um agendamento
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

// OPTIONS /api/agendamento/[id]/gerar-cards - Preflight CORS
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/agendamento/[id]/gerar-cards - Gerar cards para todos os clientes envolvidos no agendamento
export async function POST(
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

    // Apenas ADMIN e ORGANIZER podem gerar cards
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para gerar cards' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: agendamentoId } = await params;

    // Buscar agendamento completo com informações da quadra e usuário titular
    const agendamentoResult = await query(
      `SELECT 
        a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
        a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
        a.status, a.observacoes,
        q."pointId" as "quadra_pointId", q.nome as "quadra_nome",
        u.id as "usuario_titular_id", u.name as "usuario_titular_name",
        at.id as "atleta_titular_id", at.nome as "atleta_titular_nome",
        at."usuarioId" as "atleta_titular_usuarioId",
        u_atleta.id as "atleta_titular_usuario_id", u_atleta.name as "atleta_titular_usuario_name"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      LEFT JOIN "User" u_atleta ON at."usuarioId" = u_atleta.id
      WHERE a.id = $1`,
      [agendamentoId]
    );

    if (agendamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const agendamento = agendamentoResult.rows[0];

    // Verificar se o usuário tem acesso à quadra
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAQuadra(usuario, agendamento.quadraId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a este agendamento' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const pointId = agendamento.quadra_pointId;
    if (!pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Arena não encontrada para este agendamento' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Calcular valor total do agendamento
    const valorTotal = agendamento.valorNegociado || agendamento.valorCalculado || 0;
    if (valorTotal <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não possui valor definido' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Lista de clientes para criar cards
    const clientes: Array<{
      usuarioId?: string | null;
      nomeAvulso?: string | null;
      telefoneAvulso?: string | null;
    }> = [];

    // Buscar atletas participantes e participantes avulsos
    let participantesResult;
    try {
      participantesResult = await query(
        `SELECT 
          aa."atletaId", aa."nomeAvulso", aa."telefoneAvulso",
          at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
          at."usuarioId" as "atleta_usuarioId",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
        FROM "AgendamentoAtleta" aa
        LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
        LEFT JOIN "User" u ON at."usuarioId" = u.id
        WHERE aa."agendamentoId" = $1`,
        [agendamentoId]
      );
    } catch (error: any) {
      // Se os campos nomeAvulso/telefoneAvulso não existem, tentar query sem eles
      if (error.message?.includes('nomeAvulso') || error.message?.includes('telefoneAvulso') || error.code === '42703') {
        console.warn('[gerar-cards] Campos nomeAvulso/telefoneAvulso não existem, usando query sem eles');
        participantesResult = await query(
          `SELECT 
            aa."atletaId",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
            at."usuarioId" as "atleta_usuarioId",
            u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
          FROM "AgendamentoAtleta" aa
          LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
          LEFT JOIN "User" u ON at."usuarioId" = u.id
          WHERE aa."agendamentoId" = $1`,
          [agendamentoId]
        );
        // Adicionar campos null para compatibilidade
        participantesResult.rows = participantesResult.rows.map((row: any) => ({
          ...row,
          nomeAvulso: null,
          telefoneAvulso: null,
        }));
      } else {
        throw error;
      }
    }

    console.log(`[gerar-cards] Participantes encontrados: ${participantesResult.rows.length}`);
    participantesResult.rows.forEach((row: any, index: number) => {
      console.log(`[gerar-cards] Participante ${index + 1}:`, {
        atletaId: row.atletaId,
        nomeAvulso: row.nomeAvulso,
        telefoneAvulso: row.telefoneAvulso,
        atleta_nome: row.atleta_nome,
        usuario_id: row.usuario_id,
      });
    });

    console.log(`[gerar-cards] Clientes antes de adicionar cliente original: ${clientes.length}`);

    // Adicionar cliente original
    if (agendamento.atletaId) {
      // Buscar dados do atleta original
      const atletaOriginalResult = await query(
        `SELECT 
          at.id, at.nome, at.fone, at."usuarioId",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
        FROM "Atleta" at
        LEFT JOIN "User" u ON at."usuarioId" = u.id
        WHERE at.id = $1`,
        [agendamento.atletaId]
      );

      if (atletaOriginalResult.rows.length > 0) {
        const atletaOriginal = atletaOriginalResult.rows[0];
        // Se tiver usuarioId, adiciona como cliente tipo user
        if (atletaOriginal.usuario_id) {
          clientes.push({
            usuarioId: atletaOriginal.usuario_id,
            nomeAvulso: null,
            telefoneAvulso: null,
          });
        } else if (atletaOriginal.nome && atletaOriginal.fone) {
          // Se não tiver usuarioId, é avulso - criar card para cliente avulso
          clientes.push({
            usuarioId: null,
            nomeAvulso: atletaOriginal.nome,
            telefoneAvulso: atletaOriginal.fone,
          });
        }
      }
    } else if (agendamento.usuarioId) {
      // Usuário direto (sem atleta) - sempre cria card
      clientes.push({
        usuarioId: agendamento.usuarioId,
        nomeAvulso: null,
        telefoneAvulso: null,
      });
    } else if (agendamento.nomeAvulso && agendamento.telefoneAvulso) {
      // Cliente avulso - criar card para cliente avulso
      clientes.push({
        usuarioId: null,
        nomeAvulso: agendamento.nomeAvulso,
        telefoneAvulso: agendamento.telefoneAvulso,
      });
    }

    // Adicionar atletas participantes e participantes avulsos
    console.log(`[gerar-cards] Processando ${participantesResult.rows.length} participantes...`);
    participantesResult.rows.forEach((row: any, index: number) => {
      console.log(`[gerar-cards] Processando participante ${index + 1}:`, {
        atletaId: row.atletaId,
        nomeAvulso: row.nomeAvulso,
        telefoneAvulso: row.telefoneAvulso,
        atleta_nome: row.atleta_nome,
        atleta_fone: row.atleta_fone,
        usuario_id: row.usuario_id,
      });

      // Se for participante avulso (sem atletaId, com nomeAvulso)
      if (!row.atletaId && row.nomeAvulso) {
        console.log(`[gerar-cards] ✅ Encontrado participante avulso: ${row.nomeAvulso}`);
        // Verificar se já existe um cliente avulso com o mesmo nome
        // (telefone pode ser null, então comparamos apenas por nome)
        const jaExiste = clientes.some(
          (c) => !c.usuarioId && c.nomeAvulso === row.nomeAvulso
        );

        if (!jaExiste) {
          console.log(`[gerar-cards] ➕ Adicionando participante avulso à lista: ${row.nomeAvulso}`);
          clientes.push({
            usuarioId: null,
            nomeAvulso: row.nomeAvulso,
            telefoneAvulso: row.telefoneAvulso || null,
          });
        } else {
          console.log(`[gerar-cards] ⚠️ Participante avulso "${row.nomeAvulso}" já existe na lista de clientes`);
        }
      } else if (row.usuario_id) {
        // Atleta com usuarioId (tipo user) - verificar se já existe
        const jaExiste = clientes.some(
          (c) => c.usuarioId && c.usuarioId === row.usuario_id
        );

        if (!jaExiste) {
          clientes.push({
            usuarioId: row.usuario_id,
            nomeAvulso: null,
            telefoneAvulso: null,
          });
        }
      } else if (row.atleta_nome && row.atleta_fone) {
        // Atleta avulso (sem usuarioId) - criar card para cliente avulso
        const jaExiste = clientes.some(
          (c) => c.nomeAvulso === row.atleta_nome && c.telefoneAvulso === row.atleta_fone
        );

        if (!jaExiste) {
          clientes.push({
            usuarioId: null,
            nomeAvulso: row.atleta_nome,
            telefoneAvulso: row.atleta_fone,
          });
        }
      }
    });

    console.log(`[gerar-cards] Total de clientes após adicionar participantes: ${clientes.length}`);
    clientes.forEach((cliente, index) => {
      console.log(`[gerar-cards] Cliente ${index + 1}:`, {
        usuarioId: cliente.usuarioId,
        nomeAvulso: cliente.nomeAvulso,
        telefoneAvulso: cliente.telefoneAvulso,
      });
    });

    if (clientes.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum cliente encontrado no agendamento' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Calcular valor por cliente (divisão igual)
    const valorPorCliente = valorTotal / clientes.length;

    // Verificar ou criar produto "Locação"
    let produtoLocacaoResult = await query(
      'SELECT id, "precoVenda" FROM "Produto" WHERE "pointId" = $1 AND LOWER(nome) = LOWER($2)',
      [pointId, 'Locação']
    );

    let produtoLocacaoId: string;
    if (produtoLocacaoResult.rows.length === 0) {
      // Criar produto "Locação"
      const novoProdutoResult = await query(
        `INSERT INTO "Produto" (
          id, "pointId", nome, descricao, "precoVenda", categoria, ativo, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW()
        ) RETURNING id, "precoVenda"`,
        [pointId, 'Locação', 'Locação de quadra', valorPorCliente, 'Serviço', true]
      );
      produtoLocacaoId = novoProdutoResult.rows[0].id;
    } else {
      produtoLocacaoId = produtoLocacaoResult.rows[0].id;
    }

    // Preparar informações para observações
    const dataHora = new Date(agendamento.dataHora);
    const dataFormatada = dataHora.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const horaFormatada = dataHora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const quadraNome = agendamento.quadra_nome || 'Quadra';
    
    // Identificar usuário titular da agenda
    let usuarioTitularNome = '';
    if (agendamento.atleta_titular_usuario_id) {
      usuarioTitularNome = agendamento.atleta_titular_usuario_name || '';
    } else if (agendamento.usuario_titular_id) {
      usuarioTitularNome = agendamento.usuario_titular_name || '';
    } else if (agendamento.nomeAvulso) {
      usuarioTitularNome = agendamento.nomeAvulso;
    }

    // Observações do card
    const observacoesCard = 'Card Gerado Pela Agenda';
    
    // Observações do item - incluir informações do agendamento e suas observações
    let observacoesItem = `Agendamento: ${dataFormatada} ${horaFormatada}, ${quadraNome}${usuarioTitularNome ? `, ${usuarioTitularNome}` : ''}`;
    
    // Adicionar observações do agendamento se existirem
    if (agendamento.observacoes && agendamento.observacoes.trim()) {
      observacoesItem += `\nObservações: ${agendamento.observacoes.trim()}`;
    }

    // Criar ou atualizar cards para cada cliente
    const cardsCriados = [];
    const cardsAtualizados = [];

    for (const cliente of clientes) {
      // Verificar se o cliente já tem um card aberto na mesma arena
      let cardExistente = null;
      
      if (cliente.usuarioId) {
        // Buscar card aberto do cliente (tipo user)
        const cardAbertoResult = await query(
          `SELECT id, "numeroCard", "valorTotal" 
           FROM "CardCliente" 
           WHERE "pointId" = $1 AND "usuarioId" = $2 AND status = 'ABERTO'
           ORDER BY "createdAt" DESC
           LIMIT 1`,
          [pointId, cliente.usuarioId]
        );

        if (cardAbertoResult.rows.length > 0) {
          cardExistente = cardAbertoResult.rows[0];
        }
      } else if (cliente.nomeAvulso && cliente.telefoneAvulso) {
        // Buscar card aberto do cliente avulso
        const cardAbertoResult = await query(
          `SELECT id, "numeroCard", "valorTotal" 
           FROM "CardCliente" 
           WHERE "pointId" = $1 AND "nomeAvulso" = $2 AND "telefoneAvulso" = $3 AND status = 'ABERTO'
           ORDER BY "createdAt" DESC
           LIMIT 1`,
          [pointId, cliente.nomeAvulso, cliente.telefoneAvulso]
        );

        if (cardAbertoResult.rows.length > 0) {
          cardExistente = cardAbertoResult.rows[0];
        }
      }

      let card;
      let cardNovo = false;

      if (cardExistente) {
        // Usar card existente
        card = cardExistente;
        cardNovo = false;
      } else {
        // Criar novo card
        const cardResult = await query(
          `INSERT INTO "CardCliente" (
            id, "pointId", "numeroCard", status, observacoes, "valorTotal",
            "usuarioId", "nomeAvulso", "telefoneAvulso", "createdAt", "updatedAt", "createdBy"
          ) VALUES (
            gen_random_uuid()::text, $1, 
            (SELECT COALESCE(MAX("numeroCard"), 0) + 1 FROM "CardCliente" WHERE "pointId" = $1),
            'ABERTO', $2, $3, $4, $5, $6, NOW(), NOW(), $7
          ) RETURNING id, "numeroCard", "valorTotal"`,
          [
            pointId,
            observacoesCard,
            valorPorCliente,
            cliente.usuarioId || null,
            cliente.nomeAvulso || null,
            cliente.telefoneAvulso || null,
            usuario.id,
          ]
        );

        card = cardResult.rows[0];
        cardNovo = true;
      }

      // Criar item "Locação" no card com observações
      await query(
        `INSERT INTO "ItemCard" (
          id, "cardId", "produtoId", quantidade, "precoUnitario", "precoTotal", observacoes, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, 1, $3, $3, $4, NOW(), NOW()
        )`,
        [card.id, produtoLocacaoId, valorPorCliente, observacoesItem]
      );

      // Atualizar valorTotal do card (somar ao valor existente se for card antigo)
      const valorTotalAtual = cardNovo 
        ? 0 
        : (typeof card.valorTotal === 'number' ? card.valorTotal : parseFloat(card.valorTotal) || 0);
      const novoValorTotal = valorTotalAtual + valorPorCliente;

      await query(
        'UPDATE "CardCliente" SET "valorTotal" = $1, "updatedAt" = NOW() WHERE id = $2',
        [novoValorTotal, card.id]
      );

      if (cardNovo) {
        cardsCriados.push({
          id: card.id,
          numeroCard: card.numeroCard,
          cliente: cliente.usuarioId 
            ? { tipo: 'usuario', id: cliente.usuarioId }
            : { tipo: 'avulso', nome: cliente.nomeAvulso },
          valor: valorPorCliente,
        });
      } else {
        cardsAtualizados.push({
          id: card.id,
          numeroCard: card.numeroCard,
          cliente: cliente.usuarioId 
            ? { tipo: 'usuario', id: cliente.usuarioId }
            : { tipo: 'avulso', nome: cliente.nomeAvulso },
          valor: valorPorCliente,
          valorTotalAnterior: valorTotalAtual,
          valorTotalNovo: novoValorTotal,
        });
      }
    }

    // Montar mensagem de resposta
    let mensagem = '';
    if (cardsCriados.length > 0 && cardsAtualizados.length > 0) {
      mensagem = `${cardsCriados.length} card(s) criado(s) e ${cardsAtualizados.length} card(s) atualizado(s) com sucesso`;
    } else if (cardsCriados.length > 0) {
      mensagem = `${cardsCriados.length} card(s) criado(s) com sucesso`;
    } else if (cardsAtualizados.length > 0) {
      mensagem = `${cardsAtualizados.length} card(s) atualizado(s) com sucesso (item adicionado ao card existente)`;
    } else {
      mensagem = 'Nenhum card foi processado';
    }

    const resposta = {
      mensagem,
      cards: cardsCriados,
      cardsAtualizados: cardsAtualizados,
      valorTotal,
      valorPorCliente,
      totalClientes: clientes.length,
      totalCardsCriados: cardsCriados.length,
      totalCardsAtualizados: cardsAtualizados.length,
    };

    console.log('✅ Cards gerados com sucesso:', resposta);
    const response = NextResponse.json(resposta, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao gerar cards do agendamento:', error);
    console.error('Stack trace:', error.stack);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao gerar cards do agendamento', 
        error: error.message,
        detail: error.detail || error.message,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

