// lib/cors.ts - Configuração de CORS para permitir consumo externo da API
import { NextRequest, NextResponse } from 'next/server';

// Domínios permitidos para consumir a API
// Configure via variável de ambiente ALLOWED_ORIGINS (separados por vírgula)
// Exemplo: ALLOWED_ORIGINS=https://parceiro1.com,https://parceiro2.com
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  // Em desenvolvimento, permite localhost
  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
  }
  // Em produção, retorna array vazio (nenhum domínio externo permitido por padrão)
  return [];
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

  // Verifica se a origem está na lista de permitidas
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  
  if (!isAllowed && allowedOrigins.length > 0) {
    // Origem não permitida - retorna headers vazios (será bloqueado pelo browser)
    return {};
  }

  // Headers CORS para origem permitida
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

