import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { CriarApoiadorPayload } from '@/types/apoiador';

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    // Admin or Organizer or maybe just Admin. User said "nivel de admin".
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const result = await query(
      `SELECT 
        a.*,
        COALESCE(
          array_agg(ra."regiaoId") FILTER (WHERE ra."regiaoId" IS NOT NULL),
          ARRAY[]::text[]
        ) AS "regiaoIds"
      FROM "Apoiador" a
      LEFT JOIN "RegiaoApoiador" ra ON ra."apoiadorId" = a.id
      GROUP BY a.id
      ORDER BY a.nome ASC`
    );

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar apoiadores', error: error.message }, { status: 500 }), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const body = (await request.json()) as CriarApoiadorPayload;
    if (!body?.nome?.trim()) {
      return withCors(NextResponse.json({ mensagem: 'nome é obrigatório' }, { status: 400 }), request);
    }

    const ativo = body.ativo ?? true;
    const exibirColorido = body.exibirColorido ?? true;

    const result = await query(
      `INSERT INTO "Apoiador" (nome, latitude, longitude, instagram, whatsapp, "logoUrl", ativo, "exibirColorido")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.nome.trim(),
        body.latitude || null,
        body.longitude || null,
        body.instagram?.trim() || null,
        body.whatsapp?.trim() || null,
        body.logoUrl?.trim() || null,
        ativo,
        exibirColorido
      ]
    );

    const apoiador = result.rows[0];
    const regiaoIds = Array.isArray(body.regiaoIds) ? body.regiaoIds.filter(Boolean) : [];

    if (regiaoIds.length > 0) {
      await query(
        `INSERT INTO "RegiaoApoiador" ("regiaoId", "apoiadorId")
         SELECT DISTINCT unnest($1::text[]), $2::uuid`,
        [regiaoIds, apoiador.id]
      );
    }

    return withCors(NextResponse.json({ ...apoiador, regiaoIds }, { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar apoiador', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
