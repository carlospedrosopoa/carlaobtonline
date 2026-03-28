import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseTipo(value: unknown) {
  const tipo = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const permitidos = ['CONTA_CORRENTE', 'CONTA_POUPANCA', 'CARTEIRA', 'OUTRO'];
  return permitidos.includes(tipo) ? tipo : 'CONTA_CORRENTE';
}

async function carregarConta(id: string) {
  const result = await query(
    `
    SELECT
      cb.*,
      (
        cb."saldoInicial" + COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.valor ELSE -m.valor END), 0)
      )::numeric(14,2) AS "saldoAtual"
    FROM "ContaBancaria" cb
    LEFT JOIN "MovimentacaoContaBancaria" m ON m."contaBancariaId" = cb.id
    WHERE cb.id = $1
    GROUP BY cb.id
    `,
    [id]
  );
  return result.rows[0] || null;
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
    return withCors(NextResponse.json(conta), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao buscar conta bancária', error: error.message }, { status: 500 }), request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const atual = await carregarConta(id);
    if (!atual) return withCors(NextResponse.json({ mensagem: 'Conta bancária não encontrada' }, { status: 404 }), request);
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, atual.pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    const body = await request.json();
    const nome = typeof body?.nome === 'string' ? body.nome.trim() : atual.nome;
    const banco = typeof body?.banco === 'string' ? body.banco.trim() : atual.banco;
    const agencia = typeof body?.agencia === 'string' ? body.agencia.trim() : atual.agencia;
    const conta = typeof body?.conta === 'string' ? body.conta.trim() : atual.conta;
    const tipo = body?.tipo ? parseTipo(body.tipo) : atual.tipo;
    const ativo = typeof body?.ativo === 'boolean' ? body.ativo : atual.ativo;
    const saldoInicial = typeof body?.saldoInicial === 'number' ? body.saldoInicial : Number(atual.saldoInicial);

    if (!nome) return withCors(NextResponse.json({ mensagem: 'nome é obrigatório' }, { status: 400 }), request);
    if (!Number.isFinite(saldoInicial)) return withCors(NextResponse.json({ mensagem: 'saldoInicial inválido' }, { status: 400 }), request);

    const result = await query(
      `
      UPDATE "ContaBancaria"
      SET nome = $2, banco = $3, agencia = $4, conta = $5, tipo = $6, ativo = $7, "saldoInicial" = $8, "updatedAt" = NOW(), "updatedById" = $9
      WHERE id = $1
      RETURNING *
      `,
      [id, nome, banco || null, agencia || null, conta || null, tipo, ativo, saldoInicial, usuario.id]
    );

    return withCors(NextResponse.json(result.rows[0]), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao atualizar conta bancária', error: error.message }, { status: 500 }), request);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { id } = await params;
    const atual = await carregarConta(id);
    if (!atual) return withCors(NextResponse.json({ mensagem: 'Conta bancária não encontrada' }, { status: 404 }), request);
    if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, atual.pointId)) {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }

    await query(`DELETE FROM "ContaBancaria" WHERE id = $1`, [id]);
    return withCors(NextResponse.json({ mensagem: 'Conta bancária removida com sucesso' }), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao remover conta bancária', error: error.message }, { status: 500 }), request);
  }
}
