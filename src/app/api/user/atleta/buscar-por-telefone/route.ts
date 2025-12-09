// app/api/user/atleta/buscar-por-telefone/route.ts
// Endpoint para buscar ou criar atleta por telefone (para adicionar participantes)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// POST /api/user/atleta/buscar-por-telefone
// Busca um atleta pelo telefone. Se não existir, cria um atleta "avulso" temporário
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

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

    // Buscar usando REGEXP_REPLACE para normalizar o telefone do banco também
    // Isso permite encontrar telefones mesmo se estiverem com formatação diferente
    const atletaExistente = await query(
      `SELECT id, nome, fone FROM "Atleta" 
       WHERE REGEXP_REPLACE(fone, '[^0-9]', '', 'g') = $1 
         AND "usuarioId" IS NOT NULL 
       LIMIT 1`,
      [telefoneApenasNumeros]
    );
    
    console.log('[buscar-por-telefone] Atleta com usuarioId encontrado:', atletaExistente.rows.length > 0);
    
    // Se não encontrou, tentar busca mais ampla para debug
    if (atletaExistente.rows.length === 0) {
      const buscaAmpla = await query(
        `SELECT id, nome, fone, "usuarioId" FROM "Atleta" 
         WHERE REGEXP_REPLACE(fone, '[^0-9]', '', 'g') = $1 
         LIMIT 5`,
        [telefoneApenasNumeros]
      );
      
      console.log('[buscar-por-telefone] Busca ampla encontrou:', buscaAmpla.rows.length, 'registros');
      if (buscaAmpla.rows.length > 0) {
        console.log('[buscar-por-telefone] Exemplos encontrados:', buscaAmpla.rows.map((r: any) => ({
          id: r.id,
          nome: r.nome,
          fone: r.fone,
          foneNormalizado: r.fone?.replace(/\D/g, ''),
          usuarioId: r.usuarioId
        })));
      }
    }

    if (atletaExistente.rows.length > 0) {
      // Atleta encontrado - retornar apenas ID e nome (sem expor outros dados)
      const atleta = atletaExistente.rows[0];
      const response = NextResponse.json({
        id: atleta.id,
        nome: atleta.nome,
        telefone: atleta.fone,
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

