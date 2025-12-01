// app/api/gestao-arena/entrada-caixa/route.ts - API de Entradas de Caixa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarEntradaCaixaPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/entrada-caixa - Listar entradas de caixa
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
      e.id, e."pointId", e.valor, e.descricao, e."formaPagamentoId", e.observacoes,
      e."dataEntrada", e."createdAt", e."createdBy",
      fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo"
    FROM "EntradaCaixa" e
    LEFT JOIN "FormaPagamento" fp ON e."formaPagamentoId" = fp.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas entradas da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND e."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      sql += ` AND e."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar entradas de caixa' },
        { status: 403 }
      );
    }

    if (dataInicio) {
      sql += ` AND e."dataEntrada" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    if (dataFim) {
      sql += ` AND e."dataEntrada" <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    sql += ` ORDER BY e."dataEntrada" DESC, e."createdAt" DESC`;

    const result = await query(sql, params);
    
    const entradas = result.rows.map((row: any) => ({
      id: row.id,
      pointId: row.pointId,
      valor: parseFloat(row.valor),
      descricao: row.descricao,
      formaPagamentoId: row.formaPagamentoId,
      observacoes: row.observacoes,
      dataEntrada: row.dataEntrada,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      formaPagamento: row.formaPagamento_id ? {
        id: row.formaPagamento_id,
        nome: row.formaPagamento_nome,
        tipo: row.formaPagamento_tipo,
      } : null,
    }));

    return NextResponse.json(entradas);
  } catch (error: any) {
    console.error('Erro ao listar entradas de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar entradas de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/entrada-caixa - Criar entrada de caixa manual
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem criar entradas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para criar entradas de caixa' },
        { status: 403 }
      );
    }

    const body: CriarEntradaCaixaPayload = await request.json();
    const { pointId, valor, descricao, formaPagamentoId, observacoes, dataEntrada } = body;

    if (!pointId || !valor || !descricao || !formaPagamentoId) {
      return NextResponse.json(
        { mensagem: 'PointId, valor, descricao e formaPagamentoId são obrigatórios' },
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

    // Usar data informada ou data atual
    const dataEntradaFinal = dataEntrada || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO "EntradaCaixa" (
        id, "pointId", valor, descricao, "formaPagamentoId", observacoes, "dataEntrada", "createdAt", "createdBy"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), $7
      ) RETURNING *`,
      [pointId, valor, descricao, formaPagamentoId, observacoes || null, dataEntradaFinal, usuario.id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar entrada de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar entrada de caixa', error: error.message },
      { status: 500 }
    );
  }
}

