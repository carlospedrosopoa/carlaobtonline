// app/api/atleta/me/atleta/route.ts
// ⚠️ DEPRECATED: Esta rota está mantida para compatibilidade.
// Use /api/user/perfil/atleta para novas implementações.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
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
      const noContentResponse = new NextResponse(null, { 
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      });
      return withCors(noContentResponse, request);
    }

    const response = NextResponse.json(
      atleta,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao buscar atleta:', error);
    const errorResponse = NextResponse.json(
      { mensagem: "Erro ao buscar atleta" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

