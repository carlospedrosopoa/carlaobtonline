import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
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
    const parcelaId = typeof body?.parcelaId === 'string' ? body.parcelaId.trim() : '';
    const formaPagamentoId = typeof body?.formaPagamentoId === 'string' ? body.formaPagamentoId.trim() : '';
    const data = parseDate(body?.data);
    const valor = typeof body?.valor === 'number' ? body.valor : Number(body?.valor);
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';

    if (!parcelaId || !formaPagamentoId || !data || !Number.isFinite(valor) || valor <= 0) {
      return withCors(
        NextResponse.json({ mensagem: 'parcelaId, formaPagamentoId, data e valor são obrigatórios' }, { status: 400 }),
        request
      );
    }
    const result = await transaction(async (client) => {
      const parcelaResult = await client.query(
        `
        SELECT
          p.id, p.numero, p.valor, p."contaPagarId",
          cp."pointId", cp.descricao, cp."fornecedorId", cp."tipoDespesaId", cp."centroCustoId"
        FROM "ContaPagarParcela" p
        INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
        WHERE p.id = $1
        `,
        [parcelaId]
      );

      if (parcelaResult.rows.length === 0) {
        return { ok: false as const, status: 404, mensagem: 'Parcela não encontrada' };
      }

      const parcela = parcelaResult.rows[0];
      if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, parcela.pointId)) {
        return { ok: false as const, status: 403, mensagem: 'Sem acesso a esta arena' };
      }

      const formaPagamentoResult = await client.query(
        `SELECT id, ativo, "pointId", "origemFinanceiraPadrao", "contaBancariaIdPadrao" FROM "FormaPagamento" WHERE id = $1`,
        [formaPagamentoId]
      );
      if (formaPagamentoResult.rows.length === 0 || !formaPagamentoResult.rows[0].ativo) {
        return { ok: false as const, status: 400, mensagem: 'Forma de pagamento inválida' };
      }
      if (formaPagamentoResult.rows[0].pointId !== parcela.pointId) {
        return { ok: false as const, status: 400, mensagem: 'Forma de pagamento não pertence à arena' };
      }
      const origemFinanceira = formaPagamentoResult.rows[0].origemFinanceiraPadrao === 'CONTA_BANCARIA' ? 'CONTA_BANCARIA' : 'CAIXA';
      const contaBancariaId = origemFinanceira === 'CONTA_BANCARIA' ? (formaPagamentoResult.rows[0].contaBancariaIdPadrao || null) : null;

      if (!parcela.centroCustoId) {
        return { ok: false as const, status: 400, mensagem: 'Conta sem centro de custo. Atualize antes de liquidar.' };
      }

      let aberturaId: string | null = null;
      if (origemFinanceira === 'CAIXA') {
        const aberturaResult = await client.query(
          `SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = 'ABERTA' ORDER BY "dataAbertura" DESC LIMIT 1`,
          [parcela.pointId]
        );
        if (aberturaResult.rows.length === 0) {
          return { ok: false as const, status: 400, mensagem: 'Não há caixa aberto para registrar a saída' };
        }
        aberturaId = aberturaResult.rows[0].id;
      } else {
        if (!contaBancariaId) {
          return { ok: false as const, status: 400, mensagem: 'A forma de pagamento não possui conta bancária padrão configurada' };
        }
        const contaBancariaResult = await client.query(
          `SELECT id, ativo, "pointId" FROM "ContaBancaria" WHERE id = $1`,
          [contaBancariaId]
        );
        if (contaBancariaResult.rows.length === 0 || !contaBancariaResult.rows[0].ativo) {
          return { ok: false as const, status: 400, mensagem: 'Conta bancária inválida' };
        }
        if (contaBancariaResult.rows[0].pointId !== parcela.pointId) {
          return { ok: false as const, status: 400, mensagem: 'Conta bancária não pertence à arena' };
        }
      }

      const liquidacaoResult = await client.query(
        `
        INSERT INTO "ContaPagarLiquidacao" (
          id, "parcelaId", "origemFinanceira", "contaBancariaId", data, valor, "formaPagamentoId", observacoes, "createdAt", "createdById"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4::date, $5, $6, $7, NOW(), $8
        ) RETURNING *
        `,
        [parcelaId, origemFinanceira, contaBancariaId || null, data, valor, formaPagamentoId, observacoes || null, usuario.id]
      );

      const liquidacao = liquidacaoResult.rows[0];

      if (origemFinanceira === 'CAIXA') {
        const saidaResult = await client.query(
          `
          INSERT INTO "SaidaCaixa" (
            id, "pointId", "aberturaCaixaId", valor, descricao, "fornecedorId", "tipoDespesaId", "centroCustoId",
            "formaPagamentoId", observacoes, "dataSaida", "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, NOW(), $11
          ) RETURNING id
          `,
          [
            parcela.pointId,
            aberturaId,
            valor,
            `Conta a pagar: ${parcela.descricao} (Parcela ${parcela.numero})`,
            parcela.fornecedorId || null,
            parcela.tipoDespesaId || null,
            parcela.centroCustoId,
            formaPagamentoId,
            observacoes || null,
            data,
            usuario.id,
          ]
        );

        await client.query(
          `UPDATE "ContaPagarLiquidacao" SET "saidaCaixaId" = $2 WHERE id = $1`,
          [liquidacao.id, saidaResult.rows[0].id]
        );
      } else {
        await client.query(
          `
          INSERT INTO "MovimentacaoContaBancaria" (
            id, "contaBancariaId", tipo, valor, data, descricao, origem, "liquidacaoContaPagarId", observacoes, "createdAt", "createdById"
          ) VALUES (
            gen_random_uuid()::text, $1, 'SAIDA', $2, $3::date, $4, 'CONTA_PAGAR', $5, $6, NOW(), $7
          )
          `,
          [
            contaBancariaId,
            valor,
            data,
            `Conta a pagar: ${parcela.descricao} (Parcela ${parcela.numero})`,
            liquidacao.id,
            observacoes || null,
            usuario.id,
          ]
        );
      }

      const somaResult = await client.query(
        `SELECT COALESCE(SUM(valor), 0)::numeric(14,2) AS total FROM "ContaPagarLiquidacao" WHERE "parcelaId" = $1`,
        [parcelaId]
      );
      const totalLiquidado = Number(somaResult.rows[0]?.total ?? 0);
      const valorParcela = Number(parcela.valor);
      const statusParcela = totalLiquidado >= valorParcela ? 'LIQUIDADA' : totalLiquidado > 0 ? 'PARCIAL' : 'PENDENTE';

      await client.query(
        `UPDATE "ContaPagarParcela" SET status = $2, "updatedAt" = NOW() WHERE id = $1`,
        [parcelaId, statusParcela]
      );
      await recalcularStatusConta(client, parcela.contaPagarId);

      return { ok: true as const, liquidacaoId: liquidacao.id, statusParcela, totalLiquidado };
    });

    if (!result.ok) {
      return withCors(NextResponse.json({ mensagem: result.mensagem }, { status: result.status }), request);
    }

    return withCors(NextResponse.json(result, { status: 201 }), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao liquidar parcela', error: error.message }, { status: 500 }),
      request
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(NextResponse.json({ mensagem: 'Sem permissão' }, { status: 403 }), request);
    }

    const { searchParams } = new URL(request.url);
    const liquidacaoId = typeof searchParams.get('id') === 'string' ? searchParams.get('id')!.trim() : '';
    if (!liquidacaoId) {
      return withCors(NextResponse.json({ mensagem: 'id é obrigatório' }, { status: 400 }), request);
    }

    const result = await transaction(async (client) => {
      const liquidacaoResult = await client.query(
        `
        SELECT
          l.id, l."parcelaId", l."origemFinanceira", l."contaBancariaId", l."saidaCaixaId", l.data, l.valor,
          l."formaPagamentoId", l."createdById", p."contaPagarId", cp."pointId"
        FROM "ContaPagarLiquidacao" l
        INNER JOIN "ContaPagarParcela" p ON p.id = l."parcelaId"
        INNER JOIN "ContaPagar" cp ON cp.id = p."contaPagarId"
        WHERE l.id = $1
        `,
        [liquidacaoId]
      );
      if (liquidacaoResult.rows.length === 0) {
        return { ok: false as const, status: 404, mensagem: 'Liquidação não encontrada' };
      }

      const liquidacao = liquidacaoResult.rows[0];
      if (usuario.role === 'ORGANIZER' && !usuarioTemAcessoAoPoint(usuario, liquidacao.pointId)) {
        return { ok: false as const, status: 403, mensagem: 'Sem acesso a esta arena' };
      }

      if (!liquidacao.createdById) {
        return { ok: false as const, status: 400, mensagem: 'Não é possível excluir: pagamento não foi registrado manualmente no Contas a Pagar' };
      }

      if (liquidacao.origemFinanceira === 'CAIXA') {
        if (!liquidacao.saidaCaixaId) {
          return { ok: false as const, status: 400, mensagem: 'Não é possível excluir: pagamento não é do fluxo de Contas a Pagar' };
        }
        await client.query(`DELETE FROM "SaidaCaixa" WHERE id = $1`, [liquidacao.saidaCaixaId]);
      } else {
        const mov = await client.query(
          `SELECT id FROM "MovimentacaoContaBancaria" WHERE "liquidacaoContaPagarId" = $1 LIMIT 1`,
          [liquidacaoId]
        );
        if (mov.rows.length === 0) {
          return { ok: false as const, status: 400, mensagem: 'Não é possível excluir: pagamento não é do fluxo de Contas a Pagar' };
        }
        await client.query(
          `DELETE FROM "MovimentacaoContaBancaria" WHERE "liquidacaoContaPagarId" = $1`,
          [liquidacaoId]
        );
      }

      await client.query(`DELETE FROM "ContaPagarLiquidacao" WHERE id = $1`, [liquidacaoId]);

      const somaResult = await client.query(
        `SELECT COALESCE(SUM(valor), 0)::numeric(14,2) AS total FROM "ContaPagarLiquidacao" WHERE "parcelaId" = $1`,
        [liquidacao.parcelaId]
      );
      const totalLiquidado = Number(somaResult.rows[0]?.total ?? 0);

      const parcelaResult = await client.query(`SELECT valor FROM "ContaPagarParcela" WHERE id = $1`, [liquidacao.parcelaId]);
      const valorParcela = Number(parcelaResult.rows[0]?.valor ?? 0);
      const statusParcela = totalLiquidado >= valorParcela ? 'LIQUIDADA' : totalLiquidado > 0 ? 'PARCIAL' : 'PENDENTE';

      await client.query(
        `UPDATE "ContaPagarParcela" SET status = $2, "updatedAt" = NOW() WHERE id = $1`,
        [liquidacao.parcelaId, statusParcela]
      );
      await recalcularStatusConta(client, liquidacao.contaPagarId);

      return { ok: true as const, statusParcela, totalLiquidado };
    });

    if (!result.ok) {
      return withCors(NextResponse.json({ mensagem: result.mensagem }, { status: result.status }), request);
    }
    return withCors(NextResponse.json(result), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao excluir liquidação', error: error.message }, { status: 500 }),
      request
    );
  }
}
