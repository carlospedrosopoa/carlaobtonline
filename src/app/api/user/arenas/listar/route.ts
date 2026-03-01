// app/api/user/arenas/listar/route.ts - Listar arenas assinantes (para frontend externo)
// Esta é a nova rota organizada. A rota antiga /api/point/public ainda funciona para compatibilidade.
// Retorna apenas informações públicas de arenas assinantes e ativas, sem dados sensíveis
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

// GET /api/user/arenas/listar - Listar arenas assinantes ativas
// IMPORTANTE: Esta rota retorna apenas arenas que são assinantes (assinante = true) e estão ativas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const regiaoId = searchParams.get('regiaoId');

    // Retornar apenas campos públicos (sem tokens WhatsApp, etc)
    // Filtrar apenas arenas assinantes e ativas
    // Incluir horários de atendimento (agrupados por point)
    const whereRegiao = regiaoId
      ? ` AND EXISTS (
            SELECT 1
            FROM "RegiaoPoint" rp
            WHERE rp."pointId" = p.id
              AND rp."regiaoId" = $1
          )`
      : '';

    const values: any[] = [];
    if (regiaoId) values.push(regiaoId);

    const result = await query(
      `SELECT 
        p.id, p.nome, p.endereco, p.telefone, p.email, p.descricao, p."logoUrl", 
        p.latitude, p.longitude, p.ativo, p.assinante,
        COALESCE(
          json_agg(
            json_build_object(
              'diaSemana', h."diaSemana",
              'inicioMin', h."inicioMin",
              'fimMin', h."fimMin",
              'ativo', h.ativo
            ) ORDER BY h."diaSemana", h."inicioMin"
          ) FILTER (WHERE h.id IS NOT NULL),
          '[]'
        ) as "horariosAtendimento"
      FROM "Point" p
      LEFT JOIN "HorarioAtendimentoPoint" h ON p.id = h."pointId" AND h.ativo = true
      WHERE p.assinante = true AND p.ativo = true${whereRegiao}
      GROUP BY p.id
      ORDER BY p.nome ASC`,
      values
    );

    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar arenas:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar arenas', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

