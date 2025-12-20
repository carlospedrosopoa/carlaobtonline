// app/api/user/panelinha/[id]/atletas/[atletaId]/route.ts - Remover atleta da panelinha
// DELETE: Remover atleta da panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

// DELETE /api/user/panelinha/[id]/atletas/[atletaId] - Remover atleta da panelinha
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; atletaId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id: panelinhaId, atletaId } = await params;

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é o criador
    const panelinhaCheck = await query(
      'SELECT "atletaIdCriador" FROM "Panelinha" WHERE id = $1',
      [panelinhaId]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas o criador pode remover atletas (ou o próprio atleta pode se remover)
    const ehCriador = panelinhaCheck.rows[0].atletaIdCriador === atleta.id;
    const ehProprioAtleta = atletaId === atleta.id;

    if (!ehCriador && !ehProprioAtleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para remover este atleta' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Não permitir remover o criador da panelinha
    if (atletaId === panelinhaCheck.rows[0].atletaIdCriador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível remover o criador da panelinha' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Remover atleta da panelinha
    const result = await query(
      'DELETE FROM "PanelinhaAtleta" WHERE "panelinhaId" = $1 AND "atletaId" = $2 RETURNING id',
      [panelinhaId, atletaId]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado na panelinha' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ mensagem: 'Atleta removido da panelinha com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao remover atleta:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao remover atleta da panelinha',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

