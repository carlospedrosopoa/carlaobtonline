// app/api/professor/[id]/route.ts - Rotas para um professor específico
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { buscarProfessorPorId, buscarProfessorPorUserId, buscarProfessorComArenas, atualizarProfessor, deletarProfessor } from '@/lib/professorService';
import { uploadImage, base64ToBuffer, deleteImage } from '@/lib/googleCloudStorage';

// GET /api/professor/[id] - Buscar professor por ID
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

    // Tentar buscar por professorId primeiro
    let professor = await buscarProfessorPorId(id);
    let professorId: string | null = null;

    // Se não encontrou, tentar buscar por userId (para compatibilidade)
    if (!professor) {
      professor = await buscarProfessorPorUserId(id);
    }

    if (!professor) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    professorId = professor.id;

    // Verificar permissões: ADMIN pode ver qualquer professor
    // PROFESSOR só pode ver seu próprio perfil
    if (user.role !== 'ADMIN' && professor.userId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar professor com arenas
    const professorComArenas = await buscarProfessorComArenas(professorId);

    const response = NextResponse.json(professorComArenas, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao buscar professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao buscar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/professor/[id] - Atualizar professor
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

    // Tentar buscar por professorId primeiro
    let professorExistente = await buscarProfessorPorId(id);

    // Se não encontrou, tentar buscar por userId (para compatibilidade)
    if (!professorExistente) {
      professorExistente = await buscarProfessorPorUserId(id);
    }

    if (!professorExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Usar o professorId real para atualização
    const professorId = professorExistente.id;

    // Verificar permissões: ADMIN pode atualizar qualquer professor
    // PROFESSOR só pode atualizar seu próprio perfil
    if (user.role !== 'ADMIN' && professorExistente.userId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Você só pode atualizar seu próprio perfil.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const {
      especialidade,
      bio,
      valorHora,
      telefoneProfissional,
      emailProfissional,
      fotoUrl,
      logoUrl,
      ativo,
      aceitaNovosAlunos,
      pointIdPrincipal,
      pointIdsFrequentes,
    } = body;

    // Processar fotoUrl: se for base64, fazer upload para GCS
    // Se for null, deletar imagem antiga do GCS
    let fotoUrlProcessada: string | null | undefined = undefined;
    if (fotoUrl !== undefined) {
      if (fotoUrl === null || fotoUrl === '') {
        // Deletar imagem antiga se existir
        if (professorExistente.fotoUrl) {
          try {
            await deleteImage(professorExistente.fotoUrl);
          } catch (error) {
            console.error('Erro ao deletar foto antiga:', error);
          }
        }
        fotoUrlProcessada = null;
      } else if (fotoUrl.startsWith('data:image/')) {
        try {
          // Deletar imagem antiga se existir
          if (professorExistente.fotoUrl) {
            try {
              await deleteImage(professorExistente.fotoUrl);
            } catch (error) {
              console.error('Erro ao deletar foto antiga:', error);
            }
          }
          const buffer = base64ToBuffer(fotoUrl);
          const mimeMatch = fotoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `professor-foto-${professorId}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'professores');
          fotoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload da foto:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload da foto' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
        fotoUrlProcessada = fotoUrl;
      } else {
        fotoUrlProcessada = null;
      }
    }

    // Processar logoUrl: se for base64, fazer upload para GCS
    // Se for null, deletar imagem antiga do GCS
    let logoUrlProcessada: string | null | undefined = undefined;
    if (logoUrl !== undefined) {
      if (logoUrl === null || logoUrl === '') {
        // Deletar imagem antiga se existir
        if (professorExistente.logoUrl) {
          try {
            await deleteImage(professorExistente.logoUrl);
          } catch (error) {
            console.error('Erro ao deletar logo antiga:', error);
          }
        }
        logoUrlProcessada = null;
      } else if (logoUrl.startsWith('data:image/')) {
        try {
          // Deletar imagem antiga se existir
          if (professorExistente.logoUrl) {
            try {
              await deleteImage(professorExistente.logoUrl);
            } catch (error) {
              console.error('Erro ao deletar logo antiga:', error);
            }
          }
          const buffer = base64ToBuffer(logoUrl);
          const mimeMatch = logoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `professor-logo-${professorId}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'professores');
          logoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload da logo:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload da logo' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        logoUrlProcessada = logoUrl;
      } else {
        logoUrlProcessada = null;
      }
    }

    // PROFESSOR não pode alterar seu próprio status ativo (apenas ADMIN)
    const dadosAtualizacao: any = {};
    if (especialidade !== undefined) dadosAtualizacao.especialidade = especialidade || null;
    if (bio !== undefined) dadosAtualizacao.bio = bio || null;
    if (valorHora !== undefined) dadosAtualizacao.valorHora = valorHora || null;
    if (telefoneProfissional !== undefined) dadosAtualizacao.telefoneProfissional = telefoneProfissional || null;
    if (emailProfissional !== undefined) dadosAtualizacao.emailProfissional = emailProfissional || null;
    if (fotoUrlProcessada !== undefined) dadosAtualizacao.fotoUrl = fotoUrlProcessada;
    if (logoUrlProcessada !== undefined) dadosAtualizacao.logoUrl = logoUrlProcessada;
    if (aceitaNovosAlunos !== undefined) dadosAtualizacao.aceitaNovosAlunos = aceitaNovosAlunos;
    if (pointIdPrincipal !== undefined) dadosAtualizacao.pointIdPrincipal = pointIdPrincipal || null;
    if (pointIdsFrequentes !== undefined) dadosAtualizacao.pointIdsFrequentes = Array.isArray(pointIdsFrequentes) ? pointIdsFrequentes : [];

    // Apenas ADMIN pode alterar status ativo
    if (user.role === 'ADMIN' && ativo !== undefined) {
      dadosAtualizacao.ativo = ativo;
    }

    const professorAtualizado = await atualizarProfessor(professorId, dadosAtualizacao);

    const response = NextResponse.json(professorAtualizado, { status: 200 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao atualizar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/professor/[id] - Deletar professor (apenas ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Apenas ADMIN pode deletar professores
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores podem deletar professores.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;

    // Tentar buscar por professorId primeiro
    let professorExistente = await buscarProfessorPorId(id);

    // Se não encontrou, tentar buscar por userId (para compatibilidade)
    if (!professorExistente) {
      professorExistente = await buscarProfessorPorUserId(id);
    }

    if (!professorExistente) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Professor não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Usar o professorId real para deletar
    const professorId = professorExistente.id;

    await deletarProfessor(professorId);

    const response = NextResponse.json(
      { mensagem: 'Professor deletado com sucesso' },
      { status: 200 }
    );
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar professor:', error);
    const errorResponse = NextResponse.json(
      { mensagem: error.message || 'Erro ao deletar professor' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

