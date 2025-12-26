// app/api/competicao/[id]/route.ts - Operações individuais de competição
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
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
        c.regras, c."configSuper8", c."createdAt", c."updatedAt",
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

    // Buscar atletas participantes
    const atletasResult = await query(
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
      WHERE ac."competicaoId" = $1
      ORDER BY ac."createdAt" ASC`,
      [competicaoId]
    );

    const atletasParticipantes = atletasResult.rows.map((atletaRow) => ({
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
        c.regras, c."configSuper8", c."createdAt", c."updatedAt",
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

