// app/api/gestao-arena/saida-caixa/route.ts - API de Saídas de Caixa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarSaidaCaixaPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/saida-caixa - Listar saídas de caixa
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
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    let sql = `SELECT 
      s.id, s."pointId", s."aberturaCaixaId", s.valor, s.descricao, s."fornecedorId", s."categoriaSaidaId", s."tipoDespesaId", s."centroCustoId",
      s."formaPagamentoId", s.observacoes, s."dataSaida", s."createdAt", s."createdById", s."createdBy",
      fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
      f.id as "fornecedor_id", f.nome as "fornecedor_nome",
      cs.id as "categoriaSaida_id", cs.nome as "categoriaSaida_nome",
      td.id as "tipoDespesa_id", td.nome as "tipoDespesa_nome",
      cc.id as "centroCusto_id", cc.nome as "centroCusto_nome"
    FROM "SaidaCaixa" s
    LEFT JOIN "FormaPagamento" fp ON s."formaPagamentoId" = fp.id
    LEFT JOIN "Fornecedor" f ON s."fornecedorId" = f.id
    LEFT JOIN "CategoriaSaida" cs ON s."categoriaSaidaId" = cs.id
    LEFT JOIN "TipoDespesa" td ON s."tipoDespesaId" = td.id
    LEFT JOIN "CentroCusto" cc ON s."centroCustoId" = cc.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas saídas da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND s."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      sql += ` AND s."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar saídas de caixa' },
        { status: 403 }
      );
    }

    if (dataInicio) {
      sql += ` AND s."dataSaida" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    if (dataFim) {
      sql += ` AND s."dataSaida" <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    sql += ` ORDER BY s."dataSaida" DESC, s."createdAt" DESC`;

    const result = await query(sql, params);
    
    const saidas = result.rows.map((row: any) => ({
      id: row.id,
      pointId: row.pointId,
      valor: parseFloat(row.valor),
      descricao: row.descricao,
      fornecedorId: row.fornecedorId,
      categoriaSaidaId: row.categoriaSaidaId,
      tipoDespesaId: row.tipoDespesaId,
      centroCustoId: row.centroCustoId,
      formaPagamentoId: row.formaPagamentoId,
      observacoes: row.observacoes,
      dataSaida: row.dataSaida,
      createdAt: row.createdAt,
      createdById: row.createdById,
      createdBy: row.createdBy, // Mantido para compatibilidade
      formaPagamento: row.formaPagamento_id ? {
        id: row.formaPagamento_id,
        nome: row.formaPagamento_nome,
        tipo: row.formaPagamento_tipo,
      } : null,
      fornecedor: row.fornecedor_id ? {
        id: row.fornecedor_id,
        nome: row.fornecedor_nome,
      } : null,
      categoriaSaida: row.categoriaSaida_id ? {
        id: row.categoriaSaida_id,
        nome: row.categoriaSaida_nome,
      } : null,
      tipoDespesa: row.tipoDespesa_id ? {
        id: row.tipoDespesa_id,
        nome: row.tipoDespesa_nome,
      } : null,
      centroCusto: row.centroCusto_id ? {
        id: row.centroCusto_id,
        nome: row.centroCusto_nome,
      } : null,
    }));

    return NextResponse.json(saidas);
  } catch (error: any) {
    console.error('Erro ao listar saídas de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar saídas de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/saida-caixa - Criar saída de caixa manual
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem criar saídas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para criar saídas de caixa' },
        { status: 403 }
      );
    }

    const body: CriarSaidaCaixaPayload = await request.json();
    const { pointId, aberturaCaixaId, valor, descricao, fornecedorId, categoriaSaidaId, tipoDespesaId, centroCustoId, formaPagamentoId, observacoes, dataSaida } = body;
    
    // Normalizar valores vazios para null
    const categoriaSaidaIdNormalizado = categoriaSaidaId && 
      (typeof categoriaSaidaId === 'string' ? categoriaSaidaId.trim() !== '' : categoriaSaidaId) 
      ? categoriaSaidaId 
      : null;
    const tipoDespesaIdNormalizado = tipoDespesaId && 
      (typeof tipoDespesaId === 'string' ? tipoDespesaId.trim() !== '' : tipoDespesaId) 
      ? tipoDespesaId 
      : null;
    const fornecedorIdNormalizado = fornecedorId && 
      (typeof fornecedorId === 'string' ? fornecedorId.trim() !== '' : fornecedorId) 
      ? fornecedorId 
      : null;

    // Buscar abertura de caixa (informada ou a aberta atual)
    let aberturaId = aberturaCaixaId;
    if (!aberturaId) {
      const aberturaAbertaResult = await query(
        'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2',
        [pointId, 'ABERTA']
      );

      if (aberturaAbertaResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Não há uma abertura de caixa aberta. Por favor, abra o caixa primeiro.' },
          { status: 400 }
        );
      }

      aberturaId = aberturaAbertaResult.rows[0].id;
    } else {
      // Verificar se a abertura informada existe e está aberta
      const aberturaResult = await query(
        'SELECT id, status, "pointId" FROM "AberturaCaixa" WHERE id = $1',
        [aberturaId]
      );

      if (aberturaResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Abertura de caixa não encontrada' },
          { status: 404 }
        );
      }

      if (aberturaResult.rows[0].status !== 'ABERTA') {
        return NextResponse.json(
          { mensagem: 'A abertura de caixa informada está fechada' },
          { status: 400 }
        );
      }

      if (aberturaResult.rows[0].pointId !== pointId) {
        return NextResponse.json(
          { mensagem: 'A abertura de caixa não pertence a esta arena' },
          { status: 400 }
        );
      }
    }

    if (!pointId || !valor || !descricao || !centroCustoId || !formaPagamentoId) {
      return NextResponse.json(
        { mensagem: 'PointId, valor, descricao, centroCustoId e formaPagamentoId são obrigatórios' },
        { status: 400 }
      );
    }

    if (valor <= 0) {
      return NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
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

    // Verificar se a forma de pagamento existe e está ativa
    const formaPagamentoResult = await query(
      'SELECT id, ativo FROM "FormaPagamento" WHERE id = $1',
      [formaPagamentoId]
    );

    if (formaPagamentoResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
    }

    if (!formaPagamentoResult.rows[0].ativo) {
      return NextResponse.json(
        { mensagem: 'Forma de pagamento não está ativa' },
        { status: 400 }
      );
    }

    // Verificar se a categoria de saída existe e está ativa (se informada)
    // Se não informada, buscar ou criar uma categoria padrão
    let categoriaSaidaIdFinal = categoriaSaidaIdNormalizado;
    
    if (!categoriaSaidaIdFinal) {
      // Buscar categoria padrão "Geral" ou criar se não existir
      try {
        const categoriaPadraoResult = await query(
          'SELECT id FROM "CategoriaSaida" WHERE "pointId" = $1 AND nome = $2 LIMIT 1',
          [pointId, 'Geral']
        );
        
        if (categoriaPadraoResult.rows.length > 0) {
          categoriaSaidaIdFinal = categoriaPadraoResult.rows[0].id;
        } else {
          // Criar categoria padrão "Geral"
          const novaCategoriaResult = await query(
            `INSERT INTO "CategoriaSaida" (id, "pointId", nome, descricao, ativo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
             RETURNING id`,
            [pointId, 'Geral', 'Categoria padrão para saídas sem categoria específica']
          );
          categoriaSaidaIdFinal = novaCategoriaResult.rows[0].id;
        }
      } catch (error: any) {
        console.error('Erro ao buscar/criar categoria padrão:', error);
        return NextResponse.json(
          { mensagem: 'Erro ao processar categoria de saída. Por favor, selecione uma categoria ou crie uma categoria padrão no sistema.' },
          { status: 500 }
        );
      }
    } else {
      // Verificar se a categoria informada existe e está ativa
      const categoriaResult = await query(
        'SELECT id, ativo FROM "CategoriaSaida" WHERE id = $1',
        [categoriaSaidaIdFinal]
      );

      if (categoriaResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Categoria de saída não encontrada' },
          { status: 404 }
        );
      }

      if (!categoriaResult.rows[0].ativo) {
        return NextResponse.json(
          { mensagem: 'Categoria de saída não está ativa' },
          { status: 400 }
        );
      }
    }

    // Verificar se o centro de custo existe e está ativo
    const centroCustoResult = await query(
      'SELECT id, ativo FROM "CentroCusto" WHERE id = $1',
      [centroCustoId]
    );

    if (centroCustoResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Centro de custo não encontrado' },
        { status: 404 }
      );
    }

    if (!centroCustoResult.rows[0].ativo) {
      return NextResponse.json(
        { mensagem: 'Centro de custo não está ativo' },
        { status: 400 }
      );
    }

    // Se fornecedor foi informado, verificar se existe
    if (fornecedorIdNormalizado) {
      const fornecedorResult = await query(
        'SELECT id, ativo FROM "Fornecedor" WHERE id = $1',
        [fornecedorIdNormalizado]
      );

      if (fornecedorResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Fornecedor não encontrado' },
          { status: 404 }
        );
      }

      if (!fornecedorResult.rows[0].ativo) {
        return NextResponse.json(
          { mensagem: 'Fornecedor não está ativo' },
          { status: 400 }
        );
      }
    }

    // Usar data informada ou data atual
    const dataSaidaFinal = dataSaida || new Date().toISOString().split('T')[0];

    // Verificar se tipo de despesa existe (se informado)
    if (tipoDespesaIdNormalizado) {
      const tipoDespesaResult = await query(
        'SELECT id, ativo FROM "TipoDespesa" WHERE id = $1',
        [tipoDespesaIdNormalizado]
      );

      if (tipoDespesaResult.rows.length === 0) {
        return NextResponse.json(
          { mensagem: 'Tipo de despesa não encontrado' },
          { status: 404 }
        );
      }

      if (!tipoDespesaResult.rows[0].ativo) {
        return NextResponse.json(
          { mensagem: 'Tipo de despesa não está ativo' },
          { status: 400 }
        );
      }
    }

    const result = await query(
      `INSERT INTO "SaidaCaixa" (
        id, "pointId", "aberturaCaixaId", valor, descricao, "fornecedorId", "categoriaSaidaId", "tipoDespesaId", "centroCustoId",
        "formaPagamentoId", observacoes, "dataSaida", "createdAt", "createdById"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12
      ) RETURNING *`,
      [
        pointId, 
        aberturaId,
        valor, 
        descricao, 
        fornecedorIdNormalizado, 
        categoriaSaidaIdFinal, 
        tipoDespesaIdNormalizado, 
        centroCustoId, 
        formaPagamentoId, 
        observacoes || null, 
        dataSaidaFinal, 
        usuario.id
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar saída de caixa:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });
    return NextResponse.json(
      { 
        mensagem: 'Erro ao criar saída de caixa', 
        error: error.message,
        detail: error.detail || error.message,
        constraint: error.constraint,
      },
      { status: 500 }
    );
  }
}

