// app/api/admin/platform-config/[chave]/route.ts - Gerenciar configuração específica
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import {
  obterConfiguracaoCompleta,
  definirConfiguracao,
} from '@/lib/platformConfig';

// OPTIONS /api/admin/platform-config/[chave] - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/admin/platform-config/[chave] - Obter configuração específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chave: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario || usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem acessar.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { chave } = await params;
    const config = await obterConfiguracaoCompleta(chave);

    if (!config) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Configuração não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ configuracao: config }, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter configuração:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter configuração', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/admin/platform-config/[chave] - Atualizar configuração específica
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ chave: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario || usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem acessar.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { chave } = await params;
    const body = await request.json();
    const { valor, descricao, tipo, categoria } = body;

    // Buscar configuração existente para manter valores não fornecidos
    const configExistente = await obterConfiguracaoCompleta(chave);
    
    const sucesso = await definirConfiguracao(
      chave,
      valor !== undefined ? valor : configExistente?.valor || '',
      descricao !== undefined ? descricao : configExistente?.descricao || null,
      tipo || configExistente?.tipo || 'texto',
      categoria || configExistente?.categoria || 'geral'
    );

    if (!sucesso) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro ao atualizar configuração' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const config = await obterConfiguracaoCompleta(chave);
    const response = NextResponse.json(
      { mensagem: 'Configuração atualizada com sucesso', configuracao: config },
      { status: 200 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar configuração:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar configuração', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

