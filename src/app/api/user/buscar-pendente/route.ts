// app/api/user/buscar-pendente/route.ts - Buscar usuário pendente por telefone
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefone } = body;

    if (!telefone) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Telefone é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar telefone
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Buscar atleta com este telefone que tenha usuário com email temporário (pendente)
    const result = await query(
      `SELECT a.id as "atletaId", a.nome as "nomeAtleta", a."usuarioId", 
              u.id as "usuarioId", u.name as "nomeUsuario", u.email
       FROM "Atleta" a
       INNER JOIN "User" u ON a."usuarioId" = u.id
       WHERE REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') = $1
         AND u.email LIKE 'temp_%@pendente.local'
       LIMIT 1`,
      [telefoneNormalizado]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        {
          mensagem: 'Telefone não encontrado. Verifique o número e tente novamente, ou crie uma nova conta.',
          codigo: 'TELEFONE_NAO_ENCONTRADO'
        },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const usuarioPendente = result.rows[0];
    
    const response = NextResponse.json({
      encontrado: true,
      telefone: telefoneNormalizado,
      nome: usuarioPendente.nomeUsuario || usuarioPendente.nomeAtleta,
      atletaId: usuarioPendente.atletaId,
      usuarioId: usuarioPendente.usuarioId,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao buscar usuário pendente:', error);
    const errorResponse = NextResponse.json(
      {
        mensagem: 'Erro ao buscar telefone. Tente novamente.',
        error: error.message
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

