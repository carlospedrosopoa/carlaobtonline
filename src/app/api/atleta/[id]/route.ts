// app/api/atleta/[id]/route.ts - Buscar e atualizar atleta
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { atualizarAtleta, buscarAtletaPorId } from '@/lib/atletaService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    
    const atleta = await buscarAtletaPorId(id);
    
    if (!atleta) {
      return NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o atleta pertence ao usuário (ou se é ADMIN)
    if (user.role !== 'ADMIN' && atleta.usuarioId !== user.id) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para visualizar este atleta' },
        { status: 403 }
      );
    }

    return NextResponse.json(atleta);
  } catch (error) {
    console.error('Erro ao buscar atleta:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao buscar atleta' },
      { status: 500 }
    );
  }
}

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
    const { id } = await params;
    const body = await request.json();
    
    const { nome, categoria, dataNascimento, genero, fone, fotoUrl, pointIdPrincipal, pointIdsFrequentes } = body;

    // Verificar se o atleta existe
    const atletaExistente = await buscarAtletaPorId(id);
    
    if (!atletaExistente) {
      return NextResponse.json(
        { mensagem: 'Atleta não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o atleta pertence ao usuário (ou se é ADMIN)
    if (user.role !== 'ADMIN' && atletaExistente.usuarioId !== user.id) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para atualizar este atleta' },
        { status: 403 }
      );
    }

    const dadosAtualizacao: {
      nome?: string;
      dataNascimento?: string;
      categoria?: string | null;
      genero?: string | null;
      fone?: string | null;
      fotoUrl?: string | null;
      pointIdPrincipal?: string | null;
      pointIdsFrequentes?: string[];
    } = {};

    if (nome !== undefined) dadosAtualizacao.nome = nome;
    if (dataNascimento !== undefined) dadosAtualizacao.dataNascimento = dataNascimento;
    if (categoria !== undefined) dadosAtualizacao.categoria = categoria || null;
    if (genero !== undefined) dadosAtualizacao.genero = genero || null;
    if (fone !== undefined) dadosAtualizacao.fone = fone || null;
    if (fotoUrl !== undefined) dadosAtualizacao.fotoUrl = fotoUrl || null;
    if (pointIdPrincipal !== undefined) dadosAtualizacao.pointIdPrincipal = pointIdPrincipal || null;
    if (pointIdsFrequentes !== undefined) dadosAtualizacao.pointIdsFrequentes = Array.isArray(pointIdsFrequentes) ? pointIdsFrequentes : [];

    const atletaAtualizado = await atualizarAtleta(id, dadosAtualizacao);

    if (!atletaAtualizado) {
      return NextResponse.json(
        { mensagem: 'Erro ao atualizar atleta' },
        { status: 500 }
      );
    }

    return NextResponse.json(atletaAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar atleta:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar atleta' },
      { status: 500 }
    );
  }
}

