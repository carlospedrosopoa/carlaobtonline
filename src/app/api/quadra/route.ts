// app/api/quadra/route.ts - Rotas de API para Quadras (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/quadra - Listar todas as quadras (com filtro opcional por pointId)
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

    let sql = `SELECT 
      q.id, q.nome, q."pointId", q.tipo, q.capacidade, q.ativo, 
      q."tiposEsporte", q."createdAt", q."updatedAt",
      p.id as "point_id", p.nome as "point_nome"
    FROM "Quadra" q
    LEFT JOIN "Point" p ON q."pointId" = p.id`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas quadras da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` WHERE q."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      // ADMIN pode filtrar por pointId se quiser
      sql += ` WHERE q."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    }

    sql += ` ORDER BY q.nome ASC`;

    const result = await query(sql, params);
    
    // Formatar resultado para incluir point como objeto
    const quadras = result.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      pointId: row.pointId,
      tipo: row.tipo,
      capacidade: row.capacidade,
      ativo: row.ativo,
      tiposEsporte: row.tiposEsporte ? (Array.isArray(row.tiposEsporte) ? row.tiposEsporte : JSON.parse(row.tiposEsporte)) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
    }));

    const response = NextResponse.json(quadras);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar quadras:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar quadras', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/quadra - Criar nova quadra
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

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem criar quadras' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { nome, pointId, tipo, capacidade, ativo = true, tiposEsporte } = body;

    if (!nome || !pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome e estabelecimento são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o point existe
    const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
    if (pointCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para criar quadras nesta arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    const tiposEsporteJson = tiposEsporte && Array.isArray(tiposEsporte) && tiposEsporte.length > 0 
      ? JSON.stringify(tiposEsporte) 
      : null;

    const result = await query(
      `INSERT INTO "Quadra" (id, nome, "pointId", tipo, capacidade, ativo, "tiposEsporte", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, nome, "pointId", tipo, capacidade, ativo, "tiposEsporte", "createdAt", "updatedAt"`,
      [nome, pointId, tipo || null, capacidade || null, ativo, tiposEsporteJson]
    );

    // Buscar point para incluir no retorno
    const pointResult = await query('SELECT id, nome FROM "Point" WHERE id = $1', [pointId]);
    const quadra = {
      ...result.rows[0],
      tiposEsporte: result.rows[0].tiposEsporte ? (Array.isArray(result.rows[0].tiposEsporte) ? result.rows[0].tiposEsporte : JSON.parse(result.rows[0].tiposEsporte)) : null,
      point: pointResult.rows[0] || null,
    };

    const response = NextResponse.json(quadra, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar quadra:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar quadra', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

