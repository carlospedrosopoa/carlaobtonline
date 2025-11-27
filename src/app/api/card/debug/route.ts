// app/api/card/debug/route.ts - Endpoint de diagnóstico para problemas com template
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { obterTemplatePadrao } from '@/lib/cardService';
import axios from 'axios';
import { getSignedUrl, extractFileNameFromUrl } from '@/lib/googleCloudStorage';

// Função para normalizar URL do GCS
function normalizarUrlGCS(url: string): string {
  if (url.includes('storage.cloud.google.com')) {
    return url.replace('storage.cloud.google.com', 'storage.googleapis.com');
  }
  return url;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    // Verificar se é ADMIN
    if (authResult.user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem acessar este endpoint.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const templatePadrao = obterTemplatePadrao();
    const diagnosticos: any = {
      variavelAmbienteDefinida: !!process.env.CARD_DEFAULT_TEMPLATE_URL,
      templatePadrao: templatePadrao || null,
      ambiente: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    if (templatePadrao) {
      const urlNormalizada = normalizarUrlGCS(templatePadrao);
      diagnosticos.urlNormalizada = urlNormalizada;
      
      // Tentar acessar a URL
      try {
        const response = await axios.head(urlNormalizada, { 
          timeout: 5000,
          validateStatus: (status) => status < 500, // Aceitar qualquer status < 500
        });
        
        diagnosticos.statusHttp = response.status;
        diagnosticos.headers = {
          'content-type': response.headers['content-type'],
          'content-length': response.headers['content-length'],
        };
        
        if (response.status === 200) {
          diagnosticos.acessivel = true;
        } else if (response.status === 403) {
          diagnosticos.acessivel = false;
          diagnosticos.erro = 'Arquivo não está público (403 Forbidden)';
          
          // Tentar gerar Signed URL
          const fileName = extractFileNameFromUrl(urlNormalizada);
          if (fileName) {
            diagnosticos.fileNameExtraido = fileName;
            try {
              const signedUrl = await getSignedUrl(fileName, 3600);
              if (signedUrl) {
                diagnosticos.signedUrlGerada = true;
                diagnosticos.signedUrlPreview = signedUrl.substring(0, 100) + '...';
                
                // Testar Signed URL
                const signedResponse = await axios.head(signedUrl, { timeout: 5000 });
                diagnosticos.signedUrlStatus = signedResponse.status;
                diagnosticos.signedUrlAcessivel = signedResponse.status === 200;
              } else {
                diagnosticos.signedUrlGerada = false;
                diagnosticos.erroSignedUrl = 'Não foi possível gerar Signed URL';
              }
            } catch (signedError: any) {
              diagnosticos.erroSignedUrl = signedError.message;
            }
          } else {
            diagnosticos.erroExtracaoFileName = 'Não foi possível extrair nome do arquivo da URL';
          }
        } else if (response.status === 404) {
          diagnosticos.acessivel = false;
          diagnosticos.erro = 'Arquivo não encontrado (404 Not Found)';
        } else {
          diagnosticos.acessivel = false;
          diagnosticos.erro = `Status HTTP inesperado: ${response.status}`;
        }
      } catch (error: any) {
        diagnosticos.acessivel = false;
        diagnosticos.erro = error.message;
        diagnosticos.erroTipo = error.code || 'UNKNOWN';
        
        if (error.response) {
          diagnosticos.statusHttp = error.response.status;
          diagnosticos.erroDetalhes = error.response.data;
        }
      }
    } else {
      diagnosticos.erro = 'Variável CARD_DEFAULT_TEMPLATE_URL não está definida';
    }

    // Verificar configuração do GCS
    diagnosticos.gcsConfigurado = {
      projectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      bucket: !!process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
      projectIdValue: process.env.GOOGLE_CLOUD_PROJECT_ID || null,
      bucketValue: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || null,
    };

    const response = NextResponse.json(diagnosticos, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[Card Debug] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao executar diagnóstico',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

