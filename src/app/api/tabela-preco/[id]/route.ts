// app/api/tabela-preco/[id]/route.ts - Rotas de API para TabelaPreco individual (PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// PUT /api/tabela-preco/[id] - Atualizar tabela de preço
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { horaInicio, horaFim, valorHora, ativo } = body;

    // Verificar se a tabela existe e obter quadraId
    const tabelaCheck = await query(
      'SELECT "quadraId", "inicioMinutoDia", "fimMinutoDia" FROM "TabelaPreco" WHERE id = $1',
      [params.id]
    );

    if (tabelaCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Tabela de preço não encontrada' },
        { status: 404 }
      );
    }

    const tabelaAtual = tabelaCheck.rows[0];
    const quadraId = tabelaAtual.quadraId;

    // Montar campos de atualização
    const updates: string[] = [];
    const paramsUpdate: any[] = [];
    let paramCount = 1;

    if (horaInicio && horaFim) {
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

      // Verificar sobreposição com outras tabelas de preço da mesma quadra (exceto esta)
      const sobreposicao = await query(
        `SELECT id FROM "TabelaPreco"
         WHERE "quadraId" = $1
         AND id != $2
         AND ativo = true
         AND (
           ($3 >= "inicioMinutoDia" AND $3 < "fimMinutoDia")
           OR ($4 > "inicioMinutoDia" AND $4 <= "fimMinutoDia")
           OR ($3 <= "inicioMinutoDia" AND $4 >= "fimMinutoDia")
         )`,
        [quadraId, params.id, inicioMinutoDia, fimMinutoDia]
      );

      if (sobreposicao.rows.length > 0) {
        return NextResponse.json(
          { mensagem: 'Já existe uma tabela de preço ativa com horário sobreposto para esta quadra' },
          { status: 400 }
        );
      }

      updates.push(`"inicioMinutoDia" = $${paramCount}`);
      paramsUpdate.push(inicioMinutoDia);
      paramCount++;

      updates.push(`"fimMinutoDia" = $${paramCount}`);
      paramsUpdate.push(fimMinutoDia);
      paramCount++;
    }

    if (valorHora !== undefined) {
      updates.push(`"valorHora" = $${paramCount}`);
      paramsUpdate.push(valorHora);
      paramCount++;
    }

    if (ativo !== undefined) {
      updates.push(`ativo = $${paramCount}`);
      paramsUpdate.push(ativo);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    updates.push(`"updatedAt" = NOW()`);
    paramsUpdate.push(params.id);

    const sql = `UPDATE "TabelaPreco"
                 SET ${updates.join(', ')}
                 WHERE id = $${paramCount}
                 RETURNING id, "quadraId", "inicioMinutoDia", "fimMinutoDia", "valorHora", ativo, "createdAt", "updatedAt"`;

    const result = await query(sql, paramsUpdate);

    // Buscar quadra para incluir no retorno
    const quadraResult = await query('SELECT id, nome, "pointId" FROM "Quadra" WHERE id = $1', [result.rows[0].quadraId]);
    const tabelaPreco = {
      ...result.rows[0],
      valorHora: parseFloat(result.rows[0].valorHora),
      quadra: quadraResult.rows[0] || null,
    };

    return NextResponse.json(tabelaPreco);
  } catch (error: any) {
    console.error('Erro ao atualizar tabela de preço:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar tabela de preço', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/tabela-preco/[id] - Deletar tabela de preço
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      `DELETE FROM "TabelaPreco" WHERE id = $1 RETURNING id`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Tabela de preço não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ mensagem: 'Tabela de preço deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar tabela de preço:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar tabela de preço', error: error.message },
      { status: 500 }
    );
  }
}

