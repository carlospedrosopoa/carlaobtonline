// app/api/competicao/[id]/finalizar/route.ts - Finalizar competição e salvar posições finais
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// POST /api/competicao/[id]/finalizar - Finalizar competição
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: competicaoId } = await params;
    const body = await request.json();
    const { classificacao } = body;

    if (!classificacao || !Array.isArray(classificacao) || classificacao.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Classificação inválida' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se competição existe e se usuário tem acesso
    const competicaoCheck = await query(
      `SELECT "pointId", status FROM "Competicao" WHERE id = $1`,
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

    if (competicao.status === 'CONCLUIDA') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição já está finalizada' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar posições finais dos atletas na tabela AtletaCompeticao
    for (let i = 0; i < classificacao.length; i++) {
      const posicao = classificacao[i];
      await query(
        `UPDATE "AtletaCompeticao"
         SET "posicaoFinal" = $1, pontos = $2, "updatedAt" = NOW()
         WHERE "competicaoId" = $3 AND "atletaId" = $4`,
        [
          i + 1, // Posição (1º, 2º, 3º, etc.)
          posicao.vitorias, // Usar vitórias como pontos
          competicaoId,
          posicao.atletaId,
        ]
      );
    }

    // Atualizar status da competição para CONCLUIDA
    await query(
      `UPDATE "Competicao" 
       SET status = 'CONCLUIDA', "dataFim" = COALESCE("dataFim", NOW()), "updatedAt" = NOW() 
       WHERE id = $1`,
      [competicaoId]
    );

    const campeao = classificacao[0];

    const response = NextResponse.json({
      mensagem: `Competição finalizada com sucesso! 🏆 Campeão: ${campeao.nome}`,
      campeao: {
        atletaId: campeao.atletaId,
        nome: campeao.nome,
        vitorias: campeao.vitorias,
        saldoGames: campeao.saldoGames,
      },
      classificacao,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao finalizar competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao finalizar competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

