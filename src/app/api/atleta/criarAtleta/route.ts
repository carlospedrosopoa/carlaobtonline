// app/api/atleta/criarAtleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { criarAtleta } from '@/lib/atletaService';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    
    const { nome, categoria, dataNascimento, genero, fone, fotoUrl, pointIdPrincipal, pointIdsFrequentes } = body;

    if (!nome || !dataNascimento) {
      return NextResponse.json(
        { mensagem: "nome e dataNascimento são obrigatórios" },
        { status: 400 }
      );
    }

    // fotoUrl: Atualmente usando base64. 
    // TODO: Migrar para URL quando implementar upload para Vercel Blob Storage/Cloudinary
    const novoAtleta = await criarAtleta(user.id, {
      nome,
      dataNascimento,
      categoria: categoria || null,
      genero: genero || null,
      fone: fone || null,
      fotoUrl: fotoUrl || null,
      pointIdPrincipal: pointIdPrincipal || null,
      pointIdsFrequentes: Array.isArray(pointIdsFrequentes) ? pointIdsFrequentes : [],
    });

    return NextResponse.json(
      novoAtleta,
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar atleta:', error);
    return NextResponse.json(
      { mensagem: "Erro ao criar atleta" },
      { status: 500 }
    );
  }
}



