// app/api/user/[id]/route.ts - Atualizar usuário (apenas ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as userService from '@/lib/userService';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    
    // Apenas ADMIN pode atualizar usuários
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem atualizar usuários.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, password, role, pointIdGestor, whatsapp } = body;

    // Log para debug (remover em produção se necessário)
    if (process.env.NODE_ENV === 'development') {
      console.log('Atualizando usuário:', { id, body: { ...body, password: password ? '***' : undefined } });
    }

    // Validar que o usuário existe
    const usuarioExistente = await userService.getUsuarioById(id);
    if (!usuarioExistente) {
      return NextResponse.json(
        { mensagem: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Validar role se fornecido
    if (role && !['ADMIN', 'USER', 'ORGANIZER'].includes(role)) {
      return NextResponse.json(
        { mensagem: 'Role inválido. Use ADMIN, USER ou ORGANIZER' },
        { status: 400 }
      );
    }

    // Validar email se fornecido
    if (email !== undefined && email !== null) {
      const emailLower = email.toLowerCase().trim();
      if (!emailLower) {
        return NextResponse.json(
          { mensagem: 'Email não pode ser vazio' },
          { status: 400 }
        );
      }
      // Verificar se o email já está em uso por outro usuário
      const emailCheck = await userService.getUsuarioByEmail(emailLower);
      if (emailCheck && emailCheck.id !== id) {
        return NextResponse.json(
          { mensagem: 'Este email já está em uso por outro usuário' },
          { status: 400 }
        );
      }
    }

    // Atualizar usuário
    const dadosAtualizacao: {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      pointIdGestor?: string | null;
      whatsapp?: string | null;
    } = {};

    if (name !== undefined && name !== null) dadosAtualizacao.name = name;
    if (email !== undefined && email !== null) {
      dadosAtualizacao.email = email.toLowerCase().trim();
    }
    // Validar e processar senha
    if (password !== undefined && password !== null) {
      const senhaTrimmed = typeof password === 'string' ? password.trim() : '';
      if (senhaTrimmed !== '') {
        dadosAtualizacao.password = senhaTrimmed;
        if (process.env.NODE_ENV === 'development') {
          console.log('Senha será atualizada para o usuário:', id);
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log('Senha vazia ignorada - mantendo senha atual');
      }
    }
    if (role !== undefined && role !== null) dadosAtualizacao.role = role;
    if (pointIdGestor !== undefined) {
      dadosAtualizacao.pointIdGestor = pointIdGestor || null;
    }
    if (whatsapp !== undefined) {
      dadosAtualizacao.whatsapp = whatsapp || null;
    }

    const usuarioAtualizado = await userService.atualizarUsuarioAdmin(id, dadosAtualizacao);

    if (!usuarioAtualizado) {
      return NextResponse.json(
        { mensagem: 'Nenhuma alteração foi fornecida' },
        { status: 400 }
      );
    }

    return NextResponse.json(usuarioAtualizado, {
      headers: {
        'Cache-Control': 'no-store',
        'Vary': 'Authorization'
      }
    });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { mensagem: error.message || 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

