import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function parseOptionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

async function podeAcessarPoint(usuario: any, pointId: string) {
  if (usuario.role === 'ADMIN') return true;
  if (usuario.role === 'ORGANIZER') return usuarioTemAcessoAoPoint(usuario, pointId);
  return false;
}

async function recalcularStatusConta(client: any, contaPagarId: string) {
  const statusContaResult = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status <> 'CANCELADA') AS total,
      COUNT(*) FILTER (WHERE status = 'LIQUIDADA') AS liquidadas,
      COUNT(*) FILTER (WHERE status IN ('PARCIAL', 'LIQUIDADA')) AS com_movimento
    FROM "ContaPagarParcela"
    WHERE "contaPagarId" = $1
    `,
    [contaPagarId]
  );

  const total = Number(statusContaResult.rows[0]?.total ?? 0);
  const liquidadas = Number(statusContaResult.rows[0]?.liquidadas ?? 0);
  const comMovimento = Number(statusContaResult.rows[0]?.com_movimento ?? 0);
  const statusConta = total > 0 && liquidadas === total ? 'LIQUIDADA' : comMovimento > 0 ? 'PARCIAL' : 'ABERTA';

  await client.query(
    `UPDATE "ContaPagar" SET status = $2, "updatedAt" = NOW() WHERE id = $1`,
    [contaPagarId, statusConta]
  );
}

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ parcelaId: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    const { parcelaId } = await params;
    const parcelaResult = await query(
      `
      SELECT
        p.id AS "parcelaId",
        cp.id AS "contaId",
        cp."pointId",
        cp."fornecedorId",
        f.nome AS "fornecedorNome",
        cp."tipoDespesaId",
        td.nome AS "tipoDespesaNome",
        cp."centroCustoId",
        cc.nome AS "centroCustoNome",
        cp."codigoExterno",
        cp.descricao,
        cp.status AS "statusConta",
        p.status AS "statusParcela",
        p.numero,
        p."createdAt"::date AS "dataLancamento",
        p.vencimento,
        p.valor::numeric(14,2) AS valor,
        cp.observacoes,
        p.observacoes AS "observacoesParcela",
        COALESCE(SUM(l.valor), 0)::numeric(14,2) AS "valorLiquidado"
      FROM "ContaPagarParcela" p
      INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
      LEFT JOIN "ContaPagarLiquidacao" l ON l."parcelaId" = p.id
      LEFT JOIN "Fornecedor" f ON f.id = cp."fornecedorId"
      LEFT JOIN "TipoDespesa" td ON td.id = cp."tipoDespesaId"
      LEFT JOIN "CentroCusto" cc ON cc.id = cp."centroCustoId"
      WHERE p.id = $1
      GROUP BY p.id, cp.id, f.nome, td.nome, cc.nome
      `,
      [parcelaId]
    );

    if (parcelaResult.rows.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Despesa não encontrada' }, { status: 404 }), request);
    }

    const despesa = parcelaResult.rows[0];
    if (!(await podeAcessarPoint(usuario, despesa.pointId))) {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão para esta arena' }, { status: 403 }), request);
    }

    const liquidacoesResult = await query(
      `
      SELECT
        l.id, l.data, l.valor::numeric(14,2) AS valor, l.observacoes, l."createdAt", l."createdById",
        l."formaPagamentoId",
        fp.nome AS "formaPagamentoNome",
        l."origemFinanceira",
        l."contaBancariaId",
        cb.nome AS "contaBancariaNome"
      FROM "ContaPagarLiquidacao" l
      LEFT JOIN "FormaPagamento" fp ON fp.id = l."formaPagamentoId"
      LEFT JOIN "ContaBancaria" cb ON cb.id = l."contaBancariaId"
      WHERE l."parcelaId" = $1
      ORDER BY l.data ASC, l."createdAt" ASC
      `,
      [parcelaId]
    );

    return withCors(NextResponse.json({ despesa, liquidacoes: liquidacoesResult.rows }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar despesa', error: error.message }, { status: 500 }),
      request
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ parcelaId: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { parcelaId } = await params;
    const body = await request.json();
    const vencimento = parseDate(body?.vencimento);
    const valor = typeof body?.valor === 'number' ? body.valor : Number(body?.valor);
    const observacoesConta = parseOptionalText(body?.observacoes);
    const observacoesParcela = parseOptionalText(body?.observacoesParcela);
    const descricao = parseOptionalText(body?.descricao);
    const fornecedorId = typeof body?.fornecedorId === 'string' ? body.fornecedorId.trim() : '';
    const tipoDespesaId = typeof body?.tipoDespesaId === 'string' ? body.tipoDespesaId.trim() : '';
    const centroCustoId = typeof body?.centroCustoId === 'string' ? body.centroCustoId.trim() : '';
    const codigoExterno = typeof body?.codigoExterno === 'string' ? body.codigoExterno.trim() : '';

    if (!vencimento || !Number.isFinite(valor) || valor <= 0) {
      return withCors(NextResponse.json({ mensagem: 'Vencimento e valor são obrigatórios' }, { status: 400 }), request);
    }

    const updated = await transaction(async (client) => {
      const parcelaAtual = await client.query(
        `
        SELECT p.id, p.valor, p."contaPagarId", cp."pointId"
        FROM "ContaPagarParcela" p
        INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
        WHERE p.id = $1
        `,
        [parcelaId]
      );
      if (parcelaAtual.rows.length === 0) return null;

      const row = parcelaAtual.rows[0];
      if (!(await podeAcessarPoint(usuario, row.pointId))) {
        throw new Error('FORBIDDEN_POINT');
      }

      const soma = await client.query(
        `SELECT COALESCE(SUM(valor), 0)::numeric(14,2) AS total FROM "ContaPagarLiquidacao" WHERE "parcelaId" = $1`,
        [parcelaId]
      );
      const totalLiquidado = Number(soma.rows[0]?.total ?? 0);
      if (valor < totalLiquidado) {
        throw new Error('VALOR_MENOR_QUE_LIQUIDADO');
      }
      const statusParcela = totalLiquidado >= valor ? 'LIQUIDADA' : totalLiquidado > 0 ? 'PARCIAL' : 'PENDENTE';

      const hasContaUpdate =
        body?.descricao !== undefined ||
        body?.fornecedorId !== undefined ||
        body?.tipoDespesaId !== undefined ||
        body?.centroCustoId !== undefined ||
        body?.codigoExterno !== undefined ||
        body?.observacoes !== undefined;

      if (hasContaUpdate) {
        if (body?.descricao !== undefined && !descricao) {
          return { ok: false as const, status: 400, mensagem: 'Descrição é obrigatória' };
        }

        if (fornecedorId) {
          const fornecedor = await client.query('SELECT id, ativo, "pointId" FROM "Fornecedor" WHERE id = $1', [fornecedorId]);
          if (fornecedor.rows.length === 0 || !fornecedor.rows[0].ativo || fornecedor.rows[0].pointId !== row.pointId) {
            return { ok: false as const, status: 400, mensagem: 'Fornecedor inválido para esta arena' };
          }
        }

        if (tipoDespesaId) {
          const tipo = await client.query('SELECT id, ativo, "pointId" FROM "TipoDespesa" WHERE id = $1', [tipoDespesaId]);
          if (tipo.rows.length === 0 || !tipo.rows[0].ativo || tipo.rows[0].pointId !== row.pointId) {
            return { ok: false as const, status: 400, mensagem: 'Tipo de despesa inválido para esta arena' };
          }
        }

        if (centroCustoId) {
          const centro = await client.query('SELECT id, ativo, "pointId" FROM "CentroCusto" WHERE id = $1', [centroCustoId]);
          if (centro.rows.length === 0 || !centro.rows[0].ativo || centro.rows[0].pointId !== row.pointId) {
            return { ok: false as const, status: 400, mensagem: 'Centro de custo inválido para esta arena' };
          }
        }

        const shouldUpdateFornecedor = body?.fornecedorId !== undefined;
        const shouldUpdateTipo = body?.tipoDespesaId !== undefined;
        const shouldUpdateCentro = body?.centroCustoId !== undefined;
        const shouldUpdateCodigo = body?.codigoExterno !== undefined;
        const shouldUpdateObs = body?.observacoes !== undefined;
        const shouldUpdateDescricao = body?.descricao !== undefined;

        const fornecedorIdValue = body?.fornecedorId === '' ? null : fornecedorId || null;
        const tipoDespesaIdValue = body?.tipoDespesaId === '' ? null : tipoDespesaId || null;
        const centroCustoIdValue = body?.centroCustoId === '' ? null : centroCustoId || null;
        const codigoExternoValue = body?.codigoExterno === '' ? null : codigoExterno || null;
        const observacoesContaValue = body?.observacoes === '' ? null : observacoesConta;

        await client.query(
          `
          UPDATE "ContaPagar"
          SET
            descricao = CASE WHEN $2::boolean THEN $3 ELSE descricao END,
            "fornecedorId" = CASE WHEN $4::boolean THEN $5::text ELSE "fornecedorId" END,
            "tipoDespesaId" = CASE WHEN $6::boolean THEN $7::text ELSE "tipoDespesaId" END,
            "centroCustoId" = CASE WHEN $8::boolean THEN $9::text ELSE "centroCustoId" END,
            "codigoExterno" = CASE WHEN $10::boolean THEN $11::text ELSE "codigoExterno" END,
            observacoes = CASE WHEN $12::boolean THEN $13 ELSE observacoes END,
            "updatedAt" = NOW(),
            "updatedById" = $14
          WHERE id = $1
          `,
          [
            row.contaPagarId,
            shouldUpdateDescricao,
            descricao,
            shouldUpdateFornecedor,
            fornecedorIdValue,
            shouldUpdateTipo,
            tipoDespesaIdValue,
            shouldUpdateCentro,
            centroCustoIdValue,
            shouldUpdateCodigo,
            codigoExternoValue,
            shouldUpdateObs,
            observacoesContaValue,
            usuario.id,
          ]
        );
      }

      const parcelaUpdate = await client.query(
        `
        UPDATE "ContaPagarParcela"
        SET vencimento = $2::date, valor = $3, status = $4, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [parcelaId, vencimento, valor, statusParcela]
      );

      await recalcularStatusConta(client, row.contaPagarId);
      return parcelaUpdate.rows[0];
    });

    if (!updated) {
      return withCors(NextResponse.json({ mensagem: 'Despesa não encontrada' }, { status: 404 }), request);
    }

    if ((updated as any).ok === false) {
      return withCors(NextResponse.json({ mensagem: (updated as any).mensagem }, { status: (updated as any).status }), request);
    }

    return withCors(NextResponse.json(updated), request);
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN_POINT') {
      return withCors(NextResponse.json({ mensagem: 'Sem acesso a esta arena' }, { status: 403 }), request);
    }
    if (error?.message === 'VALOR_MENOR_QUE_LIQUIDADO') {
      return withCors(
        NextResponse.json({ mensagem: 'Valor não pode ser menor que o total já liquidado' }, { status: 400 }),
        request
      );
    }
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao atualizar despesa', error: error.message }, { status: 500 }),
      request
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ parcelaId: string }> }) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { parcelaId } = await params;

    const result = await transaction(async (client) => {
      const parcelaAtual = await client.query(
        `
        SELECT p.id, p."contaPagarId", cp."pointId"
        FROM "ContaPagarParcela" p
        INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
        WHERE p.id = $1
        `,
        [parcelaId]
      );
      if (parcelaAtual.rows.length === 0) return { ok: false as const, status: 404, mensagem: 'Despesa não encontrada' };

      const row = parcelaAtual.rows[0];
      if (!(await podeAcessarPoint(usuario, row.pointId))) {
        return { ok: false as const, status: 403, mensagem: 'Sem acesso a esta arena' };
      }

      const soma = await client.query(
        `SELECT COALESCE(SUM(valor), 0)::numeric(14,2) AS total FROM "ContaPagarLiquidacao" WHERE "parcelaId" = $1`,
        [parcelaId]
      );
      const totalLiquidado = Number(soma.rows[0]?.total ?? 0);
      if (totalLiquidado > 0) {
        return { ok: false as const, status: 400, mensagem: 'Não é possível excluir a despesa: há pagamentos registrados' };
      }

      await client.query(`DELETE FROM "ContaPagarParcela" WHERE id = $1`, [parcelaId]);

      const restantes = await client.query(
        `SELECT COUNT(*)::int AS total FROM "ContaPagarParcela" WHERE "contaPagarId" = $1 AND status <> 'CANCELADA'`,
        [row.contaPagarId]
      );
      const totalRestantes = Number(restantes.rows[0]?.total ?? 0);

      if (totalRestantes === 0) {
        await client.query(`DELETE FROM "ContaPagar" WHERE id = $1`, [row.contaPagarId]);
        return { ok: true as const, contaExcluida: true };
      }

      await recalcularStatusConta(client, row.contaPagarId);
      return { ok: true as const, contaExcluida: false };
    });

    if (!result.ok) {
      return withCors(NextResponse.json({ mensagem: result.mensagem }, { status: result.status }), request);
    }
    return withCors(NextResponse.json(result), request);
  } catch (error: any) {
    return withCors(NextResponse.json({ mensagem: 'Erro ao excluir despesa', error: error.message }, { status: 500 }), request);
  }
}
