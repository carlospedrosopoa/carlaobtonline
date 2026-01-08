// app/api/atleta/criar-avulso/route.ts - Criar atleta avulso temporário (para participantes de agendamento)
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// OPTIONS /api/atleta/criar-avulso - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/atleta/criar-avulso - Criar atleta avulso temporário
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

    // Apenas ADMIN e ORGANIZER podem criar atletas avulsos
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para criar atletas avulsos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { nome, fone, pointId } = body;

    if (!nome || !nome.trim()) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (!pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'pointId é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o usuário tem acesso ao pointId
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem acesso a esta arena' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Criar atleta avulso (sem usuarioId e com dataNascimento padrão)
    const id = uuidv4();
    // Usar data de nascimento padrão (1 de janeiro de 2000) para atletas avulsos
    const dataNascimentoPadrao = new Date('2000-01-01');

    await query(
      `INSERT INTO "Atleta" (id, nome, "dataNascimento", fone, "usuarioId", "pointIdPrincipal", "aceitaLembretesAgendamento", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, NULL, $5, $6, NOW(), NOW())`,
      [id, nome.trim(), dataNascimentoPadrao, fone || null, pointId, true]
    );

    // Vincular atleta à arena
    try {
      await query(
        'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("atletaId", "pointId") DO NOTHING',
        [id, pointId]
      );
    } catch (error: any) {
      console.warn('Erro ao vincular atleta à arena (tabela pode não existir ainda):', error?.message);
      // Continua mesmo se houver erro - a tabela pode não existir ainda
    }

    // Buscar atleta criado
    const atletaResult = await query(
      `SELECT a.*, 
              u.id as "usuario_id", 
              u.name as "usuario_name", 
              u.email as "usuario_email"
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id 
       WHERE a.id = $1`,
      [id]
    );

    if (atletaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro ao criar atleta avulso' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const atleta = atletaResult.rows[0];
    const atletaResponse = {
      id: atleta.id,
      nome: atleta.nome,
      dataNascimento: atleta.dataNascimento,
      fone: atleta.fone,
      usuarioId: atleta.usuario_id || null,
      usuario: atleta.usuario_id ? {
        id: atleta.usuario_id,
        name: atleta.usuario_name,
        email: atleta.usuario_email,
      } : null,
      pointIdPrincipal: atleta.pointIdPrincipal,
      createdAt: atleta.createdAt,
      updatedAt: atleta.updatedAt,
    };

    const response = NextResponse.json(atletaResponse, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar atleta avulso:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao criar atleta avulso' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

