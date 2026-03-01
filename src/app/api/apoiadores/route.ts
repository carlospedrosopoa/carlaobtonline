import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

export async function GET(request: NextRequest) {
  try {
    // Rota pública, não requer autenticação
    
    const { searchParams } = new URL(request.url);
    const regiaoId = searchParams.get('regiaoId');

    const whereRegiao = regiaoId
      ? ` AND (
            NOT EXISTS (
              SELECT 1
              FROM "RegiaoApoiador" ra0
              WHERE ra0."apoiadorId" = a.id
            )
            OR EXISTS (
              SELECT 1
              FROM "RegiaoApoiador" ra
              WHERE ra."apoiadorId" = a.id
                AND ra."regiaoId" = $1
            )
          )`
      : '';

    const values: any[] = [];
    if (regiaoId) values.push(regiaoId);

    const result = await query(
      `SELECT a.id, a.nome, a.latitude, a.longitude, a.instagram, a.whatsapp, a."logoUrl", a."exibirColorido"
       FROM "Apoiador" a
       WHERE a.ativo = true${whereRegiao}
       ORDER BY a.nome ASC`,
      values
    );

    return withCors(NextResponse.json(result.rows), request);
  } catch (error: any) {
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao listar apoiadores', error: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
