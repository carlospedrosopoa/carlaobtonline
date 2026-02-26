import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { AtualizarHorarioAtendimentoPointPayload } from '@/types/agendamento';

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const atual = await query(
      `SELECT id, "pointId", "diaSemana", "inicioMin", "fimMin", ativo
       FROM "HorarioAtendimentoPoint"
       WHERE id = $1`,
      [id]
    );

    if (atual.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Registro não encontrado' }, { status: 404 }), request);
    }

    const row = atual.rows[0];
    const pointId = row.pointId as string;

    if (usuario.role === 'ORGANIZER') {
      if (!usuario.pointIdGestor || usuario.pointIdGestor !== pointId) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    } else {
      const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!temAcesso) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    }

    const body = (await request.json()) as AtualizarHorarioAtendimentoPointPayload;
    const diaSemanaFinal = body.diaSemana ?? Number(row.diaSemana);
    const inicioMinFinal = body.inicioMin ?? Number(row.inicioMin);
    const fimMinFinal = body.fimMin ?? Number(row.fimMin);

    const msg = validarCampos(diaSemanaFinal, inicioMinFinal, fimMinFinal);
    if (msg) {
      return withCors(NextResponse.json({ mensagem: msg }, { status: 400 }), request);
    }

    const existentes = await query(
      `SELECT id, "inicioMin", "fimMin"
       FROM "HorarioAtendimentoPoint"
       WHERE "pointId" = $1 AND "diaSemana" = $2 AND ativo = true AND id != $3`,
      [pointId, diaSemanaFinal, id]
    );

    if (temSobreposicao(existentes.rows.map((r: any) => ({ inicioMin: Number(r.inicioMin), fimMin: Number(r.fimMin) })), inicioMinFinal, fimMinFinal)) {
      return withCors(NextResponse.json({ mensagem: 'Intervalo sobrepõe outro intervalo existente' }, { status: 400 }), request);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (body.diaSemana !== undefined) {
      updates.push(`"diaSemana" = $${p++}`);
      values.push(body.diaSemana);
    }
    if (body.inicioMin !== undefined) {
      updates.push(`"inicioMin" = $${p++}`);
      values.push(body.inicioMin);
    }
    if (body.fimMin !== undefined) {
      updates.push(`"fimMin" = $${p++}`);
      values.push(body.fimMin);
    }
    if (body.ativo !== undefined) {
      updates.push(`ativo = $${p++}`);
      values.push(body.ativo);
    }

    updates.push(`"updatedAt" = NOW()`);

    if (updates.length === 0) {
      return withCors(NextResponse.json(row), request);
    }

    values.push(id);
    const result = await query(
      `UPDATE "HorarioAtendimentoPoint"
       SET ${updates.join(', ')}
       WHERE id = $${p}
       RETURNING id, "pointId", "diaSemana", "inicioMin", "fimMin", ativo, "createdAt", "updatedAt"`,
      values
    );

    return withCors(NextResponse.json(result.rows[0]), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao atualizar horário de atendimento', error: error.message }, { status: 500 }), request);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const atual = await query(`SELECT id, "pointId" FROM "HorarioAtendimentoPoint" WHERE id = $1`, [id]);
    if (atual.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Registro não encontrado' }, { status: 404 }), request);
    }

    const pointId = atual.rows[0].pointId as string;
    if (usuario.role === 'ORGANIZER') {
      if (!usuario.pointIdGestor || usuario.pointIdGestor !== pointId) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    } else {
      const temAcesso = usuarioTemAcessoAoPoint(usuario, pointId);
      if (!temAcesso) {
        return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
      }
    }

    await query(`DELETE FROM "HorarioAtendimentoPoint" WHERE id = $1`, [id]);
    return withCors(new NextResponse(null, { status: 204 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao deletar horário de atendimento', error: error.message }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
