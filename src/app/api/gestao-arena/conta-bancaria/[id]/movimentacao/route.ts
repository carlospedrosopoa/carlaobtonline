import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function carregarConta(id: string) {
  const result = await query(`SELECT id, "pointId", nome FROM "ContaBancaria" WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function columnExists(tableName: string, columnName: string) {
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    const { id } = await params;
    const conta = await carregarConta(id);
    if (!conta) return withCors(NextResponse.json({ mensagem: 'Conta bancária não encontrada' }, { status: 404 }), request);
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, conta.pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    const temFornecedorId = await columnExists('MovimentacaoContaBancaria', 'fornecedorId');
    const result = temFornecedorId
      ? await query(
          `
          SELECT
            m.id, m."contaBancariaId", m.tipo, m.valor, m.data, m.descricao, m.origem, m.observacoes, m."createdAt", m."createdById",
            m."fornecedorId", f.nome AS "fornecedorNome"
          FROM "MovimentacaoContaBancaria" m
          LEFT JOIN "Fornecedor" f ON f.id = m."fornecedorId"
          WHERE m."contaBancariaId" = $1
          ORDER BY m.data DESC, m."createdAt" DESC
          `,
          [id]
        )
      : await query(
          `
          SELECT id, "contaBancariaId", tipo, valor, data, descricao, origem, observacoes, "createdAt", "createdById"
          FROM "MovimentacaoContaBancaria"
          WHERE "contaBancariaId" = $1
          ORDER BY data DESC, "createdAt" DESC
          `,
          [id]
        );
    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    if (error?.code === '42P01') {
      return withCors(NextResponse.json([]), request);
    }
    return withCors(NextResponse.json({ mensagem: 'Erro ao listar movimentações', error: error.message }, { status: 500 }), request);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const conta = await carregarConta(id);
    if (!conta) return withCors(NextResponse.json({ mensagem: 'Conta bancária não encontrada' }, { status: 404 }), request);
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, conta.pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    const body = await request.json();
    const tipo = typeof body?.tipo === 'string' ? body.tipo.trim().toUpperCase() : '';
    const valor = typeof body?.valor === 'number' ? body.valor : Number(body?.valor);
    const data = parseDate(body?.data);
    const descricao = typeof body?.descricao === 'string' ? body.descricao.trim() : '';
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';
    const fornecedorId = typeof body?.fornecedorId === 'string' ? body.fornecedorId.trim() : '';

    if (!['ENTRADA', 'SAIDA'].includes(tipo) || !Number.isFinite(valor) || valor <= 0 || !data || !descricao) {
      return withCors(NextResponse.json({ mensagem: 'Dados inválidos para movimentação' }, { status: 400 }), request);
    }

    const temFornecedorId = await columnExists('MovimentacaoContaBancaria', 'fornecedorId');
    let fornecedorIdFinal: string | null = null;
    if (temFornecedorId && fornecedorId) {
      const forn = await query(`SELECT id, ativo, "pointId" FROM "Fornecedor" WHERE id = $1`, [fornecedorId]);
      if (forn.rows.length === 0 || !forn.rows[0].ativo || forn.rows[0].pointId !== conta.pointId) {
        return withCors(NextResponse.json({ mensagem: 'Fornecedor inválido para esta arena' }, { status: 400 }), request);
      }
      fornecedorIdFinal = fornecedorId;
    }

    const result = temFornecedorId
      ? await query(
          `
          INSERT INTO "MovimentacaoContaBancaria" (
            id, "contaBancariaId", tipo, valor, data, descricao, origem, observacoes, "createdAt", "createdById", "fornecedorId"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4::date, $5, 'MANUAL', $6, NOW(), $7, $8
          ) RETURNING *
          `,
          [id, tipo, valor, data, descricao, observacoes || null, usuario.id, fornecedorIdFinal]
        )
      : await query(
          `
          INSERT INTO "MovimentacaoContaBancaria" (
            id, "contaBancariaId", tipo, valor, data, descricao, origem, observacoes, "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4::date, $5, 'MANUAL', $6, NOW(), $7
          ) RETURNING *
          `,
          [id, tipo, valor, data, descricao, observacoes || null, usuario.id]
        );

    return withCors(NextResponse.json(result.rows[0], { status: 201 }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao criar movimentação', error: error.message }, { status: 500 }), request);
  }
}
