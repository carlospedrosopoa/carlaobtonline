// app/api/atleta/[id]/link-vinculo/route.ts - Gerar link de vínculo para atleta
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem gerar links
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem gerar links de vínculo' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: atletaId } = await params;

    // Buscar atleta
    const atletaResult = await query(
      'SELECT id, nome, fone FROM "Atleta" WHERE id = $1',
      [atletaId]
    );

    if (atletaResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const atleta = atletaResult.rows[0];

    if (!atleta.fone) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Atleta não possui telefone cadastrado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar telefone
    const telefoneNormalizado = atleta.fone.replace(/\D/g, '');

    // Gerar link de vínculo
    // O link aponta para a página de vínculo no appatleta com o telefone como parâmetro
    const baseUrl = process.env.NEXT_PUBLIC_APPATLETA_URL || 'https://atleta.playnaquadra.com.br';
    const linkVinculo = `${baseUrl}/vincular-conta?telefone=${telefoneNormalizado}`;

    const response = NextResponse.json({
      link: linkVinculo,
      telefone: telefoneNormalizado,
      nome: atleta.nome,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao gerar link de vínculo:', error);
    const errorResponse = NextResponse.json(
      {
        mensagem: error.message || 'Erro ao gerar link de vínculo',
        error: error.message,
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

