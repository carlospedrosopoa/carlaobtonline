// app/api/gestao-arena/entrada-caixa/route.ts - API de Entradas de Caixa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarEntradaCaixaPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/entrada-caixa - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/entrada-caixa - Listar entradas de caixa
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    let sql = `SELECT 
      e.id, e."pointId", e."aberturaCaixaId", e.valor, e.descricao, e."formaPagamentoId", e.observacoes,
      e."dataEntrada", e."createdAt", e."createdById", e."updatedById",
      fp.id as "formaPagamento_id", fp.nome as "formaPagamento_nome", fp.tipo as "formaPagamento_tipo",
      uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
      uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
    FROM "EntradaCaixa" e
    LEFT JOIN "FormaPagamento" fp ON e."formaPagamentoId" = fp.id
    LEFT JOIN "User" uc ON e."createdById" = uc.id
    LEFT JOIN "User" uu ON e."updatedById" = uu.id
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para listar entradas de caixa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
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
      aberturaCaixaId: row.aberturaCaixaId,
      valor: parseFloat(row.valor),
      descricao: row.descricao,
      formaPagamentoId: row.formaPagamentoId,
      observacoes: row.observacoes,
      dataEntrada: row.dataEntrada,
      createdAt: row.createdAt,
      createdById: row.createdById || null,
      createdBy: row.createdBy_user_id ? {
        id: row.createdBy_user_id,
        name: row.createdBy_user_name,
        email: row.createdBy_user_email,
      } : null,
      updatedById: row.updatedById || null,
      updatedBy: row.updatedBy_user_id ? {
        id: row.updatedBy_user_id,
        name: row.updatedBy_user_name,
        email: row.updatedBy_user_email,
      } : null,
      formaPagamento: row.formaPagamento_id ? {
        id: row.formaPagamento_id,
        nome: row.formaPagamento_nome,
        tipo: row.formaPagamento_tipo,
      } : null,
    }));

    const response = NextResponse.json(entradas);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar entradas de caixa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar entradas de caixa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/entrada-caixa - Criar entrada de caixa manual
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem criar entradas de caixa
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar entradas de caixa' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarEntradaCaixaPayload = await request.json();
    const { pointId, aberturaCaixaId, valor, descricao, formaPagamentoId, observacoes, dataEntrada } = body;

    if (!pointId || !valor || !descricao || !formaPagamentoId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PointId, valor, descricao e formaPagamentoId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar abertura de caixa (informada ou a aberta atual)
    let aberturaId = aberturaCaixaId;
    if (!aberturaId) {
      const aberturaAbertaResult = await query(
        'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2',
        [pointId, 'ABERTA']
      );

      if (aberturaAbertaResult.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Não há uma abertura de caixa aberta. Por favor, abra o caixa primeiro.' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      aberturaId = aberturaAbertaResult.rows[0].id;
    } else {
      // Verificar se a abertura informada existe e está aberta
      const aberturaResult = await query(
        'SELECT id, status, "pointId" FROM "AberturaCaixa" WHERE id = $1',
        [aberturaId]
      );

      if (aberturaResult.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Abertura de caixa não encontrada' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      if (aberturaResult.rows[0].status !== 'ABERTA') {
        const errorResponse = NextResponse.json(
          { mensagem: 'A abertura de caixa informada está fechada' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      if (aberturaResult.rows[0].pointId !== pointId) {
        const errorResponse = NextResponse.json(
          { mensagem: 'A abertura de caixa não pertence a esta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    if (valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Verificar se a forma de pagamento existe e está ativa
    const formaPagamentoResult = await query(
      'SELECT id, ativo FROM "FormaPagamento" WHERE id = $1',
      [formaPagamentoId]
    );

    if (formaPagamentoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Forma de pagamento não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (!formaPagamentoResult.rows[0].ativo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Forma de pagamento não está ativa' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Usar data informada ou data atual
    const dataEntradaFinal = dataEntrada || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO "EntradaCaixa" (
        id, "pointId", "aberturaCaixaId", valor, descricao, "formaPagamentoId", observacoes, "dataEntrada", "createdAt", "createdById"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), $8
      ) RETURNING *`,
      [pointId, aberturaId, valor, descricao, formaPagamentoId, observacoes || null, dataEntradaFinal, usuario.id]
    );

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar entrada de caixa:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar entrada de caixa', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

