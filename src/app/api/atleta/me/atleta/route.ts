// app/api/atleta/me/atleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verificarAtletaUsuario } from '@/lib/atletaService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const atleta = await verificarAtletaUsuario(user.id);

    if (!atleta) {
      // Retorna 204 No Content sem body
      return new NextResponse(null, { 
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      });
    }

    return NextResponse.json(
      atleta,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error) {
    console.error('Erro ao buscar atleta:', error);
    return NextResponse.json(
      { mensagem: "Erro ao buscar atleta" },
      { status: 500 }
    );
  }
}

