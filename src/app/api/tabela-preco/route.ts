// app/api/tabela-preco/route.ts - Rotas de API para TabelaPreco (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/tabela-preco - Listar todas as tabelas de preço (com filtro opcional por quadraId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quadraId = searchParams.get('quadraId');

    let sql = `SELECT 
      tp.id, tp."quadraId", tp."inicioMinutoDia", tp."fimMinutoDia", 
      tp."valorHora", tp.ativo, tp."createdAt", tp."updatedAt",
      q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId"
    FROM "TabelaPreco" tp
    LEFT JOIN "Quadra" q ON tp."quadraId" = q.id`;

    const params: any[] = [];
    if (quadraId) {
      sql += ` WHERE tp."quadraId" = $1`;
      params.push(quadraId);
    }

    sql += ` ORDER BY tp."inicioMinutoDia" ASC`;

    const result = await query(sql, params);

    // Formatar resultado para incluir quadra como objeto
    const tabelasPreco = result.rows.map((row) => ({
      id: row.id,
      quadraId: row.quadraId,
      inicioMinutoDia: row.inicioMinutoDia,
      fimMinutoDia: row.fimMinutoDia,
      valorHora: parseFloat(row.valorHora),
      ativo: row.ativo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
        pointId: row.quadra_pointId,
      } : null,
    }));

    return NextResponse.json(tabelasPreco);
  } catch (error: any) {
    console.error('Erro ao listar tabelas de preço:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar tabelas de preço', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/tabela-preco - Criar nova tabela de preço
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quadraId, horaInicio, horaFim, valorHora, ativo = true } = body;

    if (!quadraId || !horaInicio || !horaFim || valorHora === undefined) {
      return NextResponse.json(
        { mensagem: 'Quadra, horário de início, horário de fim e valor são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a quadra existe
    const quadraCheck = await query('SELECT id FROM "Quadra" WHERE id = $1', [quadraId]);
    if (quadraCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
    }

    // Converter horaInicio e horaFim para minutos desde 00:00
    const [horaInicioH, horaInicioM] = horaInicio.split(':').map(Number);
    const [horaFimH, horaFimM] = horaFim.split(':').map(Number);
    const inicioMinutoDia = horaInicioH * 60 + horaInicioM;
    const fimMinutoDia = horaFimH * 60 + horaFimM;

    if (inicioMinutoDia >= fimMinutoDia) {
      return NextResponse.json(
        { mensagem: 'Horário de início deve ser anterior ao horário de fim' },
        { status: 400 }
      );
    }

    // Verificar sobreposição com outras tabelas de preço da mesma quadra
    const sobreposicao = await query(
      `SELECT id FROM "TabelaPreco"
       WHERE "quadraId" = $1
       AND ativo = true
       AND (
         ($2 >= "inicioMinutoDia" AND $2 < "fimMinutoDia")
         OR ($3 > "inicioMinutoDia" AND $3 <= "fimMinutoDia")
         OR ($2 <= "inicioMinutoDia" AND $3 >= "fimMinutoDia")
       )`,
      [quadraId, inicioMinutoDia, fimMinutoDia]
    );

    if (sobreposicao.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Já existe uma tabela de preço ativa com horário sobreposto para esta quadra' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO "TabelaPreco" (id, "quadraId", "inicioMinutoDia", "fimMinutoDia", "valorHora", ativo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, "quadraId", "inicioMinutoDia", "fimMinutoDia", "valorHora", ativo, "createdAt", "updatedAt"`,
      [quadraId, inicioMinutoDia, fimMinutoDia, valorHora, ativo]
    );

    // Buscar quadra para incluir no retorno
    const quadraResult = await query('SELECT id, nome, "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
    const tabelaPreco = {
      ...result.rows[0],
      valorHora: parseFloat(result.rows[0].valorHora),
      quadra: quadraResult.rows[0] || null,
    };

    return NextResponse.json(tabelaPreco, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar tabela de preço:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar tabela de preço', error: error.message },
      { status: 500 }
    );
  }
}

