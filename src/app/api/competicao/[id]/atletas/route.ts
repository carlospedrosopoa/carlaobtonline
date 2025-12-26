// app/api/competicao/[id]/atletas/route.ts - Gerenciar atletas da competição
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import type { AdicionarAtletaCompeticaoPayload } from '@/types/competicao';

// POST /api/competicao/[id]/atletas - Adicionar atleta à competição
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
    const body: AdicionarAtletaCompeticaoPayload = await request.json();
    const { atletaId, parceiroAtletaId } = body;

    if (!atletaId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'atletaId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

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

    // Verificar se atleta já está na competição
    const atletaExistente = await query(
      `SELECT id FROM "AtletaCompeticao" WHERE "competicaoId" = $1 AND "atletaId" = $2`,
      [competicaoId, atletaId]
    );

    if (atletaExistente.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta já está participando desta competição' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se for formato DUPLAS e tiver parceiro
    let parceriaId: string | null = null;
    if (competicao.formato === 'DUPLAS' && parceiroAtletaId) {
      // Verificar se parceiro já está em outra dupla nesta competição
      const parceiroExistente = await query(
        `SELECT id, "parceriaId" FROM "AtletaCompeticao" 
         WHERE "competicaoId" = $1 AND "atletaId" = $2`,
        [competicaoId, parceiroAtletaId]
      );

      if (parceiroExistente.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Parceiro já está participando desta competição' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      // Criar novo ID de parceria
      parceriaId = `parceria_${competicaoId}_${Date.now()}`;
    }

    // Adicionar atleta principal
    const result = await query(
      `INSERT INTO "AtletaCompeticao" (
        id, "competicaoId", "atletaId", "parceriaId", "parceiroAtletaId", pontos, "createdAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW()
      )
      RETURNING id`,
      [
        competicaoId,
        atletaId,
        parceriaId,
        parceiroAtletaId || null,
      ]
    );

    const atletaCompeticaoId = result.rows[0].id;

    // Se tiver parceiro, adicionar o parceiro também
    if (competicao.formato === 'DUPLAS' && parceiroAtletaId && parceriaId) {
      await query(
        `INSERT INTO "AtletaCompeticao" (
          id, "competicaoId", "atletaId", "parceriaId", "parceiroAtletaId", pontos, "createdAt"
        )
        VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW()
        )`,
        [
          competicaoId,
          parceiroAtletaId,
          parceriaId,
          atletaId,
        ]
      );
    }

    // Buscar atleta adicionado completo
    const atletaResult = await query(
      `SELECT 
        ac.id, ac."competicaoId", ac."atletaId", ac."parceriaId", ac."parceiroAtletaId",
        ac."posicaoFinal", ac.pontos, ac."createdAt",
        a.id as "atleta_id", a.nome as "atleta_nome", a."fotoUrl" as "atleta_fotoUrl", a.fone as "atleta_fone",
        a."usuarioId" as "atleta_usuarioId",
        u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
        p_atleta.id as "parceiro_id", p_atleta.nome as "parceiro_nome", p_atleta."fotoUrl" as "parceiro_fotoUrl"
      FROM "AtletaCompeticao" ac
      LEFT JOIN "Atleta" a ON ac."atletaId" = a.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Atleta" p_atleta ON ac."parceiroAtletaId" = p_atleta.id
      WHERE ac.id = $1`,
      [atletaCompeticaoId]
    );

    const atletaRow = atletaResult.rows[0];
    const atletaParticipante = {
      id: atletaRow.id,
      competicaoId: atletaRow.competicaoId,
      atletaId: atletaRow.atletaId,
      parceriaId: atletaRow.parceriaId || null,
      parceiroAtletaId: atletaRow.parceiroAtletaId || null,
      posicaoFinal: atletaRow.posicaoFinal || null,
      pontos: atletaRow.pontos ? parseFloat(atletaRow.pontos) : null,
      createdAt: new Date(atletaRow.createdAt).toISOString(),
      atleta: atletaRow.atleta_id ? {
        id: atletaRow.atleta_id,
        nome: atletaRow.atleta_nome,
        fotoUrl: atletaRow.atleta_fotoUrl || null,
        fone: atletaRow.atleta_fone || null,
        usuario: atletaRow.usuario_id ? {
          id: atletaRow.usuario_id,
          name: atletaRow.usuario_name,
          email: atletaRow.usuario_email,
        } : null,
      } : null,
      parceiro: atletaRow.parceiro_id ? {
        id: atletaRow.parceiro_id,
        nome: atletaRow.parceiro_nome,
        fotoUrl: atletaRow.parceiro_fotoUrl || null,
      } : null,
    };

    const response = NextResponse.json(atletaParticipante, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao adicionar atleta à competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao adicionar atleta à competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

