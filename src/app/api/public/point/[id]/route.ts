// app/api/public/point/[id]/route.ts
// API pública para buscar informações básicas de uma arena
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/public/point/[id] - Obter informações públicas de uma arena
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Retornar apenas informações públicas (sem dados sensíveis)
    const result = await query(
      `SELECT 
        p.id, p.nome, p.endereco, p.telefone, p.email, p.descricao, p."logoUrl", 
        p.latitude, p.longitude, p.ativo,
        (SELECT rp."regiaoId" FROM "RegiaoPoint" rp WHERE rp."pointId" = p.id LIMIT 1) as "regiaoId"
      FROM "Point" p
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não encontrada' }, { status: 404 }),
        request
      );
    }

    const point = result.rows[0];
    
    if (!point.ativo) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não está ativa' }, { status: 400 }),
        request
      );
    }

    return withCors(NextResponse.json(point), request);
  } catch (error: any) {
    console.error('Erro ao obter arena pública:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao obter informações da arena', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

