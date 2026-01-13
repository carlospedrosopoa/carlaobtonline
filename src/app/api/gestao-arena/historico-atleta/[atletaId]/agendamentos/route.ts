import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

async function atletaPertenceAoPoint(atletaId: string, pointId: string) {
  const sqlComAtletaPoint = `SELECT a.id
    FROM "Atleta" a
    LEFT JOIN "AtletaPoint" ap ON ap."atletaId" = a.id AND ap."pointId" = $2
    WHERE a.id = $1 AND (a."pointIdPrincipal" = $2 OR ap."pointId" IS NOT NULL)
    LIMIT 1`;
  const sqlSemAtletaPoint = `SELECT a.id
    FROM "Atleta" a
    WHERE a.id = $1 AND a."pointIdPrincipal" = $2
    LIMIT 1`;
  try {
    const r = await query(sqlComAtletaPoint, [atletaId, pointId]);
    return r.rows.length > 0;
  } catch (err: any) {
    if (err?.code === '42P01' || String(err?.message || '').includes('AtletaPoint')) {
      const r = await query(sqlSemAtletaPoint, [atletaId, pointId]);
      return r.rows.length > 0;
    }
    throw err;
  }
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ atletaId: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { atletaId } = await params;
    const { searchParams } = new URL(request.url);
    const pointIdParam = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    let pointId: string | null = null;
    if (usuario.role === 'ORGANIZER') {
      pointId = usuario.pointIdGestor || null;
    } else {
      pointId = pointIdParam || null;
    }
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }

    const ok = await atletaPertenceAoPoint(atletaId, pointId);
    if (!ok) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }

    const values: any[] = [pointId, atletaId];
    let where = 'WHERE q."pointId" = $1 AND (a."atletaId" = $2 OR EXISTS (SELECT 1 FROM "AgendamentoAtleta" aa WHERE aa."agendamentoId" = a.id AND aa."atletaId" = $2))';
    if (dataInicio) {
      where += ` AND a."dataHora" >= $${values.length + 1}`;
      values.push(dataInicio);
    }
    if (dataFim) {
      where += ` AND a."dataHora" <= $${values.length + 1}`;
      values.push(dataFim);
    }
    values.push(limit);
    values.push(offset);

    const sql = `SELECT
      a.id, a."dataHora", a.duracao, a.status, a.observacoes,
      a."valorCalculado", a."valorNegociado",
      q.id as "quadraId", q.nome as "quadraNome",
      u.id as "usuarioId", u.name as "usuarioNome", u.email as "usuarioEmail"
    FROM "Agendamento" a
    LEFT JOIN "Quadra" q ON a."quadraId" = q.id
    LEFT JOIN "User" u ON a."usuarioId" = u.id
    ${where}
    ORDER BY a."dataHora" DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const result = await query(sql, values);
    const agendamentos = result.rows.map((row: any) => ({
      id: row.id,
      dataHora: row.dataHora,
      duracao: row.duracao,
      status: row.status,
      observacoes: row.observacoes || null,
      valorCalculado: row.valorCalculado !== null && row.valorCalculado !== undefined ? parseFloat(row.valorCalculado) : null,
      valorNegociado: row.valorNegociado !== null && row.valorNegociado !== undefined ? parseFloat(row.valorNegociado) : null,
      quadra: row.quadraId ? { id: row.quadraId, nome: row.quadraNome } : null,
      usuario: row.usuarioId ? { id: row.usuarioId, name: row.usuarioNome, email: row.usuarioEmail } : null,
    }));

    return withCors(NextResponse.json(agendamentos), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}

