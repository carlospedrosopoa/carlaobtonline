// app/api/user/getUsuarioLogado/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { getUsuarioById } from '@/lib/userService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      // Aplicar CORS também em erros de autenticação
      if (process.env.NODE_ENV === 'development') {
        console.log('[getUsuarioLogado] Erro de autenticação:', authResult.status);
      }
      return withCors(authResult, request);
    }

    const { user } = authResult;
    
    if (!user || !user.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[getUsuarioLogado] Dados do usuário inválidos:', { user });
      }
      const errorResponse = NextResponse.json(
        { mensagem: "Dados do usuário inválidos" },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[getUsuarioLogado] Buscando usuário com ID:', user.id);
    }

    const usuario = await getUsuarioById(user.id);

    if (!usuario) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[getUsuarioLogado] Usuário não encontrado no banco com ID:', user.id);
      }
      const errorResponse = NextResponse.json(
        { mensagem: "Usuário não encontrado" },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[getUsuarioLogado] Usuário encontrado:', { id: usuario.id, email: usuario.email, role: usuario.role });
    }

    const response = NextResponse.json(
      usuario,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('[getUsuarioLogado] Erro ao buscar usuário:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: "Erro ao buscar usuário",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



