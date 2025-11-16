// lib/auth.ts - Autenticação Basic Auth
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "./db";

// Tipo User
export type User = {
  id: string;
  email: string;
  nome: string;
  role: string;
  atletaId?: string | null;
};

// Verifica Basic Auth e retorna o usuário
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

  return { 
    id: user.id, 
    nome, 
    role, 
    atletaId,
    email: user.email 
  };
}

// Middleware de autenticação para Next.js API routes
export async function requireAuth(request: NextRequest): Promise<{ user: User } | NextResponse> {
  const user = await verifyBasicAuth(request);
  
  if (!user) {
    return NextResponse.json(
      { mensagem: "Não autorizado" },
      { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Restricted"',
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  }

  return { user };
}

