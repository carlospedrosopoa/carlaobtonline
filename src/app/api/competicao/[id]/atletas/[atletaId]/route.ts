// app/api/competicao/[id]/atletas/[atletaId]/route.ts - Remover atleta da competição
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// DELETE /api/competicao/[id]/atletas/[atletaId] - Remover atleta da competição
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; atletaId: string }> }
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

    const { id: competicaoId, atletaId } = await params;

    // Verificar se competição existe e se usuário tem acesso
    const competicaoCheck = await query(
      `SELECT "pointId", formato FROM "Competicao" WHERE id = $1`,
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

    // Verificar se há jogos gerados - se houver, não permite remover atletas
    const jogosCheck = await query(
      `SELECT COUNT(*) as total FROM "JogoCompeticao" WHERE "competicaoId" = $1`,
      [competicaoId]
    );
    const totalJogos = parseInt(jogosCheck.rows[0].total);
    
    if (totalJogos > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível remover atletas após os jogos serem gerados. Desfaça o sorteio primeiro.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se for formato DUPLAS, pode ter parceiro para remover também
    if (competicao.formato === 'DUPLAS') {
      // Buscar informação do atleta na competição
      const atletaInfo = await query(
        `SELECT "parceriaId", "parceiroAtletaId" FROM "AtletaCompeticao" 
         WHERE "competicaoId" = $1 AND "atletaId" = $2`,
        [competicaoId, atletaId]
      );

      if (atletaInfo.rows.length > 0 && atletaInfo.rows[0].parceriaId) {
        const parceriaId = atletaInfo.rows[0].parceriaId;
        
        // Remover ambos os parceiros da dupla
        await query(
          `DELETE FROM "AtletaCompeticao" WHERE "competicaoId" = $1 AND "parceriaId" = $2`,
          [competicaoId, parceriaId]
        );
      } else {
        // Remover apenas este atleta
        await query(
          `DELETE FROM "AtletaCompeticao" WHERE "competicaoId" = $1 AND "atletaId" = $2`,
          [competicaoId, atletaId]
        );
      }
    } else {
      // Formato INDIVIDUAL: remover apenas este atleta
      await query(
        `DELETE FROM "AtletaCompeticao" WHERE "competicaoId" = $1 AND "atletaId" = $2`,
        [competicaoId, atletaId]
      );
    }

    const response = NextResponse.json({ mensagem: 'Atleta removido da competição com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao remover atleta da competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao remover atleta da competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

