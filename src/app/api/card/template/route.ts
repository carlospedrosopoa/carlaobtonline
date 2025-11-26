// app/api/card/template/route.ts - Gerenciar template padrão para cards
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { obterTemplatePadrao } from '@/lib/cardService';

/**
 * GET /api/card/template
 * Retorna a URL do template padrão atual (da variável de ambiente)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    // Verificar se é ADMIN (apenas admin pode ver/alterar template)
    const { user } = authResult;
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem gerenciar templates.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const templateUrl = obterTemplatePadrao();

    const response = NextResponse.json({
      templateUrl: templateUrl || null,
      mensagem: templateUrl 
        ? 'Template padrão configurado' 
        : 'Nenhum template padrão configurado. Use a variável de ambiente CARD_DEFAULT_TEMPLATE_URL.',
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[Card Template] Erro ao buscar template:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao buscar template padrão' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

/**
 * PUT /api/card/template
 * Atualiza a URL do template padrão (atualiza variável de ambiente)
 * 
 * NOTA: Esta rota apenas retorna informações sobre como configurar.
 * A variável de ambiente CARD_DEFAULT_TEMPLATE_URL deve ser configurada
 * diretamente no Vercel (Settings → Environment Variables) ou no .env.local
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    // Verificar se é ADMIN
    const { user } = authResult;
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem gerenciar templates.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { templateUrl } = body;

    if (!templateUrl || typeof templateUrl !== 'string') {
      const errorResponse = NextResponse.json(
        { mensagem: 'templateUrl é obrigatório e deve ser uma string (URL)' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar que é uma URL válida
    try {
      new URL(templateUrl);
    } catch {
      const errorResponse = NextResponse.json(
        { mensagem: 'templateUrl deve ser uma URL válida' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // IMPORTANTE: Não podemos alterar variáveis de ambiente em runtime
    // Esta rota apenas informa como configurar
    const response = NextResponse.json({
      mensagem: 'Para alterar o template padrão, configure a variável de ambiente CARD_DEFAULT_TEMPLATE_URL',
      instrucoes: {
        local: 'Adicione CARD_DEFAULT_TEMPLATE_URL=url-do-template no arquivo .env.local',
        vercel: 'Configure CARD_DEFAULT_TEMPLATE_URL em Settings → Environment Variables no Vercel',
        templateUrlSolicitado: templateUrl,
        observacao: 'Após configurar, faça um redeploy da aplicação para que a mudança tenha efeito.',
      },
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[Card Template] Erro ao atualizar template:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar requisição' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

