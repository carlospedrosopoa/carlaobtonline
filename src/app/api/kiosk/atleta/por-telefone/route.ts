import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { requireKioskAuth } from '@/lib/kioskAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pointId = String(body?.pointId || '').trim();
    const telefoneRaw = String(body?.telefone || '').trim();

    if (!pointId) {
      return withCors(NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }), request);
    }

    const auth = await requireKioskAuth(request, pointId);
    if (auth instanceof NextResponse) {
      return withCors(auth, request);
    }

    if (!telefoneRaw) {
      return withCors(NextResponse.json({ mensagem: 'telefone é obrigatório' }, { status: 400 }), request);
    }

    const telefone = telefoneRaw.replace(/\D/g, '');
    if (telefone.length < 10) {
      return withCors(NextResponse.json({ mensagem: 'telefone inválido' }, { status: 400 }), request);
    }

    const result = await query(
      `SELECT a.id, a.nome, a.fone as telefone
       FROM "Atleta" a
       WHERE REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') = $1
         AND a."pointIdPrincipal" = $2
       ORDER BY a."createdAt" DESC
       LIMIT 1`,
      [telefone, pointId]
    );

    if (result.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Atleta não encontrado', codigo: 'ATLETA_NAO_ENCONTRADO' }, { status: 404 }),
        request
      );
    }

    const atleta = result.rows[0];
    return withCors(NextResponse.json({ atleta: { id: atleta.id, nome: atleta.nome, telefone: atleta.telefone } }), request);
  } catch (error: any) {
    console.error('Erro ao buscar atleta por telefone (kiosk):', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao buscar atleta', erro: error.message }, { status: 500 }),
      request
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

