// lib/cors.ts - Configuração de CORS para permitir consumo externo da API
import { NextRequest, NextResponse } from 'next/server';

// Domínios permitidos para consumir a API
// Configure via variável de ambiente ALLOWED_ORIGINS (separados por vírgula)
// Exemplo: ALLOWED_ORIGINS=https://parceiro1.com,https://parceiro2.com,http://localhost:3000
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const origins: string[] = [];
  
  if (envOrigins) {
    // Se a variável está configurada, adiciona as origens configuradas
    origins.push(...envOrigins.split(',').map(origin => origin.trim()));
  }
  
  // Sempre permite localhost (mesmo que ALLOWED_ORIGINS esteja configurado)
  // Isso facilita o desenvolvimento local mesmo quando a API está em produção
  // É seguro porque localhost só funciona localmente
  const localhostOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
  localhostOrigins.forEach(origin => {
    if (!origins.includes(origin)) {
      origins.push(origin);
    }
  });

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const origin = `https://${vercelUrl}`;
    if (!origins.includes(origin)) {
      origins.push(origin);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const origin = new URL(appUrl).origin;
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    } catch {}
  }

  const defaultProdOrigins = [
    'https://playnaquadra.com.br',
    'https://www.playnaquadra.com.br',
    'https://appatleta.playnaquadra.com.br',
    'https://atleta.playnaquadra.com.br',
  ];
  defaultProdOrigins.forEach((origin) => {
    if (!origins.includes(origin)) {
      origins.push(origin);
    }
  });
  
  return origins;
};

// Headers CORS padrão
// IMPORTANTE: Requisições do mesmo domínio (sem header Origin) não recebem headers CORS
// Isso garante que o funcionamento atual do frontend não é afetado
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  
  // Se não há origem na requisição (ex: requisição do mesmo domínio), não precisa de CORS
  // O browser só envia o header "Origin" em requisições cross-origin
  // Requisições do mesmo domínio funcionam normalmente sem headers CORS
  if (!origin) {
    return {}; // Retorna vazio = nenhum header CORS adicionado = funcionamento normal
  }

  // Sempre permite localhost (seguro porque só funciona localmente)
  const isLocalhost = origin && (
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:')
  );
  
  const debug = process.env.NODE_ENV !== 'production';
  if (debug) {
    console.log('[CORS DEBUG] Origin recebida:', origin);
    console.log('[CORS DEBUG] Origens permitidas:', allowedOrigins);
    console.log('[CORS DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[CORS DEBUG] É localhost?', isLocalhost);
  }
  
  // Verifica se a origem está na lista de permitidas
  // Sempre permite localhost, mesmo que não esteja na lista
  const isAllowed = isLocalhost || allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  
  if (debug) {
    console.log('[CORS DEBUG] Origem permitida?', isAllowed);
    console.log('[CORS DEBUG] Match exato?', allowedOrigins.includes(origin));
    console.log('[CORS DEBUG] allowedOrigins.length:', allowedOrigins.length);
    console.log('[CORS DEBUG] envOrigins existe?', !!process.env.ALLOWED_ORIGINS);
  }
  
  // Se não está permitida E há origens configuradas (exceto apenas localhost), bloqueia
  // Se não há origens configuradas (apenas localhost), também bloqueia (segurança)
  const hasNonLocalhostOrigins = allowedOrigins.some(o => !o.startsWith('http://localhost:') && !o.startsWith('http://127.0.0.1:'));
  
  if (!isAllowed) {
    // Origem não permitida - retorna headers vazios (será bloqueado pelo browser)
    if (debug) {
      console.log('[CORS DEBUG] ❌ Origem NÃO permitida - bloqueando requisição');
      console.log('[CORS DEBUG] Tem origens não-localhost?', hasNonLocalhostOrigins);
    }
    return {};
  }
  
  if (isAllowed) {
    if (debug) {
      console.log('[CORS DEBUG] ✅ Origem permitida - adicionando headers CORS');
    }
  }

  // Headers CORS para origem permitida
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Client_APP, X-Client-APP',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 horas
  };
}

// Handler para requisições OPTIONS (preflight)
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  // Se não há headers CORS, não é uma requisição CORS válida
  if (Object.keys(headers).length === 0) {
    return null;
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

// Wrapper para adicionar headers CORS em respostas
export function withCors(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Adiciona headers CORS à resposta
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
