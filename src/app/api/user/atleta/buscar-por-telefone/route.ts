// app/api/user/atleta/buscar-por-telefone/route.ts
// Endpoint para buscar atleta por telefone (público para criação de conta)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

// POST /api/user/atleta/buscar-por-telefone
// Busca um atleta pelo telefone (rota pública para criação de conta)
export async function POST(request: NextRequest) {
  try {
    // Rota pública - não requer autenticação para criação de conta

    const body = await request.json();
    const { telefone } = body as { telefone: string };

    if (!telefone) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Telefone é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar telefone (remover caracteres não numéricos)
    const telefoneNormalizado = telefone.replace(/\D/g, '');
    
    console.log('[buscar-por-telefone] Telefone recebido:', telefone);
    console.log('[buscar-por-telefone] Telefone normalizado:', telefoneNormalizado);

    // Tentar diferentes formatos de busca
    // 1. Busca exata com telefone normalizado
    // 2. Busca removendo espaços e caracteres especiais do banco também
    // 3. Busca com LIKE para encontrar variações
    
    // Primeiro, buscar todos os atletas com telefones similares para debug
    const telefoneSemEspacos = telefoneNormalizado.replace(/\s/g, '');
    const telefoneApenasNumeros = telefoneNormalizado.replace(/[^0-9]/g, '');
    
    console.log('[buscar-por-telefone] Tentando buscar com:', {
      normalizado: telefoneNormalizado,
      semEspacos: telefoneSemEspacos,
      apenasNumeros: telefoneApenasNumeros
    });

    // Buscar atleta por telefone (com ou sem usuário vinculado)
    const atletaExistente = await query(
      `SELECT 
        a.id,
        a.nome,
        a.fone as telefone,
        a."usuarioId",
        u.email
      FROM "Atleta" a
      LEFT JOIN "User" u ON u.id = a."usuarioId"
      WHERE REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') = $1
      LIMIT 1`,
      [telefoneApenasNumeros]
    );

    if (atletaExistente.rows.length > 0) {
      // Atleta encontrado - retornar dados para criação de conta
      const atleta = atletaExistente.rows[0];
      const response = NextResponse.json({
        id: atleta.id,
        nome: atleta.nome,
        telefone: atleta.telefone,
        email: atleta.email || null,
        usuarioId: atleta.usuarioId || null,
        existe: true,
      });
      return withCors(response, request);
    }

    // Atleta não encontrado - retornar erro informando que não está cadastrado
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Este número não está cadastrado como usuário do app',
        codigo: 'ATLETA_NAO_ENCONTRADO'
      },
      { status: 404 }
    );
    return withCors(errorResponse, request);
  } catch (error: any) {
    console.error('Erro ao buscar/criar atleta por telefone:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar solicitação', erro: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

