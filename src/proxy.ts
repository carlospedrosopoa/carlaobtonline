// proxy.ts - Proxy global do Next.js para CORS
import { NextRequest, NextResponse } from 'next/server';
import { handleCorsPreflight, withCors } from '@/lib/cors';

export function proxy(request: NextRequest) {
  // Aplica CORS apenas para rotas da API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Handle preflight requests (OPTIONS)
    if (request.method === 'OPTIONS') {
      const preflightResponse = handleCorsPreflight(request);
      if (preflightResponse) {
        return preflightResponse;
      }
      // Se não há CORS configurado, retorna 204 sem headers
      return new NextResponse(null, { status: 204 });
    }

    // Para outras requisições, o CORS será aplicado nas rotas individuais
    // usando a função withCors() ao retornar a resposta
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

