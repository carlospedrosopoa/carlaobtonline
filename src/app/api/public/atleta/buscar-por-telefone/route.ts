// app/api/public/atleta/buscar-por-telefone/route.ts
// API pública para buscar atleta por telefone
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/public/atleta/buscar-por-telefone?telefone=XXXXXXXXXXX
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telefone = searchParams.get('telefone');

    if (!telefone || !telefone.trim()) {
      return withCors(
        NextResponse.json({ mensagem: 'Telefone é obrigatório' }, { status: 400 }),
        request
      );
    }

    // Normalizar telefone (remover formatação)
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Buscar atleta pelo telefone
    const atletaResult = await query(
      `SELECT id, nome, fone, "usuarioId" 
       FROM "Atleta" 
       WHERE fone = $1 
       ORDER BY "createdAt" DESC 
       LIMIT 1`,
      [telefoneNormalizado]
    );

    if (atletaResult.rows.length === 0) {
      return withCors(
        NextResponse.json({
          encontrado: false,
          mensagem: 'Atleta não encontrado',
        }),
        request
      );
    }

    const atleta = atletaResult.rows[0];

    return withCors(
      NextResponse.json({
        encontrado: true,
        atleta: {
          id: atleta.id,
          nome: atleta.nome,
          telefone: atleta.fone,
          usuarioId: atleta.usuarioId,
          temUsuario: !!atleta.usuarioId,
        },
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao buscar atleta por telefone:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao buscar atleta', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

