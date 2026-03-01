import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { AtualizarApoiadorPayload } from '@/types/apoiador';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const result = await query(
      `SELECT 
        a.*,
        COALESCE(
          array_agg(ra."regiaoId") FILTER (WHERE ra."regiaoId" IS NOT NULL),
          ARRAY[]::text[]
        ) AS "regiaoIds"
      FROM "Apoiador" a
      LEFT JOIN "RegiaoApoiador" ra ON ra."apoiadorId" = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Apoiador não encontrado' }, { status: 404 }), request);
    }

    return withCors(NextResponse.json(result.rows[0]), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao obter apoiador', error: error.message }, { status: 500 }), request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const body = (await request.json()) as AtualizarApoiadorPayload;
    const regiaoIds = body.regiaoIds;

    // Construir query dinâmica
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.nome !== undefined) {
      fields.push(`nome = $${idx++}`);
      values.push(body.nome.trim());
    }
    if (body.latitude !== undefined) {
      fields.push(`latitude = $${idx++}`);
      values.push(body.latitude);
    }
    if (body.longitude !== undefined) {
      fields.push(`longitude = $${idx++}`);
      values.push(body.longitude);
    }
    if (body.instagram !== undefined) {
      fields.push(`instagram = $${idx++}`);
      values.push(body.instagram?.trim() || null);
    }
    if (body.whatsapp !== undefined) {
      fields.push(`whatsapp = $${idx++}`);
      values.push(body.whatsapp?.trim() || null);
    }
    if (body.logoUrl !== undefined) {
      fields.push(`"logoUrl" = $${idx++}`);
      values.push(body.logoUrl?.trim() || null);
    }
    if (body.exibirColorido !== undefined) {
      fields.push(`"exibirColorido" = $${idx++}`);
      values.push(body.exibirColorido);
    }
    if (body.ativo !== undefined) {
      fields.push(`ativo = $${idx++}`);
      values.push(body.ativo);
    }

    const temCampos = fields.length > 0;
    const temRegioes = regiaoIds !== undefined;

    if (!temCampos && !temRegioes) {
      return withCors(NextResponse.json({ mensagem: 'Nada para atualizar' }, { status: 400 }), request);
    }

    if (temCampos) {
      fields.push(`"updatedAt" = NOW()`);
      values.push(id);

      const resultUpdate = await query(
        `UPDATE "Apoiador" SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
        values
      );

      if (resultUpdate.rows.length === 0) {
        return withCors(NextResponse.json({ mensagem: 'Apoiador não encontrado' }, { status: 404 }), request);
      }
    } else {
      const touch = await query(`UPDATE "Apoiador" SET "updatedAt" = NOW() WHERE id = $1 RETURNING id`, [id]);
      if (touch.rows.length === 0) {
        return withCors(NextResponse.json({ mensagem: 'Apoiador não encontrado' }, { status: 404 }), request);
      }
    }

    if (temRegioes) {
      const lista = Array.isArray(regiaoIds) ? regiaoIds.filter(Boolean) : [];
      await query(`DELETE FROM "RegiaoApoiador" WHERE "apoiadorId" = $1::uuid`, [id]);
      if (lista.length > 0) {
        await query(
          `INSERT INTO "RegiaoApoiador" ("regiaoId", "apoiadorId")
           SELECT DISTINCT unnest($1::text[]), $2::uuid`,
          [lista, id]
        );
      }
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
      WHERE a.id = $1
      GROUP BY a.id`,
      [id]
    );

    return withCors(NextResponse.json(result.rows[0]), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao atualizar apoiador', error: error.message }, { status: 500 }), request);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const result = await query(`DELETE FROM "Apoiador" WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Apoiador não encontrado' }, { status: 404 }), request);
    }

    return withCors(NextResponse.json({ ok: true }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao excluir apoiador', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
