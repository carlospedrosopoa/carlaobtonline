// app/api/admin/platform-config/route.ts - Gerenciar configurações da plataforma (apenas ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import {
  obterTodasConfiguracoes,
  obterConfiguracaoCompleta,
  definirConfiguracao,
  obterConfiguracoesPorCategoria,
} from '@/lib/platformConfig';

// OPTIONS /api/admin/platform-config - Preflight CORS
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/admin/platform-config - Listar todas as configurações ou por categoria
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario || usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem acessar.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const chave = searchParams.get('chave');

    let configuracoes;

    if (chave) {
      // Buscar configuração específica
      const config = await obterConfiguracaoCompleta(chave);
      if (!config) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Configuração não encontrada' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }
      configuracoes = [config];
    } else if (categoria) {
      // Buscar por categoria
      configuracoes = await obterConfiguracoesPorCategoria(categoria);
    } else {
      // Buscar todas
      configuracoes = await obterTodasConfiguracoes();
    }

    const response = NextResponse.json({ configuracoes }, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar configurações da plataforma:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar configurações', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/admin/platform-config - Criar ou atualizar configuração
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario || usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem acessar.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { chave, valor, descricao, tipo, categoria } = body;

    if (!chave) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Chave é obrigatória' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const sucesso = await definirConfiguracao(
      chave,
      valor || '',
      descricao,
      tipo || 'texto',
      categoria || 'geral'
    );

    if (!sucesso) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro ao salvar configuração' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const config = await obterConfiguracaoCompleta(chave);
    const response = NextResponse.json(
      { mensagem: 'Configuração salva com sucesso', configuracao: config },
      { status: 200 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao salvar configuração da plataforma:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao salvar configuração', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}


