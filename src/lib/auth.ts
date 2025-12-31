// lib/auth.ts - Autenticação JWT + Basic Auth (compatibilidade)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "./db";
import { verifyToken, type JwtPayload } from "./jwt";

// Tipo User
export type User = {
  id: string;
  email: string;
  nome: string;
  role: string;
  atletaId?: string | null;
  pointIdGestor?: string | null;
  ehColaborador?: boolean | null;
  gestorId?: string | null;
};

// Verifica JWT Bearer Token e retorna o usuário
export async function verifyJwtAuth(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = verifyToken(token);
    
    if (!payload) {
      return null;
    }

    // Converter JwtPayload para User
    return {
      id: payload.id,
      email: payload.email,
      nome: payload.nome,
      role: payload.role,
      atletaId: payload.atletaId,
      pointIdGestor: payload.pointIdGestor,
      ehColaborador: payload.ehColaborador,
      gestorId: payload.gestorId,
    };
  } catch (e) {
    console.error("verifyJwtAuth error:", e);
    return null;
  }
}

// Verifica Basic Auth e retorna o usuário (mantido para compatibilidade)
export async function verifyBasicAuth(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader?.startsWith("Basic ")) {
    return null;
  }

  try {
    const base64 = authHeader.slice("Basic ".length);
    const decoded = Buffer.from(base64, "base64").toString("utf8");

    const idx = decoded.indexOf(":");
    const emailRaw = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const senha = idx >= 0 ? decoded.slice(idx + 1) : "";

    const email = emailRaw.trim().toLowerCase();
    if (!email || !senha) {
      return null;
    }

    const result = await query('SELECT * FROM "User" WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return null;
    }

    const hash = (user as any).password ?? (user as any).senhaHash ?? "";
    const ok = await bcrypt.compare(senha, hash);
    if (!ok) {
      return null;
    }

    return shapeUsuario(user);
  } catch (e) {
    console.error("verifyBasicAuth error:", e);
    return null;
  }
}

// Helper para formatar usuário
function shapeUsuario(user: any): User {
  const nome = user.name ?? user.nome ?? "";
  const role = user.role ?? "USER";
  const atletaId = user.atletaId !== undefined ? user.atletaId : undefined;
  const pointIdGestor = user.pointIdGestor !== undefined ? user.pointIdGestor : undefined;
  const ehColaborador = user.ehColaborador !== undefined ? user.ehColaborador : undefined;
  const gestorId = user.gestorId !== undefined ? user.gestorId : undefined;

  return { 
    id: user.id, 
    nome, 
    role, 
    atletaId,
    pointIdGestor,
    ehColaborador,
    gestorId,
    email: user.email 
  };
}

// Verifica autenticação (tenta JWT primeiro, depois Basic Auth para compatibilidade)
export async function verifyAuth(request: NextRequest): Promise<User | null> {
  // Tenta JWT primeiro (método preferido)
  const jwtUser = await verifyJwtAuth(request);
  if (jwtUser) {
    return jwtUser;
  }

  // Fallback para Basic Auth (compatibilidade)
  const basicUser = await verifyBasicAuth(request);
  if (basicUser) {
    return basicUser;
  }

  return null;
}

// Middleware de autenticação para Next.js API routes
// Aceita tanto JWT quanto Basic Auth
export async function requireAuth(request: NextRequest): Promise<{ user: User } | NextResponse> {
  const user = await verifyAuth(request);
  
  if (!user) {
    return NextResponse.json(
      { mensagem: "Não autorizado" },
      { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer, Basic realm="Restricted"',
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  }

  return { user };
}

// Helper para obter usuário da requisição (retorna null se não autenticado)
// Aceita tanto JWT quanto Basic Auth
export async function getUsuarioFromRequest(request: NextRequest): Promise<User | null> {
  return await verifyAuth(request);
}

// Verifica se o usuário tem acesso a um pointId específico
// ADMIN tem acesso a todos, ORGANIZER apenas ao seu pointIdGestor
export function usuarioTemAcessoAoPoint(usuario: User, pointId: string): boolean {
  if (usuario.role === 'ADMIN') {
    return true; // ADMIN tem acesso a tudo
  }
  
  if (usuario.role === 'ORGANIZER') {
    return usuario.pointIdGestor === pointId; // ORGANIZER apenas ao seu point
  }
  
  return false; // USER e PROFESSOR não têm acesso a gestão de points
}

// Verifica se o usuário tem acesso a uma quadra (via pointId da quadra)
export async function usuarioTemAcessoAQuadra(usuario: User, quadraId: string): Promise<boolean> {
  if (usuario.role === 'ADMIN') {
    return true; // ADMIN tem acesso a tudo
  }
  
  if (usuario.role === 'ORGANIZER') {
    // Verificar se a quadra pertence à arena do ORGANIZER
    const quadraResult = await query('SELECT "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
    if (quadraResult.rows.length === 0) {
      return false; // Quadra não existe
    }
    return quadraResult.rows[0].pointId === usuario.pointIdGestor;
  }
  
  return false; // USER e PROFESSOR não têm acesso a gestão de quadras
}

// Helper para verificar se o usuário pode gerenciar (apenas ADMIN e ORGANIZER)
export function podeGerenciar(usuario: User): boolean {
  return usuario.role === 'ADMIN' || usuario.role === 'ORGANIZER';
}

