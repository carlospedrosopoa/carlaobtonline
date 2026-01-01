// app/api/competicao/[id]/route.ts - Operações individuais de competição
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, base64ToBuffer } from '@/lib/googleCloudStorage';
import type { AtualizarCompeticaoPayload } from '@/types/competicao';

// GET /api/competicao/[id] - Obter competição por ID
export async function GET(
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

    const { id: competicaoId } = await params;

    // Buscar competição com atletas participantes
    const competicaoResult = await query(
      `SELECT 
        c.id, c."pointId", c."quadraId", c.nome, c.tipo, c.formato, c.status,
        c."dataInicio", c."dataFim", c.descricao, c."valorInscricao", c.premio, 
        c.regras, c."cardDivulgacaoUrl", c."fotoCompeticaoUrl", c."configSuper8", c."createdAt", c."updatedAt",
        p.id as "point_id", p.nome as "point_nome",
        q.id as "quadra_id", q.nome as "quadra_nome"
      FROM "Competicao" c
      LEFT JOIN "Point" p ON c."pointId" = p.id
      LEFT JOIN "Quadra" q ON c."quadraId" = q.id
      WHERE c.id = $1`,
      [competicaoId]
    );

    if (competicaoResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = competicaoResult.rows[0];

    // Verificar acesso (ORGANIZER só pode ver competições da sua arena)
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== row.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar atletas participantes (APENAS registros sem parceriaId - atletas individuais)
    // As duplas só existem nos jogos, não nos registros de atletas
    const atletasResult = await query(
      `SELECT DISTINCT ON (ac."atletaId")
        ac.id, ac."competicaoId", ac."atletaId", ac."parceriaId", ac."parceiroAtletaId",
        ac."posicaoFinal", ac.pontos, ac."createdAt",
        a.id as "atleta_id", a.nome as "atleta_nome", a."fotoUrl" as "atleta_fotoUrl", a.fone as "atleta_fone",
        a."usuarioId" as "atleta_usuarioId",
        u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
      FROM "AtletaCompeticao" ac
      LEFT JOIN "Atleta" a ON ac."atletaId" = a.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      WHERE ac."competicaoId" = $1
        AND ac."parceriaId" IS NULL
      ORDER BY ac."atletaId", ac."createdAt" ASC`,
      [competicaoId]
    );

    const atletasParticipantes = atletasResult.rows.map((atletaRow) => ({
      id: atletaRow.id,
      competicaoId: atletaRow.competicaoId,
      atletaId: atletaRow.atletaId,
      parceriaId: null, // Atletas individuais não têm parceriaId
      parceiroAtletaId: null, // Atletas individuais não têm parceiroAtletaId
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
      parceiro: null, // Atletas individuais não têm parceiro
    }));

    const competicao = {
      id: row.id,
      pointId: row.pointId,
      quadraId: row.quadraId || null,
      nome: row.nome,
      tipo: row.tipo,
      formato: row.formato,
      status: row.status,
      dataInicio: row.dataInicio ? new Date(row.dataInicio).toISOString() : null,
      dataFim: row.dataFim ? new Date(row.dataFim).toISOString() : null,
      descricao: row.descricao || null,
      valorInscricao: row.valorInscricao ? parseFloat(row.valorInscricao) : null,
      premio: row.premio || null,
      regras: row.regras || null,
      cardDivulgacaoUrl: row.cardDivulgacaoUrl || null,
      fotoCompeticaoUrl: row.fotoCompeticaoUrl || null,
      configSuper8: row.configSuper8 || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
      } : null,
      atletasParticipantes,
    };

    const response = NextResponse.json(competicao);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/competicao/[id] - Atualizar competição
export async function PUT(
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
    const body: AtualizarCompeticaoPayload = await request.json();

    // Processar cardDivulgacaoUrl: se for base64, fazer upload para GCS
    let cardDivulgacaoUrlProcessada: string | null | undefined = undefined;
    if (body.cardDivulgacaoUrl !== undefined) {
      if (body.cardDivulgacaoUrl && body.cardDivulgacaoUrl.startsWith('data:image/')) {
        try {
          const buffer = base64ToBuffer(body.cardDivulgacaoUrl);
          const mimeMatch = body.cardDivulgacaoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `competicao-card-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'competicoes');
          cardDivulgacaoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do card de divulgação:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do card de divulgação' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else {
        cardDivulgacaoUrlProcessada = body.cardDivulgacaoUrl;
      }
    }

    // Processar fotoCompeticaoUrl: se for base64, fazer upload para GCS
    let fotoCompeticaoUrlProcessada: string | null | undefined = undefined;
    if (body.fotoCompeticaoUrl !== undefined) {
      if (body.fotoCompeticaoUrl && body.fotoCompeticaoUrl.startsWith('data:image/')) {
        try {
          const buffer = base64ToBuffer(body.fotoCompeticaoUrl);
          const mimeMatch = body.fotoCompeticaoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `competicao-foto-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'competicoes');
          fotoCompeticaoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload da foto da competição:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload da foto da competição' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else {
        fotoCompeticaoUrlProcessada = body.fotoCompeticaoUrl;
      }
    }

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

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicaoCheck.rows[0].pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Construir SQL de atualização dinamicamente
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.quadraId !== undefined) {
      updates.push(`"quadraId" = $${paramCount}`);
      values.push(body.quadraId || null);
      paramCount++;
    }
    if (body.nome !== undefined) {
      updates.push(`nome = $${paramCount}`);
      values.push(body.nome);
      paramCount++;
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(body.status);
      paramCount++;
    }
    if (body.dataInicio !== undefined) {
      updates.push(`"dataInicio" = $${paramCount}`);
      values.push(body.dataInicio ? new Date(body.dataInicio).toISOString() : null);
      paramCount++;
    }
    if (body.dataFim !== undefined) {
      updates.push(`"dataFim" = $${paramCount}`);
      values.push(body.dataFim ? new Date(body.dataFim).toISOString() : null);
      paramCount++;
    }
    if (body.descricao !== undefined) {
      updates.push(`descricao = $${paramCount}`);
      values.push(body.descricao || null);
      paramCount++;
    }
    if (body.valorInscricao !== undefined) {
      updates.push(`"valorInscricao" = $${paramCount}`);
      values.push(body.valorInscricao || null);
      paramCount++;
    }
    if (body.premio !== undefined) {
      updates.push(`premio = $${paramCount}`);
      values.push(body.premio || null);
      paramCount++;
    }
    if (body.regras !== undefined) {
      updates.push(`regras = $${paramCount}`);
      values.push(body.regras || null);
      paramCount++;
    }
    if (cardDivulgacaoUrlProcessada !== undefined) {
      updates.push(`"cardDivulgacaoUrl" = $${paramCount}`);
      values.push(cardDivulgacaoUrlProcessada || null);
      paramCount++;
    }
    if (fotoCompeticaoUrlProcessada !== undefined) {
      updates.push(`"fotoCompeticaoUrl" = $${paramCount}`);
      values.push(fotoCompeticaoUrlProcessada || null);
      paramCount++;
    }
    if (body.configSuper8 !== undefined) {
      updates.push(`"configSuper8" = $${paramCount}`);
      values.push(body.configSuper8 ? JSON.stringify(body.configSuper8) : null);
      paramCount++;
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    updates.push(`"updatedById" = $${paramCount}`);
    values.push(usuario.id);
    paramCount++;
    values.push(competicaoId);

    await query(
      `UPDATE "Competicao" SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // Buscar competição atualizada (similar ao GET)
    const competicaoResult = await query(
      `SELECT 
        c.id, c."pointId", c."quadraId", c.nome, c.tipo, c.formato, c.status,
        c."dataInicio", c."dataFim", c.descricao, c."valorInscricao", c.premio, 
        c.regras, c."cardDivulgacaoUrl", c."fotoCompeticaoUrl", c."configSuper8", c."createdAt", c."updatedAt",
        p.id as "point_id", p.nome as "point_nome",
        q.id as "quadra_id", q.nome as "quadra_nome"
      FROM "Competicao" c
      LEFT JOIN "Point" p ON c."pointId" = p.id
      LEFT JOIN "Quadra" q ON c."quadraId" = q.id
      WHERE c.id = $1`,
      [competicaoId]
    );

    const row = competicaoResult.rows[0];
    const competicao = {
      id: row.id,
      pointId: row.pointId,
      quadraId: row.quadraId || null,
      nome: row.nome,
      tipo: row.tipo,
      formato: row.formato,
      status: row.status,
      dataInicio: row.dataInicio ? new Date(row.dataInicio).toISOString() : null,
      dataFim: row.dataFim ? new Date(row.dataFim).toISOString() : null,
      descricao: row.descricao || null,
      valorInscricao: row.valorInscricao ? parseFloat(row.valorInscricao) : null,
      premio: row.premio || null,
      regras: row.regras || null,
      cardDivulgacaoUrl: row.cardDivulgacaoUrl || null,
      fotoCompeticaoUrl: row.fotoCompeticaoUrl || null,
      configSuper8: row.configSuper8 || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
      } : null,
    };

    const response = NextResponse.json(competicao);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/competicao/[id] - Deletar competição
export async function DELETE(
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

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicaoCheck.rows[0].pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Deletar (cascade vai deletar AtletaCompeticao automaticamente)
    await query(`DELETE FROM "Competicao" WHERE id = $1`, [competicaoId]);

    const response = NextResponse.json({ mensagem: 'Competição deletada com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

