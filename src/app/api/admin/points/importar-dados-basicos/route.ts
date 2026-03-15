import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query, transaction } from '@/lib/db';

type TabelaBasica = 'FORNECEDORES' | 'PRODUTOS' | 'TIPO_DESPESA' | 'CENTRO_CUSTO' | 'FORMA_PAGAMENTO';

function quoteIdent(ident: string) {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function importarTabelaPorNome(opts: {
  tableName: string;
  sourcePointId: string;
  targetPointId: string;
  uniqueNameColumn: string;
  copyColumns: string[];
  runQuery: (text: string, params?: any[]) => Promise<any>;
}) {
  const { tableName, sourcePointId, targetPointId, uniqueNameColumn, copyColumns, runQuery } = opts;

  const colResult = await runQuery(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  const columns = new Set(colResult.rows.map((r: any) => r.column_name));

  const required = ['id', 'pointId', uniqueNameColumn];
  for (const req of required) {
    if (!columns.has(req)) {
      throw new Error(`Tabela ${tableName} não possui coluna obrigatória: ${req}`);
    }
  }

  const safeCopy = copyColumns.filter((c) => columns.has(c) && c !== 'id' && c !== 'pointId');
  const stampCols = ['createdAt', 'updatedAt'].filter((c) => columns.has(c));

  const insertCols = ['id', 'pointId', ...safeCopy, ...stampCols].map(quoteIdent).join(', ');

  const selectColsParts: string[] = [
    `gen_random_uuid()::text`,
    `$2`,
    ...safeCopy.map((c) => `s.${quoteIdent(c)}`),
    ...stampCols.map(() => `NOW()`),
  ];

  const whereNotExists = `NOT EXISTS (
    SELECT 1
    FROM ${quoteIdent(tableName)} t
    WHERE t.${quoteIdent('pointId')} = $2
      AND t.${quoteIdent(uniqueNameColumn)} = s.${quoteIdent(uniqueNameColumn)}
  )`;

  const sql = `
    WITH src AS (
      SELECT s.*
      FROM ${quoteIdent(tableName)} s
      WHERE s.${quoteIdent('pointId')} = $1
    ),
    inserted AS (
      INSERT INTO ${quoteIdent(tableName)} (${insertCols})
      SELECT ${selectColsParts.join(', ')}
      FROM src s
      WHERE ${whereNotExists}
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM src) as total_origem,
      (SELECT COUNT(*)::int FROM inserted) as inseridos
  `;

  const result = await runQuery(sql, [sourcePointId, targetPointId]);
  const row = result.rows[0];
  const totalOrigem = row?.total_origem ?? 0;
  const inseridos = row?.inseridos ?? 0;
  const ignorados = Math.max(0, totalOrigem - inseridos);

  return { totalOrigem, inseridos, ignorados };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;

    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const body = await request.json().catch(() => ({}));
    const sourcePointId = String(body?.sourcePointId || '');
    const targetPointId = String(body?.targetPointId || '');
    const tabelas = (Array.isArray(body?.tabelas) ? body.tabelas : []) as TabelaBasica[];

    if (!sourcePointId || !targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'sourcePointId e targetPointId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (sourcePointId === targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'A arena de origem e destino devem ser diferentes' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const tabelasDefault: TabelaBasica[] = ['FORNECEDORES', 'PRODUTOS', 'TIPO_DESPESA', 'CENTRO_CUSTO', 'FORMA_PAGAMENTO'];
    const tabelasParaImportar = (tabelas.length > 0 ? tabelas : tabelasDefault).filter((t) => tabelasDefault.includes(t));

    const pontos = await query(
      `SELECT id, nome FROM "Point" WHERE id IN ($1, $2)`,
      [sourcePointId, targetPointId]
    );
    if (pontos.rows.length !== 2) {
      const errorResponse = NextResponse.json({ mensagem: 'Point de origem ou destino não encontrado' }, { status: 404 });
      return withCors(errorResponse, request);
    }

    const resultado: Record<string, { totalOrigem: number; inseridos: number; ignorados: number }> = {};

    await transaction(async (client) => {
      const runQuery = (text: string, params?: any[]) => client.query(text, params);
      for (const tabela of tabelasParaImportar) {
        if (tabela === 'FORNECEDORES') {
          resultado[tabela] = await importarTabelaPorNome({
            tableName: 'Fornecedor',
            sourcePointId,
            targetPointId,
            uniqueNameColumn: 'nome',
            copyColumns: ['nome', 'nomeFantasia', 'cnpj', 'cpf', 'telefone', 'email', 'endereco', 'observacoes', 'ativo'],
            runQuery,
          });
        }

        if (tabela === 'PRODUTOS') {
          resultado[tabela] = await importarTabelaPorNome({
            tableName: 'Produto',
            sourcePointId,
            targetPointId,
            uniqueNameColumn: 'nome',
            copyColumns: ['nome', 'descricao', 'precoVenda', 'precoCusto', 'categoria', 'ativo', 'acessoRapido', 'autoAtendimento', 'barcode'],
            runQuery,
          });
        }

        if (tabela === 'TIPO_DESPESA') {
          resultado[tabela] = await importarTabelaPorNome({
            tableName: 'TipoDespesa',
            sourcePointId,
            targetPointId,
            uniqueNameColumn: 'nome',
            copyColumns: ['nome', 'descricao', 'ativo'],
            runQuery,
          });
        }

        if (tabela === 'CENTRO_CUSTO') {
          resultado[tabela] = await importarTabelaPorNome({
            tableName: 'CentroCusto',
            sourcePointId,
            targetPointId,
            uniqueNameColumn: 'nome',
            copyColumns: ['nome', 'descricao', 'ativo'],
            runQuery,
          });
        }

        if (tabela === 'FORMA_PAGAMENTO') {
          resultado[tabela] = await importarTabelaPorNome({
            tableName: 'FormaPagamento',
            sourcePointId,
            targetPointId,
            uniqueNameColumn: 'nome',
            copyColumns: ['nome', 'descricao', 'tipo', 'ativo'],
            runQuery,
          });
        }
      }
    });

    const response = NextResponse.json({
      sourcePointId,
      targetPointId,
      tabelas: resultado,
    });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao importar dados básicos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
