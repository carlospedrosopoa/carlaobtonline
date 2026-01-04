// app/api/admin/info/route.ts - Informações do sistema para admin
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    
    // Apenas ADMIN pode acessar essas informações
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: "Acesso negado" },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Extrair nome do banco de dados da DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL || '';
    let databaseName = 'N/A';
    
    if (databaseUrl) {
      try {
        // Formato: postgresql://user:pass@host:port/dbname?params
        const urlMatch = databaseUrl.match(/postgresql:\/\/[^@]+@[^/]+\/([^?]+)/);
        if (urlMatch && urlMatch[1]) {
          databaseName = urlMatch[1];
        }
      } catch (error) {
        console.error('Erro ao extrair nome do banco:', error);
      }
    }

    const info = {
      databaseName,
      environment: process.env.NODE_ENV || 'development',
    };

    const response = NextResponse.json(info, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao obter informações do sistema:', error);
    const errorResponse = NextResponse.json(
      { mensagem: "Erro ao obter informações do sistema" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

