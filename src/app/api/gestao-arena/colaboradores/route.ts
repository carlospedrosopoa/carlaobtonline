// app/api/gestao-arena/colaboradores/route.ts - API de Colaboradores da Arena
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// OPTIONS /api/gestao-arena/colaboradores - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/gestao-arena/colaboradores - Listar colaboradores da arena
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem listar colaboradores
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');

    let pointIdFiltro = pointId;
    if (usuario.role === 'ORGANIZER') {
      // ORGANIZER só pode ver colaboradores da sua própria arena
      if (!usuario.pointIdGestor) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Arena não configurada para este usuário' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      pointIdFiltro = usuario.pointIdGestor;
    } else if (usuario.role === 'ADMIN' && !pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'pointId é obrigatório para ADMIN' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar colaboradores (role ORGANIZER com ehColaborador = true) da arena
    const result = await query(
      `SELECT 
        u.id, u.name, u.email, u.role, u."pointIdGestor", 
        u."ehColaborador", u."gestorId", u."createdAt",
        g.id as "gestor_id", g.name as "gestor_name", g.email as "gestor_email"
      FROM "User" u
      LEFT JOIN "User" g ON u."gestorId" = g.id
      WHERE u.role = 'ORGANIZER' 
        AND u."pointIdGestor" = $1
        AND (u."ehColaborador" = true OR u."gestorId" IS NOT NULL)
      ORDER BY u.name ASC`,
      [pointIdFiltro]
    );

    const colaboradores = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      pointIdGestor: row.pointIdGestor,
      ehColaborador: row.ehColaborador || false,
      gestorId: row.gestorId,
      createdAt: row.createdAt,
      gestor: row.gestor_id ? {
        id: row.gestor_id,
        name: row.gestor_name,
        email: row.gestor_email,
      } : null,
    }));

    const response = NextResponse.json(colaboradores);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar colaboradores:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar colaboradores', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/gestao-arena/colaboradores - Criar novo colaborador
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER (gestores, não colaboradores) podem criar colaboradores
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Colaboradores não podem criar outros colaboradores
    if (usuario.role === 'ORGANIZER' && usuario.ehColaborador) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Colaboradores não podem criar outros colaboradores' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { name, email, password, pointId } = body;

    if (!name || !email || !password || !pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome, email, senha e pointId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    let pointIdFinal = pointId;
    if (usuario.role === 'ORGANIZER') {
      // ORGANIZER só pode criar colaboradores na sua própria arena
      if (!usuario.pointIdGestor || usuario.pointIdGestor !== pointId) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você só pode criar colaboradores para sua própria arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
      pointIdFinal = usuario.pointIdGestor;
    }

    // Verificar se o point existe
    const pointCheck = await query('SELECT id FROM "Point" WHERE id = $1', [pointIdFinal]);
    if (pointCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Arena não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o email já existe
    const emailExistente = await query(
      'SELECT id FROM "User" WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (emailExistente.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Este e-mail já está cadastrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Criar hash da senha
    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    // Inserir colaborador (role ORGANIZER, ehColaborador = true, gestorId = usuario.id)
    await query(
      `INSERT INTO "User" (id, name, email, password, role, "pointIdGestor", "ehColaborador", "gestorId", "createdAt")
       VALUES ($1, $2, $3, $4, 'ORGANIZER', $5, true, $6, NOW())`,
      [id, name, email.toLowerCase().trim(), hash, pointIdFinal, usuario.id]
    );

    // Buscar colaborador criado
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

    const colaborador = result.rows[0];
    const response = NextResponse.json({
      mensagem: 'Colaborador criado com sucesso',
      colaborador: {
        id: colaborador.id,
        name: colaborador.name,
        email: colaborador.email,
        role: colaborador.role,
        pointIdGestor: colaborador.pointIdGestor,
        ehColaborador: colaborador.ehColaborador,
        gestorId: colaborador.gestorId,
        createdAt: colaborador.createdAt,
        gestor: colaborador.gestor_id ? {
          id: colaborador.gestor_id,
          name: colaborador.gestor_name,
          email: colaborador.gestor_email,
        } : null,
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar colaborador:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar colaborador', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

