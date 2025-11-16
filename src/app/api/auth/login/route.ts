// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailRaw = (body?.email ?? "") as string;
    const senha = (body?.password ?? body?.senha ?? "") as string;
    const email = emailRaw.trim().toLowerCase();

    if (!email || !senha) {
      return NextResponse.json(
        { mensagem: "Informe email e senha." },
        { status: 400 }
      );
    }

    const result = await query('SELECT * FROM "User" WHERE email = $1', [email]);
    const usuarioDb = result.rows[0];
    
    if (!usuarioDb) {
      return NextResponse.json(
        { mensagem: "Usuário não encontrado" },
        { status: 401 }
      );
    }

    const senhaHash = (usuarioDb as any).password ?? (usuarioDb as any).senhaHash ?? "";
    if (!senhaHash) {
      return NextResponse.json(
        { mensagem: "Erro na configuração do usuário" },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(senha, senhaHash);
    if (!ok) {
      return NextResponse.json(
        { mensagem: "Senha incorreta" },
        { status: 401 }
      );
    }

    const usuario = {
      id: usuarioDb.id,
      nome: (usuarioDb as any).name ?? (usuarioDb as any).nome ?? "",
      email: usuarioDb.email,
      role: (usuarioDb as any).role ?? "USER",
      atletaId: (usuarioDb as any).atletaId !== undefined ? (usuarioDb as any).atletaId : undefined,
    };

    return NextResponse.json(
      { 
        usuario,
        user: usuario  // Alias para compatibilidade
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    );
  } catch (error: any) {
    console.error("login error:", error);
    return NextResponse.json(
      { 
        mensagem: "Erro ao efetuar login",
        error: error?.message || "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}

