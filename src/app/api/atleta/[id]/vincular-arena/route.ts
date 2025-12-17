// app/api/atleta/[id]/vincular-arena/route.ts - Vincular atleta à arena do organizer
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Apenas ADMIN e ORGANIZER podem vincular atletas
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem vincular atletas' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const atletaId = params.id;
    const pointId = usuario.pointIdGestor;

    if (!pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Organizer deve ter uma arena associada' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se atleta existe
    const atletaCheck = await query('SELECT id, nome FROM "Atleta" WHERE id = $1', [atletaId]);
    if (atletaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se já está vinculado (como arena principal ou nas arenas que frequenta)
    const atleta = atletaCheck.rows[0];
    const atletaCompleto = await query(
      `SELECT a."pointIdPrincipal", ap."pointId" as "pointIdFrequente"
       FROM "Atleta" a
       LEFT JOIN "AtletaPoint" ap ON a.id = ap."atletaId" AND ap."pointId" = $1
       WHERE a.id = $2`,
      [pointId, atletaId]
    );

    const jaVinculado = atletaCompleto.rows[0]?.pointIdPrincipal === pointId || 
                         atletaCompleto.rows[0]?.pointIdFrequente === pointId;

    if (jaVinculado) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta já está vinculado a esta arena' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Vincular: adicionar nas arenas que frequenta
    // Se não tiver arena principal, definir esta como principal também
    const temArenaPrincipal = atletaCompleto.rows[0]?.pointIdPrincipal !== null;
    
    if (!temArenaPrincipal) {
      // Definir como arena principal
      await query(
        'UPDATE "Atleta" SET "pointIdPrincipal" = $1 WHERE id = $2',
        [pointId, atletaId]
      );
    }

    // Adicionar nas arenas que frequenta (se não estiver)
    try {
      await query(
        'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("atletaId", "pointId") DO NOTHING',
        [atletaId, pointId]
      );
    } catch (error: any) {
      // Se a tabela não existir, apenas logar (não é crítico)
      if (!error.message?.includes('does not exist')) {
        throw error;
      }
      console.warn('Tabela AtletaPoint não encontrada, apenas definindo como arena principal');
    }

    const response = NextResponse.json({
      mensagem: 'Atleta vinculado à arena com sucesso',
      atleta: {
        id: atleta.id,
        nome: atleta.nome,
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao vincular atleta à arena:', error);
    const errorResponse = NextResponse.json(
      {
        mensagem: error.message || 'Erro ao vincular atleta à arena',
        error: error.message,
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

