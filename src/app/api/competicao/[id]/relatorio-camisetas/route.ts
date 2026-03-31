import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const { id: competicaoId } = await params;

    const competicaoCheck = await query(
      `SELECT id, "pointId" FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );
    if (competicaoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json({ mensagem: 'Competição não encontrada' }, { status: 404 });
      return withCors(errorResponse, request);
    }

    const competicao = competicaoCheck.rows[0];
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicao.pointId) {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const result = await query(
      `SELECT DISTINCT a.id, a.nome, a."tipoCamiseta", a."tamanhoCamiseta"
       FROM "AtletaCompeticao" ac
       INNER JOIN "Atleta" a ON a.id = ac."atletaId"
       WHERE ac."competicaoId" = $1
         AND NULLIF(TRIM(COALESCE(a."tipoCamiseta", '')), '') IS NOT NULL
         AND NULLIF(TRIM(COALESCE(a."tamanhoCamiseta", '')), '') IS NOT NULL
       ORDER BY a.nome ASC`,
      [competicaoId]
    );

    const response = NextResponse.json(
      result.rows.map((row: any) => ({
        atletaId: row.id,
        nome: row.nome,
        tipoCamiseta: row.tipoCamiseta,
        tamanhoCamiseta: row.tamanhoCamiseta,
      }))
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao gerar relatório de camisetas:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao gerar relatório de camisetas', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
