// app/api/user/atleta/buscar/route.ts - Buscar atletas por nome ou telefone
// Para uso na funcionalidade de "Minha Panelinha"
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { searchParams } = new URL(request.url);
    const termo = searchParams.get('q') || '';
    const limite = parseInt(searchParams.get('limite') || '20');

    if (!termo || termo.trim().length < 2) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Termo de busca deve ter pelo menos 2 caracteres' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Função para normalizar texto removendo acentuação
    const normalizarTexto = (texto: string): string => {
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // Buscar atletas por nome ou telefone
    // Remover caracteres não numéricos do termo para busca de telefone
    const termoLimpo = termo.trim();
    const termoNormalizado = normalizarTexto(termoLimpo);
    const termoTelefone = termoLimpo.replace(/\D/g, ''); // Apenas números

    let sql: string;
    let params: any[];

    if (termoTelefone.length >= 3) {
      // Se o termo tem números, buscar por nome OU telefone
      // Usar função SQL para normalizar nome e comparar
      sql = `
        SELECT 
          a.id,
          a.nome,
          a.fone,
          a."fotoUrl",
          a."dataNascimento",
          a.genero,
          a.categoria,
          u.email as "usuarioEmail"
        FROM "Atleta" a
        LEFT JOIN "User" u ON a."usuarioId" = u.id
        WHERE (
          LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE LOWER($1)
          OR a.fone LIKE $2
        )
        AND a.id IS NOT NULL
        ORDER BY 
          CASE 
            WHEN LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE LOWER($3) THEN 1
            WHEN a.fone LIKE $4 THEN 2
            ELSE 3
          END,
          a.nome ASC
        LIMIT $5
      `;
      const termoLike = `%${termoNormalizado}%`;
      const telefoneLike = `%${termoTelefone}%`;
      params = [termoLike, telefoneLike, termoLike, telefoneLike, limite];
    } else {
      // Apenas busca por nome
      sql = `
        SELECT 
          a.id,
          a.nome,
          a.fone,
          a."fotoUrl",
          a."dataNascimento",
          a.genero,
          a.categoria,
          u.email as "usuarioEmail"
        FROM "Atleta" a
        LEFT JOIN "User" u ON a."usuarioId" = u.id
        WHERE LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE LOWER($1)
        AND a.id IS NOT NULL
        ORDER BY a.nome ASC
        LIMIT $2
      `;
      params = [`%${termoNormalizado}%`, limite];
    }

    const result = await query(sql, params);

    const atletas = result.rows.map((row: any) => ({
      id: row.id,
      nome: row.nome,
      telefone: row.fone,
      fotoUrl: row.fotoUrl,
      dataNascimento: row.dataNascimento,
      genero: row.genero,
      categoria: row.categoria,
      email: row.usuarioEmail,
    }));

    const response = NextResponse.json({
      atletas,
      total: atletas.length,
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[BUSCAR ATLETAS] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao buscar atletas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}


