import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseTipo(value: unknown) {
  const tipo = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const permitidos = ['CONTA_CORRENTE', 'CONTA_POUPANCA', 'CARTEIRA', 'OUTRO'];
  return permitidos.includes(tipo) ? tipo : 'CONTA_CORRENTE';
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
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
    const pointIdParam = searchParams.get('pointId');
    const apenasAtivas = searchParams.get('apenasAtivas') === 'true';

    let pointId: string | null = pointIdParam;
    if (usuario.role === 'ORGANIZER') {
      if (!pointId) {
        pointId = usuario.pointIdGestor || null;
      }
      if (pointId && !usuarioTemAcessoAoPoint(usuario, pointId)) {
        return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
      }
    }
    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    let result;
    try {
      result = await query(
        `
        SELECT
          cb.*,
          (
            cb."saldoInicial" + COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.valor ELSE -m.valor END), 0)
          )::numeric(14,2) AS "saldoAtual"
        FROM "ContaBancaria" cb
        LEFT JOIN "MovimentacaoContaBancaria" m ON m."contaBancariaId" = cb.id
        WHERE cb."pointId" = $1
          AND ($2::boolean = false OR cb.ativo = true)
        GROUP BY cb.id
        ORDER BY cb.nome ASC
        `,
        [pointId, apenasAtivas]
      );
    } catch (error: any) {
      if (error?.code !== '42P01') {
        throw error;
      }
      result = await query(
        `
        SELECT
          cb.*,
          cb."saldoInicial"::numeric(14,2) AS "saldoAtual"
        FROM "ContaBancaria" cb
        WHERE cb."pointId" = $1
          AND ($2::boolean = false OR cb.ativo = true)
        ORDER BY cb.nome ASC
        `,
        [pointId, apenasAtivas]
      );
    }

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    if (error?.code === '42P01') {
      return withCors(NextResponse.json([]), request);
    }
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar contas bancárias', error: error.message }, { status: 500 }), request);
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

    const body = await request.json();
    const pointId = typeof body?.pointId === 'string' ? body.pointId.trim() : '';
    const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
    const banco = typeof body?.banco === 'string' ? body.banco.trim() : '';
    const agencia = typeof body?.agencia === 'string' ? body.agencia.trim() : '';
    const conta = typeof body?.conta === 'string' ? body.conta.trim() : '';
    const tipo = parseTipo(body?.tipo);
    const saldoInicial = typeof body?.saldoInicial === 'number' ? body.saldoInicial : Number(body?.saldoInicial || 0);
    const ativo = body?.ativo !== false;

    if (!pointId || !nome) {
      return withCors(NextResponse.json({ mensagem: 'pointId e nome são obrigatórios' }, { status: 400 }), request);
    }
    if (!Number.isFinite(saldoInicial)) {
      return withCors(NextResponse.json({ mensagem: 'saldoInicial inválido' }, { status: 400 }), request);
    }
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    const result = await query(
      `
      INSERT INTO "ContaBancaria" (
        id, "pointId", nome, banco, agencia, conta, tipo, "saldoInicial", ativo, "createdAt", "updatedAt", "createdById", "updatedById"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9, $9
      ) RETURNING *
      `,
      [pointId, nome, banco || null, agencia || null, conta || null, tipo, saldoInicial, ativo, usuario.id]
    );

    return withCors(NextResponse.json(result.rows[0], { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar conta bancária', error: error.message }, { status: 500 }), request);
  }
}
