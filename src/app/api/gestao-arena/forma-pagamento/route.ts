// app/api/gestao-arena/forma-pagamento/route.ts - API de Formas de Pagamento
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import type { CriarFormaPagamentoPayload, AtualizarFormaPagamentoPayload } from '@/types/gestaoArena';

// OPTIONS /api/gestao-arena/forma-pagamento - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/forma-pagamento - Listar formas de pagamento
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
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true';

    let sql = `SELECT 
      fp.id, fp."pointId", fp.nome, fp.descricao, fp.tipo,
      fp."origemFinanceiraPadrao", fp."contaBancariaIdPadrao",
      cb.nome AS "contaBancariaNomePadrao",
      fp.ativo, fp."createdAt", fp."updatedAt"
    FROM "FormaPagamento" fp
    LEFT JOIN "ContaBancaria" cb ON cb.id = fp."contaBancariaIdPadrao"
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas formas de pagamento da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND fp."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      // ADMIN pode filtrar por pointId se quiser
      sql += ` AND fp."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    } else if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para listar formas de pagamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    if (apenasAtivos) {
      sql += ` AND fp.ativo = true`;
    }

    sql += ` ORDER BY nome ASC`;

    const result = await query(sql, params);
    
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar formas de pagamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar formas de pagamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/forma-pagamento - Criar forma de pagamento
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

    // Apenas ADMIN e ORGANIZER podem criar formas de pagamento
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar formas de pagamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarFormaPagamentoPayload = await request.json();
    const { pointId, nome, descricao, tipo, origemFinanceiraPadrao = 'CAIXA', contaBancariaIdPadrao, ativo = true } = body;

    if (!pointId || !nome || !tipo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'PointId, nome e tipo são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const origemFinanceira = origemFinanceiraPadrao === 'CONTA_BANCARIA' ? 'CONTA_BANCARIA' : 'CAIXA';
    let contaBancariaId: string | null = null;

    if (origemFinanceira === 'CONTA_BANCARIA') {
      if (!contaBancariaIdPadrao) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Selecione a conta bancária padrão para esta forma de pagamento' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      const contaBancariaResult = await query(
        `SELECT id, ativo, "pointId" FROM "ContaBancaria" WHERE id = $1`,
        [contaBancariaIdPadrao]
      );
      if (contaBancariaResult.rows.length === 0 || !contaBancariaResult.rows[0].ativo || contaBancariaResult.rows[0].pointId !== pointId) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Conta bancária padrão inválida para esta arena' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      contaBancariaId = contaBancariaIdPadrao;
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

    // Verificar se já existe forma de pagamento com mesmo nome nesta arena
    const existe = await query(
      'SELECT id FROM "FormaPagamento" WHERE "pointId" = $1 AND nome = $2',
      [pointId, nome]
    );

    if (existe.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe uma forma de pagamento com este nome nesta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "FormaPagamento" (
        id, "pointId", nome, descricao, tipo, "origemFinanceiraPadrao", "contaBancariaIdPadrao", ativo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      ) RETURNING *`,
      [pointId, nome, descricao || null, tipo, origemFinanceira, contaBancariaId, ativo]
    );

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar forma de pagamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar forma de pagamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

