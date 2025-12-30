// app/api/competicao/[id]/jogos/[jogoId]/route.ts - Atualizar resultado de um jogo
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// PUT /api/competicao/[id]/jogos/[jogoId] - Atualizar resultado do jogo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jogoId: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: competicaoId, jogoId } = await params;
    const body = await request.json();

    // Verificar se competição existe e se usuário tem acesso
    const competicaoCheck = await query(
      `SELECT "pointId" FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );

    if (competicaoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const competicao = competicaoCheck.rows[0];

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicao.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se jogo existe
    const jogoCheck = await query(
      `SELECT id, "atleta1ParceriaId", "atleta2ParceriaId" FROM "JogoCompeticao" 
       WHERE id = $1 AND "competicaoId" = $2`,
      [jogoId, competicaoId]
    );

    if (jogoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Jogo não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const jogo = jogoCheck.rows[0];

    // Extrair dados do body
    const { gamesAtleta1, gamesAtleta2, dataHora, quadraId, observacoes, status } = body;

    // Converter placar para número, tratando strings vazias e valores inválidos
    const converterParaNumero = (valor: any): number | null => {
      if (valor === null || valor === undefined || valor === '') {
        return null;
      }
      if (typeof valor === 'number') {
        return isNaN(valor) ? null : valor;
      }
      if (typeof valor === 'string') {
        const num = parseInt(valor, 10);
        return isNaN(num) ? null : num;
      }
      return null;
    };

    const games1 = converterParaNumero(gamesAtleta1);
    const games2 = converterParaNumero(gamesAtleta2);

    // Validar placar (aceitar qualquer número positivo ou zero)
    if (games1 !== null && games1 < 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Placar de games do participante 1 deve ser um número positivo ou zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (games2 !== null && games2 < 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Placar de games do participante 2 deve ser um número positivo ou zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Determinar vencedor baseado no placar (apenas se ambos os valores estiverem preenchidos)
    let vencedorId: string | null = null;
    if (games1 !== null && games2 !== null) {
      if (games1 > games2) {
        vencedorId = jogo.atleta1ParceriaId || null;
      } else if (games2 > games1) {
        vencedorId = jogo.atleta2ParceriaId || null;
      }
      // Se empatou (games1 === games2), vencedorId fica null
    }

    // Atualizar jogo
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    // Atualizar placar se pelo menos um dos valores foi fornecido
    if (gamesAtleta1 !== undefined || gamesAtleta2 !== undefined) {
      if (games1 !== null) {
        updateFields.push(`"gamesAtleta1" = $${paramCount++}`);
        updateValues.push(games1);
      } else if (gamesAtleta1 === null || gamesAtleta1 === '') {
        // Permitir limpar o placar explicitamente
        updateFields.push(`"gamesAtleta1" = NULL`);
      }

      if (games2 !== null) {
        updateFields.push(`"gamesAtleta2" = $${paramCount++}`);
        updateValues.push(games2);
      } else if (gamesAtleta2 === null || gamesAtleta2 === '') {
        // Permitir limpar o placar explicitamente
        updateFields.push(`"gamesAtleta2" = NULL`);
      }

      // Atualizar vencedor apenas se ambos os placares estiverem preenchidos
      if (games1 !== null && games2 !== null) {
        updateFields.push(`"vencedorId" = $${paramCount++}`);
        updateValues.push(vencedorId);
        
        // Se tem placar completo, considerar concluído
        if (status === undefined || status === null) {
          updateFields.push(`status = $${paramCount++}`);
          updateValues.push('CONCLUIDO');
        }
      } else {
        // Se o placar foi limpo parcialmente, limpar também o vencedor
        updateFields.push(`"vencedorId" = NULL`);
      }
    }

    if (status !== undefined && status !== null) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(status);
    }

    if (dataHora !== undefined && dataHora !== null) {
      updateFields.push(`"dataHora" = $${paramCount++}`);
      updateValues.push(new Date(dataHora));
    } else if (dataHora === null) {
      updateFields.push(`"dataHora" = NULL`);
    }

    if (quadraId !== undefined && quadraId !== null) {
      updateFields.push(`"quadraId" = $${paramCount++}`);
      updateValues.push(quadraId);
    } else if (quadraId === null) {
      updateFields.push(`"quadraId" = NULL`);
    }

    if (observacoes !== undefined) {
      updateFields.push(`observacoes = $${paramCount++}`);
      updateValues.push(observacoes || null);
    }

    updateFields.push(`"updatedAt" = NOW()`);

    if (updateFields.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updateValues.push(jogoId, competicaoId);

    const updateQuery = `
      UPDATE "JogoCompeticao"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND "competicaoId" = $${paramCount++}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    const response = NextResponse.json({
      mensagem: 'Resultado do jogo atualizado com sucesso',
      jogo: result.rows[0],
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar resultado do jogo:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar resultado do jogo', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

