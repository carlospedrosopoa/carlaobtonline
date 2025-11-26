// app/api/card/template/test/route.ts - Testar configuração de template
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { obterTemplatePadrao } from '@/lib/cardService';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const templateUrl = obterTemplatePadrao();
    
    // Testar se a URL é acessível
    let urlAcessivel = false;
    let erroAcesso: string | null = null;
    let tamanhoArquivo: number | null = null;
    
    if (templateUrl) {
      try {
        // Normalizar URL se necessário
        const urlNormalizada = templateUrl.includes('storage.cloud.google.com')
          ? templateUrl.replace('storage.cloud.google.com', 'storage.googleapis.com')
          : templateUrl;
        
        console.log('[Template Test] Testando URL:', urlNormalizada);
        const response = await axios.get(urlNormalizada, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'Accept': 'image/*',
          },
        });
        
        if (response.status === 200 && response.data) {
          urlAcessivel = true;
          tamanhoArquivo = Buffer.from(response.data).length;
          console.log('[Template Test] ✅ URL acessível, tamanho:', tamanhoArquivo, 'bytes');
        }
      } catch (error: any) {
        erroAcesso = error.message;
        console.error('[Template Test] ❌ Erro ao acessar URL:', error.message);
      }
    }

    const response = NextResponse.json({
      templateUrl: templateUrl || null,
      urlNormalizada: templateUrl && templateUrl.includes('storage.cloud.google.com')
        ? templateUrl.replace('storage.cloud.google.com', 'storage.googleapis.com')
        : templateUrl,
      urlAcessivel,
      tamanhoArquivo,
      erroAcesso,
      variavelAmbienteDefinida: !!process.env.CARD_DEFAULT_TEMPLATE_URL,
      todasVariaveisAmbiente: Object.keys(process.env)
        .filter(key => key.includes('CARD') || key.includes('TEMPLATE'))
        .reduce((acc, key) => {
          acc[key] = process.env[key]?.substring(0, 50) + '...';
          return acc;
        }, {} as Record<string, string>),
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[Template Test] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao testar template',
        error: error.message,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

