import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { CriarHorarioAtendimentoPointPayload } from '@/types/agendamento';

function isInt(n: any): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

function validarCampos(diaSemana: number, inicioMin: number, fimMin: number): string | null {
  if (!isInt(diaSemana) || diaSemana < 0 || diaSemana > 6) return 'diaSemana inválido (0-6)';
  if (!isInt(inicioMin) || inicioMin < 0 || inicioMin >= 1440) return 'inicioMin inválido (0-1439)';
  if (!isInt(fimMin) || fimMin <= 0 || fimMin > 1440) return 'fimMin inválido (1-1440)';
  if (fimMin <= inicioMin) return 'fimMin deve ser maior que inicioMin';
  return null;
}

function temSobreposicao(intervalos: Array<{ inicioMin: number; fimMin: number }>, inicioMin: number, fimMin: number): boolean {
  return intervalos.some((i) => inicioMin < i.fimMin && fimMin > i.inicioMin);
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const pointIds = searchParams.get('pointIds');

    let sql = `SELECT id, "pointId", "diaSemana", "inicioMin", "fimMin", ativo, "createdAt", "updatedAt"
               FROM "HorarioAtendimentoPoint"
               WHERE 1=1`;
    const params: any[] = [];
    let p = 1;

    if (usuario.role === 'ORGANIZER') {
      if (!usuario.pointIdGestor) {
        return withCors(NextResponse.json({ mensagem: 'Arena não vinculada' }, { status: 400 }), request);
      }
      sql += ` AND "pointId" = $${p++}`;
      params.push(usuario.pointIdGestor);
    } else {
      if (pointId) {
        sql += ` AND "pointId" = $${p++}`;
        params.push(pointId);
      } else if (pointIds) {
        const ids = pointIds.split(',').map((s) => s.trim()).filter(Boolean);
        if (ids.length > 0) {
          sql += ` AND "pointId" = ANY($${p++})`;
          params.push(ids);
        }
      }
    }

    sql += ` ORDER BY "pointId" ASC, "diaSemana" ASC, "inicioMin" ASC`;

    const result = await query(sql, params);
    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar horários de atendimento', error: error.message }, { status: 500 }), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const body = (await request.json()) as CriarHorarioAtendimentoPointPayload;
    const { pointId, diaSemana, inicioMin, fimMin, ativo } = body;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const msg = validarCampos(diaSemana, inicioMin, fimMin);
    if (msg) {
      return withCors(NextResponse.json({ mensagem: msg }, { status: 400 }), request);
    }

    if (usuario.role === 'ORGANIZER') {
      if (usuario.pointIdGestor !== pointId) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    } else {
      const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!temAcesso) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    }

    const existentes = await query(
      `SELECT id, "inicioMin", "fimMin"
       FROM "HorarioAtendimentoPoint"
       WHERE "pointId" = $1 AND "diaSemana" = $2 AND ativo = true`,
      [pointId, diaSemana]
    );

    if (temSobreposicao(existentes.rows.map((r: any) => ({ inicioMin: Number(r.inicioMin), fimMin: Number(r.fimMin) })), inicioMin, fimMin)) {
      return withCors(NextResponse.json({ mensagem: 'Intervalo sobrepõe outro intervalo existente' }, { status: 400 }), request);
    }

    const result = await query(
      `INSERT INTO "HorarioAtendimentoPoint"
       ("pointId", "diaSemana", "inicioMin", "fimMin", ativo, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, "pointId", "diaSemana", "inicioMin", "fimMin", ativo, "createdAt", "updatedAt"`,
      [pointId, diaSemana, inicioMin, fimMin, ativo ?? true]
    );

    return withCors(NextResponse.json(result.rows[0], { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar horário de atendimento', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
