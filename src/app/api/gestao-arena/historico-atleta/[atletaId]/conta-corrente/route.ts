import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

async function obterAtletaDaArena(atletaId: string, pointId: string) {
  const sqlComAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId"
    FROM "Atleta" a
    LEFT JOIN "AtletaPoint" ap ON ap."atletaId" = a.id AND ap."pointId" = $2
    WHERE a.id = $1 AND (a."pointIdPrincipal" = $2 OR ap."pointId" IS NOT NULL)
    LIMIT 1`;
  const sqlSemAtletaPoint = `SELECT a.id, a.nome, a.fone, a."usuarioId"
    FROM "Atleta" a
    WHERE a.id = $1 AND a."pointIdPrincipal" = $2
    LIMIT 1`;
  try {
    const r = await query(sqlComAtletaPoint, [atletaId, pointId]);
    return r.rows[0] || null;
  } catch (err: any) {
    if (err?.code === '42P01' || String(err?.message || '').includes('AtletaPoint')) {
      const r = await query(sqlSemAtletaPoint, [atletaId, pointId]);
      return r.rows[0] || null;
    }
    throw err;
  }
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function POST(
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
    const body = await request.json();
    const { pointId, tipo, valor, justificativa } = body;

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso ao point' }, { status: 403 }), request);
    }
    if (!tipo || (tipo !== 'CREDITO' && tipo !== 'DEBITO')) {
      return withCors(NextResponse.json({ mensagem: 'Tipo deve ser CREDITO ou DEBITO' }, { status: 400 }), request);
    }
    if (!valor || typeof valor !== 'number' || valor <= 0) {
      return withCors(NextResponse.json({ mensagem: 'Valor deve ser positivo' }, { status: 400 }), request);
    }
    if (!justificativa) {
      return withCors(NextResponse.json({ mensagem: 'Justificativa é obrigatória' }, { status: 400 }), request);
    }

    const atleta = await obterAtletaDaArena(atletaId, pointId);
    if (!atleta) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }
    if (!atleta.usuarioId) {
      return withCors(NextResponse.json({ mensagem: 'Atleta sem usuário vinculado' }, { status: 400 }), request);
    }

    // Buscar ou criar conta corrente
    let contaResult = await query(
      'SELECT id, saldo FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2 LIMIT 1',
      [atleta.usuarioId, pointId]
    );

    let contaCorrenteId;
    let saldoAtual = 0;

    if (contaResult.rows.length === 0) {
      // Criar conta corrente
      const novaConta = await query(
        'INSERT INTO "ContaCorrenteCliente" ("id", "usuarioId", "pointId", "saldo", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 0, NOW(), NOW()) RETURNING id, saldo',
        [atleta.usuarioId, pointId]
      );
      contaCorrenteId = novaConta.rows[0].id;
      saldoAtual = 0;
    } else {
      contaCorrenteId = contaResult.rows[0].id;
      saldoAtual = parseFloat(contaResult.rows[0].saldo);
    }

    // Calcular novo saldo
    const novoSaldo = tipo === 'CREDITO' ? saldoAtual + valor : saldoAtual - valor;

    // Registrar movimentação e atualizar saldo em transação
    await query('BEGIN');
    try {
      await query(
        'INSERT INTO "MovimentacaoContaCorrente" ("id", "contaCorrenteId", "tipo", "valor", "justificativa", "createdById", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())',
        [contaCorrenteId, tipo, valor, justificativa, usuario.id]
      );

      await query(
        'UPDATE "ContaCorrenteCliente" SET "saldo" = $1, "updatedAt" = NOW() WHERE "id" = $2',
        [novoSaldo, contaCorrenteId]
      );

      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    return withCors(NextResponse.json({ mensagem: 'Lançamento realizado com sucesso', novoSaldo }), request);
  } catch (error: any) {
    console.error('Erro ao lançar na conta corrente:', error);
    const res = NextResponse.json(
      { mensagem: 'Erro ao lançar na conta corrente', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
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

    const atleta = await obterAtletaDaArena(atletaId, pointId);
    if (!atleta) {
      return withCors(NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }), request);
    }
    if (!atleta.usuarioId) {
      return withCors(NextResponse.json({ mensagem: 'Atleta sem usuário vinculado' }, { status: 400 }), request);
    }

    const contaResult = await query(
      'SELECT id, saldo FROM "ContaCorrenteCliente" WHERE "usuarioId" = $1 AND "pointId" = $2 LIMIT 1',
      [atleta.usuarioId, pointId]
    );

    if (contaResult.rows.length === 0) {
      return withCors(NextResponse.json({ saldo: 0, movimentacoes: [] }), request);
    }

    const contaCorrenteId = contaResult.rows[0].id as string;
    const saldo = parseFloat(contaResult.rows[0].saldo);

    const values: any[] = [contaCorrenteId];
    let where = 'WHERE m."contaCorrenteId" = $1';
    if (dataInicio) {
      where += ` AND m."createdAt" >= $${values.length + 1}`;
      values.push(dataInicio);
    }
    if (dataFim) {
      where += ` AND m."createdAt" <= $${values.length + 1}`;
      values.push(dataFim);
    }
    values.push(limit);
    values.push(offset);

    const sql = `SELECT
      m.id, m.tipo, m.valor, m.justificativa, m."pagamentoCardId", m."createdAt",
      u.id as "createdBy_id", u.name as "createdBy_name", u.email as "createdBy_email",
      pc.id as "pagamento_id",
      c.id as "card_id", c."numeroCard" as "card_numero"
    FROM "MovimentacaoContaCorrente" m
    LEFT JOIN "User" u ON u.id = m."createdById"
    LEFT JOIN "PagamentoCard" pc ON pc.id = m."pagamentoCardId"
    LEFT JOIN "CardCliente" c ON c.id = pc."cardId"
    ${where}
    ORDER BY m."createdAt" DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const movResult = await query(sql, values);
    const movimentacoes = movResult.rows.map((row: any) => ({
      id: row.id,
      tipo: row.tipo,
      valor: parseFloat(row.valor),
      descricao: row.justificativa || (row.tipo === 'CREDITO' ? 'Crédito Adicionado' : 'Débito Realizado'),
      data: row.createdAt,
      pagamentoCardId: row.pagamentoCardId || null,
      createdAt: row.createdAt,
      createdBy: row.createdBy_id ? {
        id: row.createdBy_id,
        name: row.createdBy_name,
        email: row.createdBy_email,
      } : null,
      card: row.card_id ? { id: row.card_id, numeroCard: row.card_numero } : null,
    }));

    return withCors(NextResponse.json({ saldoAtual: saldo, lancamentos: movimentacoes }), request);
  } catch (error: any) {
    const res = NextResponse.json(
      { mensagem: 'Erro ao listar conta corrente', error: error.message },
      { status: 500 }
    );
    return withCors(res, request);
  }
}
