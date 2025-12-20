// app/api/user/panelinha/[id]/atletas/route.ts - Gerenciar atletas da panelinha
// POST: Adicionar atleta à panelinha
// DELETE: Remover atleta da panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

// POST /api/user/panelinha/[id]/atletas - Adicionar atleta à panelinha
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id: panelinhaId } = await params;
    const body = await request.json();
    const { atletaId } = body;

    if (!atletaId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'ID do atleta é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe
    const panelinhaCheck = await query(
      'SELECT id, "atletaIdCriador" FROM "Panelinha" WHERE id = $1',
      [panelinhaId]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o atleta a ser adicionado existe
    const atletaCheck = await query(
      'SELECT id, nome FROM "Atleta" WHERE id = $1',
      [atletaId]
    );

    if (atletaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Adicionar atleta à panelinha (ON CONFLICT garante que não duplica)
    try {
      await query(
        `INSERT INTO "PanelinhaAtleta" (id, "panelinhaId", "atletaId", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, NOW())
         ON CONFLICT ("panelinhaId", "atletaId") DO NOTHING`,
        [panelinhaId, atletaId]
      );

      // Buscar dados atualizados do atleta adicionado
      const atletaAdicionado = await query(
        `SELECT 
          a.id,
          a.nome,
          a."fotoUrl",
          a.fone as telefone,
          a."dataNascimento",
          a.genero,
          a.categoria
         FROM "Atleta" a
         WHERE a.id = $1`,
        [atletaId]
      );

      const response = NextResponse.json({
        mensagem: 'Atleta adicionado à panelinha com sucesso',
        atleta: atletaAdicionado.rows[0],
      });

      return withCors(response, request);
    } catch (error: any) {
      // Se já existe, retornar sucesso
      if (error.code === '23505') {
        const atletaAdicionado = await query(
          `SELECT 
            a.id,
            a.nome,
            a."fotoUrl",
            a.fone as telefone,
            a."dataNascimento",
            a.genero,
            a.categoria
           FROM "Atleta" a
           WHERE a.id = $1`,
          [atletaId]
        );

        const response = NextResponse.json({
          mensagem: 'Atleta já está na panelinha',
          atleta: atletaAdicionado.rows[0],
        });

        return withCors(response, request);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao adicionar atleta:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao adicionar atleta à panelinha',
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

