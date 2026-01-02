// app/api/gestao-arena/colaboradores/[id]/route.ts - API de Colaborador Individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import bcrypt from 'bcryptjs';

// OPTIONS /api/gestao-arena/colaboradores/[id] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// PUT /api/gestao-arena/colaboradores/[id] - Atualizar colaborador
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

    // Apenas ADMIN e ORGANIZER (gestores, não colaboradores) podem atualizar colaboradores
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Colaboradores não podem atualizar outros colaboradores
    if (usuario.role === 'ORGANIZER' && usuario.ehColaborador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Colaboradores não podem atualizar outros colaboradores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, password } = body;

    // Verificar se o colaborador existe
    const colaboradorCheck = await query(
      `SELECT id, "pointIdGestor", "gestorId", role, "ehColaborador"
       FROM "User" WHERE id = $1`,
      [id]
    );

    if (colaboradorCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Colaborador não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const colaborador = colaboradorCheck.rows[0];

    // Verificar se é realmente um colaborador
    if (colaborador.role !== 'ORGANIZER' || !colaborador.ehColaborador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não é um colaborador' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    if (usuario.role === 'ORGANIZER') {
      // ORGANIZER só pode atualizar colaboradores da sua própria arena
      if (!usuario.pointIdGestor || usuario.pointIdGestor !== colaborador.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você só pode atualizar colaboradores da sua própria arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Construir query de atualização
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (email !== undefined) {
      // Verificar se o email já existe (exceto para este usuário)
      const emailExistente = await query(
        'SELECT id FROM "User" WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), id]
      );
      if (emailExistente.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Este e-mail já está cadastrado' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email.toLowerCase().trim());
    }

    if (password !== undefined && password !== '') {
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password = $${paramCount++}`);
      values.push(hash);
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    await query(
      `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // Buscar colaborador atualizado
    const result = await query(
      `SELECT 
        u.id, u.name, u.email, u.role, u."pointIdGestor", 
        u."ehColaborador", u."gestorId", u."createdAt",
        g.id as "gestor_id", g.name as "gestor_name", g.email as "gestor_email"
      FROM "User" u
      LEFT JOIN "User" g ON u."gestorId" = g.id
      WHERE u.id = $1`,
      [id]
    );

    const colaboradorAtualizado = result.rows[0];
    const response = NextResponse.json({
      mensagem: 'Colaborador atualizado com sucesso',
      colaborador: {
        id: colaboradorAtualizado.id,
        name: colaboradorAtualizado.name,
        email: colaboradorAtualizado.email,
        role: colaboradorAtualizado.role,
        pointIdGestor: colaboradorAtualizado.pointIdGestor,
        ehColaborador: colaboradorAtualizado.ehColaborador,
        gestorId: colaboradorAtualizado.gestorId,
        createdAt: colaboradorAtualizado.createdAt,
        gestor: colaboradorAtualizado.gestor_id ? {
          id: colaboradorAtualizado.gestor_id,
          name: colaboradorAtualizado.gestor_name,
          email: colaboradorAtualizado.gestor_email,
        } : null,
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar colaborador:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar colaborador', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/gestao-arena/colaboradores/[id] - Remover/Desativar colaborador
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

    // Apenas ADMIN e ORGANIZER (gestores, não colaboradores) podem remover colaboradores
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Colaboradores não podem remover outros colaboradores
    if (usuario.role === 'ORGANIZER' && usuario.ehColaborador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Colaboradores não podem remover outros colaboradores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    // Verificar se o colaborador existe
    const colaboradorCheck = await query(
      `SELECT id, "pointIdGestor", role, "ehColaborador"
       FROM "User" WHERE id = $1`,
      [id]
    );

    if (colaboradorCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Colaborador não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const colaborador = colaboradorCheck.rows[0];

    // Verificar se é realmente um colaborador
    if (colaborador.role !== 'ORGANIZER' || !colaborador.ehColaborador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não é um colaborador' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    if (usuario.role === 'ORGANIZER') {
      // ORGANIZER só pode remover colaboradores da sua própria arena
      if (!usuario.pointIdGestor || usuario.pointIdGestor !== colaborador.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você só pode remover colaboradores da sua própria arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Não permitir que o usuário remova a si mesmo
    if (usuario.id === id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não pode remover seu próprio usuário' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Remover colaborador (DELETE físico - pode ser alterado para soft delete no futuro)
    await query('DELETE FROM "User" WHERE id = $1', [id]);

    const response = NextResponse.json({
      mensagem: 'Colaborador removido com sucesso',
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao remover colaborador:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao remover colaborador', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

