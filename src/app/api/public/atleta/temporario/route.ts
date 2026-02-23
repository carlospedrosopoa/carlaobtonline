// app/api/public/atleta/temporario/route.ts
// API pública para criar atleta temporário (sem cadastro completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { v4 as uuidv4 } from 'uuid';
import { createUserIncompleto } from '@/lib/userService';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/public/atleta/temporario
// Cria um atleta temporário com apenas nome e telefone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, telefone, pointId, usuarioId } = body;

    if (!nome || !nome.trim()) {
      return withCors(
        NextResponse.json({ mensagem: 'Nome é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!telefone || !telefone.trim()) {
      return withCors(
        NextResponse.json({ mensagem: 'Telefone é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!pointId) {
      return withCors(
        NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }),
        request
      );
    }

    // Verificar se o point existe
    const pointResult = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
    if (pointResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não encontrada' }, { status: 404 }),
        request
      );
    }

    // Normalizar telefone (remover formatação)
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Verificar se já existe um atleta com este telefone
    const atletaExistenteResult = await query(
      `SELECT id, nome, fone, "usuarioId" 
       FROM "Atleta" 
       WHERE fone = $1 
       ORDER BY "createdAt" DESC 
       LIMIT 1`,
      [telefoneNormalizado]
    );

    if (atletaExistenteResult.rows.length > 0) {
      // Atleta já existe, atualizar nome se necessário e retornar
      const atletaExistente = atletaExistenteResult.rows[0];
      
      // Se o nome for diferente, atualizar
      if (atletaExistente.nome !== nome.trim()) {
        await query(
          `UPDATE "Atleta" 
           SET nome = $1, "updatedAt" = NOW() 
           WHERE id = $2`,
          [nome.trim(), atletaExistente.id]
        );
      }

      return withCors(
        NextResponse.json({
          id: atletaExistente.id,
          nome: nome.trim(),
          telefone: telefoneNormalizado,
          temporario: !atletaExistente.usuarioId, // É temporário se não tiver usuarioId
          existente: true,
        }),
        request
      );
    }

    // Se não existe, criar novo atleta temporário
    // A tabela Atleta requer usuarioId NOT NULL.
    // Se não vier usuarioId, criamos um usuário incompleto (email/senha temporários) e o atleta vinculado.
    if (!usuarioId) {
      const criado = await createUserIncompleto(nome.trim(), telefoneNormalizado, 'USER', pointId);

      return withCors(
        NextResponse.json({
          id: criado.atletaId,
          nome: nome.trim(),
          telefone: telefoneNormalizado,
          temporario: true,
          existente: false,
        }),
        request
      );
    }

    const userCheck = await query('SELECT id FROM "User" WHERE id = $1', [usuarioId]);
    if (userCheck.rows.length === 0) {
      return withCors(
        NextResponse.json(
          { mensagem: 'usuarioId informado não existe no banco' },
          { status: 400 }
        ),
        request
      );
    }

    const atletaId = uuidv4();
    const dataNascimentoPadrao = new Date('2000-01-01');

    await query(
      `INSERT INTO "Atleta" (id, nome, fone, "dataNascimento", "usuarioId", "pointIdPrincipal", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [atletaId, nome.trim(), telefoneNormalizado, dataNascimentoPadrao, usuarioId, pointId]
    );

    return withCors(
      NextResponse.json({
        id: atletaId,
        nome: nome.trim(),
        telefone: telefoneNormalizado,
        temporario: true,
        existente: false,
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao criar atleta temporário:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao criar atleta temporário', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

