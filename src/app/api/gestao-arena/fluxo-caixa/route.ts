// app/api/gestao-arena/fluxo-caixa/route.ts - API Unificada de Fluxo de Caixa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// Helper para normalizar data (DATE do PostgreSQL para string YYYY-MM-DD)
function normalizarData(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') {
    // Se já é string no formato YYYY-MM-DD, retornar como está
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return data;
    }
    // Se é ISO string, extrair apenas a data
    if (data.includes('T')) {
      return data.split('T')[0];
    }
    return data;
  }
  // Se é Date object, converter para YYYY-MM-DD
  if (data instanceof Date) {
    return data.toISOString().split('T')[0];
  }
  return String(data);
}

// GET /api/gestao-arena/fluxo-caixa - Listar fluxo de caixa unificado (entradas + saídas + pagamentos de cards)
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
    const aberturaCaixaId = searchParams.get('aberturaCaixaId'); // Filtrar por abertura específica
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipo = searchParams.get('tipo'); // 'ENTRADA' | 'SAIDA' | 'TODOS'

    let pointIdFiltro = pointId;
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      pointIdFiltro = usuario.pointIdGestor;
    } else if (usuario.role !== 'ADMIN' && !pointId) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar fluxo de caixa' },
        { status: 403 }
      );
    }

    const lancamentos: any[] = [];

    // Buscar entradas de caixa manuais
    if (!tipo || tipo === 'ENTRADA' || tipo === 'TODOS') {
      let sqlEntradas = `SELECT 
        e.id, e."pointId", e.valor, e.descricao, e."formaPagamentoId", e.observacoes,
        e."dataEntrada" as data, e."createdAt", e."createdBy",
        'ENTRADA_MANUAL' as tipo,
        fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo"
      FROM "EntradaCaixa" e
      LEFT JOIN "FormaPagamento" fp ON e."formaPagamentoId" = fp.id
      WHERE 1=1`;

      const paramsEntradas: any[] = [];
      let paramCount = 1;

      if (pointIdFiltro) {
        sqlEntradas += ` AND e."pointId" = $${paramCount}`;
        paramsEntradas.push(pointIdFiltro);
        paramCount++;
      }

      if (aberturaCaixaId) {
        sqlEntradas += ` AND e."aberturaCaixaId" = $${paramCount}`;
        paramsEntradas.push(aberturaCaixaId);
        paramCount++;
      }

      if (dataInicio) {
        sqlEntradas += ` AND e."dataEntrada" >= $${paramCount}`;
        paramsEntradas.push(dataInicio);
        paramCount++;
      }

      if (dataFim) {
        sqlEntradas += ` AND e."dataEntrada" <= $${paramCount}`;
        paramsEntradas.push(dataFim);
        paramCount++;
      }

      sqlEntradas += ` ORDER BY e."dataEntrada" DESC, e."createdAt" DESC`;

      const resultEntradas = await query(sqlEntradas, paramsEntradas);
      
      lancamentos.push(...resultEntradas.rows.map((row: any) => ({
        id: row.id,
        tipo: 'ENTRADA_MANUAL',
        pointId: row.pointId,
        valor: parseFloat(row.valor),
        descricao: row.descricao,
        observacoes: row.observacoes,
        data: normalizarData(row.data),
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        formaPagamento: row.formaPagamento_id ? {
          id: row.formaPagamento_id,
          nome: row.formaPagamento_nome,
          tipo: row.formaPagamento_tipo,
        } : null,
      })));
    }

    // Buscar pagamentos de cards (entradas automáticas)
    if (!tipo || tipo === 'ENTRADA' || tipo === 'TODOS') {
      let sqlPagamentos = `SELECT 
        p.id, c."pointId", p.valor, 
        CONCAT('Pagamento Card #', c."numeroCard") as descricao,
        p."formaPagamentoId", p.observacoes,
        p."createdAt"::date as data, p."createdAt", p."createdBy",
        'ENTRADA_CARD' as tipo,
        c.id as "cardId", c."numeroCard",
        p."aberturaCaixaId",
        fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo"
      FROM "PagamentoCard" p
      INNER JOIN "CardCliente" c ON p."cardId" = c.id
      LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
      WHERE c.status != 'CANCELADO'`;

      const paramsPagamentos: any[] = [];
      let paramCount = 1;

      if (pointIdFiltro) {
        sqlPagamentos += ` AND c."pointId" = $${paramCount}`;
        paramsPagamentos.push(pointIdFiltro);
        paramCount++;
      }

      if (aberturaCaixaId) {
        sqlPagamentos += ` AND p."aberturaCaixaId" = $${paramCount}`;
        paramsPagamentos.push(aberturaCaixaId);
        paramCount++;
      }

      if (dataInicio) {
        sqlPagamentos += ` AND p."createdAt"::date >= $${paramCount}`;
        paramsPagamentos.push(dataInicio);
        paramCount++;
      }

      if (dataFim) {
        sqlPagamentos += ` AND p."createdAt"::date <= $${paramCount}`;
        paramsPagamentos.push(dataFim);
        paramCount++;
      }

      sqlPagamentos += ` ORDER BY p."createdAt"::date DESC, p."createdAt" DESC`;

      const resultPagamentos = await query(sqlPagamentos, paramsPagamentos);
      
      lancamentos.push(...resultPagamentos.rows.map((row: any) => ({
        id: row.id,
        tipo: 'ENTRADA_CARD',
        pointId: row.pointId,
        valor: parseFloat(row.valor),
        descricao: row.descricao,
        observacoes: row.observacoes,
        data: normalizarData(row.data),
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        cardId: row.cardId,
        numeroCard: row.numeroCard,
        formaPagamento: row.formaPagamento_id ? {
          id: row.formaPagamento_id,
          nome: row.formaPagamento_nome,
          tipo: row.formaPagamento_tipo,
        } : null,
      })));
    }

    // Buscar saídas de caixa
    if (!tipo || tipo === 'SAIDA' || tipo === 'TODOS') {
      let sqlSaidas = `SELECT 
        s.id, s."pointId", s.valor, s.descricao, s."fornecedorId", s."categoriaSaidaId", s."tipoDespesaId", s."centroCustoId",
        s."formaPagamentoId", s.observacoes, s."dataSaida" as data, s."createdAt", s."createdBy",
        'SAIDA' as tipo,
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

      const paramsSaidas: any[] = [];
      let paramCount = 1;

      if (pointIdFiltro) {
        sqlSaidas += ` AND s."pointId" = $${paramCount}`;
        paramsSaidas.push(pointIdFiltro);
        paramCount++;
      }

      if (aberturaCaixaId) {
        sqlSaidas += ` AND s."aberturaCaixaId" = $${paramCount}`;
        paramsSaidas.push(aberturaCaixaId);
        paramCount++;
      }

      if (dataInicio) {
        sqlSaidas += ` AND s."dataSaida" >= $${paramCount}`;
        paramsSaidas.push(dataInicio);
        paramCount++;
      }

      if (dataFim) {
        sqlSaidas += ` AND s."dataSaida" <= $${paramCount}`;
        paramsSaidas.push(dataFim);
        paramCount++;
      }

      sqlSaidas += ` ORDER BY s."dataSaida" DESC, s."createdAt" DESC`;

      const resultSaidas = await query(sqlSaidas, paramsSaidas);
      
      lancamentos.push(...resultSaidas.rows.map((row: any) => ({
        id: row.id,
        tipo: 'SAIDA',
        pointId: row.pointId,
        valor: parseFloat(row.valor),
        descricao: row.descricao,
        observacoes: row.observacoes,
        data: normalizarData(row.data),
        createdAt: row.createdAt,
        createdBy: row.createdBy,
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
        formaPagamento: row.formaPagamento_id ? {
          id: row.formaPagamento_id,
          nome: row.formaPagamento_nome,
          tipo: row.formaPagamento_tipo,
        } : null,
      })));
    }

    // Ordenar todos os lançamentos por data (mais recente primeiro)
    lancamentos.sort((a, b) => {
      const dataA = new Date(a.data).getTime();
      const dataB = new Date(b.data).getTime();
      if (dataA !== dataB) {
        return dataB - dataA; // Mais recente primeiro
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(lancamentos);
  } catch (error: any) {
    console.error('Erro ao listar fluxo de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar fluxo de caixa', error: error.message },
      { status: 500 }
    );
  }
}

