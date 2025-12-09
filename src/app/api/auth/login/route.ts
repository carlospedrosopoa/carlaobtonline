// app/api/auth/login/route.ts
// ⚠️ DEPRECATED: Esta rota está mantida para compatibilidade.
// Use /api/user/auth/login para novas implementações.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  // Handler para requisições preflight (CORS)
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailRaw = (body?.email ?? "") as string;
    const senha = (body?.password ?? body?.senha ?? "") as string;
    const email = emailRaw.trim().toLowerCase();

    if (!email || !senha) {
      const errorResponse = NextResponse.json(
        { mensagem: "Informe email e senha." },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Debug: log do email sendo buscado
    console.log('[LOGIN DEBUG] Buscando usuário com email:', email);
    
    // Garantir que a busca use o email normalizado (lowercase/trim) igual à criação
    const emailNormalizado = email.toLowerCase().trim();
    console.log('[LOGIN DEBUG] Email normalizado (lowercase/trim):', emailNormalizado);
    
    const result = await query('SELECT * FROM "User" WHERE email = $1', [emailNormalizado]);
    const usuarioDb = result.rows[0];
    
    // Debug: log do resultado da busca
    console.log('[LOGIN DEBUG] Resultado da busca:', {
      encontrado: !!usuarioDb,
      id: usuarioDb?.id,
      email: usuarioDb?.email,
      emailNormalizado: usuarioDb?.email?.toLowerCase().trim(),
      temAtletaId: usuarioDb?.atletaId !== undefined && usuarioDb?.atletaId !== null,
      atletaId: usuarioDb?.atletaId,
      role: usuarioDb?.role
    });
    
    if (!usuarioDb) {
      console.log('[LOGIN DEBUG] ❌ Usuário não encontrado no banco de dados');
      const errorResponse = NextResponse.json(
        { mensagem: "Usuário não encontrado" },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const senhaHash = (usuarioDb as any).password ?? (usuarioDb as any).senhaHash ?? "";
    if (!senhaHash) {
      const errorResponse = NextResponse.json(
        { mensagem: "Erro na configuração do usuário" },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const ok = await bcrypt.compare(senha, senhaHash);
    if (!ok) {
      const errorResponse = NextResponse.json(
        { mensagem: "Senha incorreta" },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    const usuario = {
      id: usuarioDb.id,
      nome: (usuarioDb as any).name ?? (usuarioDb as any).nome ?? "",
      email: usuarioDb.email,
      role: (usuarioDb as any).role ?? "USER",
      atletaId: (usuarioDb as any).atletaId !== undefined ? (usuarioDb as any).atletaId : undefined,
      pointIdGestor: (usuarioDb as any).pointIdGestor !== undefined ? (usuarioDb as any).pointIdGestor : undefined,
    };

    // Gerar tokens JWT
    const accessToken = generateAccessToken(usuario);
    const refreshToken = generateRefreshToken(usuario);

    const response = NextResponse.json(
      { 
        usuario,
        user: usuario,  // Alias para compatibilidade
        token: accessToken,  // Token JWT de acesso
        refreshToken: refreshToken,  // Refresh token
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
    
    // Aplica headers CORS para permitir consumo externo
    return withCors(response, request);
  } catch (error: any) {
    console.error("login error:", error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: "Erro ao efetuar login",
        error: error?.message || "Erro desconhecido"
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}



