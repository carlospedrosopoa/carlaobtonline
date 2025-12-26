// app/api/competicao/me/route.ts - Listar competições do atleta logado
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/competicao/me - Listar competições do atleta logado
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

    // Buscar atletaId do usuário
    const atletaResult = await query(
      `SELECT id FROM "Atleta" WHERE "usuarioId" = $1 LIMIT 1`,
      [usuario.id]
    );

    if (atletaResult.rows.length === 0) {
      // Usuário não é atleta, retornar vazio
      const response = NextResponse.json([]);
      return withCors(response, request);
    }

    const atletaId = atletaResult.rows[0].id;

    // Buscar competições que o atleta está participando
    const result = await query(
      `SELECT DISTINCT
        c.id, c."pointId", c."quadraId", c.nome, c.tipo, c.formato, c.status,
        c."dataInicio", c."dataFim", c.descricao, c."valorInscricao", c.premio, 
        c.regras, c."configSuper8", c."createdAt", c."updatedAt",
        p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
        q.id as "quadra_id", q.nome as "quadra_nome",
        ac."parceriaId", ac."parceiroAtletaId",
        p_atleta.id as "parceiro_id", p_atleta.nome as "parceiro_nome"
      FROM "Competicao" c
      INNER JOIN "AtletaCompeticao" ac ON c.id = ac."competicaoId"
      LEFT JOIN "Point" p ON c."pointId" = p.id
      LEFT JOIN "Quadra" q ON c."quadraId" = q.id
      LEFT JOIN "Atleta" p_atleta ON ac."parceiroAtletaId" = p_atleta.id
      WHERE ac."atletaId" = $1
      ORDER BY c."createdAt" DESC`,
      [atletaId]
    );

    const competicoes = result.rows.map((row) => ({
      id: row.id,
      pointId: row.pointId,
      quadraId: row.quadraId || null,
      nome: row.nome,
      tipo: row.tipo,
      formato: row.formato,
      status: row.status,
      dataInicio: row.dataInicio ? new Date(row.dataInicio).toISOString() : null,
      dataFim: row.dataFim ? new Date(row.dataFim).toISOString() : null,
      descricao: row.descricao || null,
      valorInscricao: row.valorInscricao ? parseFloat(row.valorInscricao) : null,
      premio: row.premio || null,
      regras: row.regras || null,
      configSuper8: row.configSuper8 || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
        logoUrl: row.point_logoUrl || null,
      } : null,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
      } : null,
      // Informações da participação do atleta
      parceriaId: row.parceriaId || null,
      parceiro: row.parceiro_id ? {
        id: row.parceiro_id,
        nome: row.parceiro_nome,
      } : null,
    }));

    const response = NextResponse.json(competicoes);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar competições do atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar competições', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

