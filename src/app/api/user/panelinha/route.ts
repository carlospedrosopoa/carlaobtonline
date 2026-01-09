// app/api/user/panelinha/route.ts - CRUD de Panelinhas (para frontend externo)
// GET: Listar panelinhas do atleta autenticado
// POST: Criar nova panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

// GET /api/user/panelinha - Listar panelinhas do atleta autenticado
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    
    console.log('[PANELINHA] User ID:', user.id, 'Role:', user.role);
    
    // Se for ORGANIZER, buscar panelinhas da sua arena
    if (user.role === 'ORGANIZER' && user.pointIdGestor) {
      console.log('[PANELINHA] ORGANIZER buscando panelinhas da arena:', user.pointIdGestor);
      // Buscar panelinhas onde pelo menos um membro pertence à arena do ORGANIZER
      const sql = `
        SELECT DISTINCT ON (p.id)
          p.id,
          p.nome,
          p.descricao,
          p."esporte",
          p."atletaIdCriador",
          p."createdAt",
          p."updatedAt",
          -- Nome do criador
          ac.nome as "criadorNome",
          -- ORGANIZER não é criador, mas tem acesso de gestor
          false as "ehCriador",
          -- Contar membros
          COALESCE((
            SELECT COUNT(*) 
            FROM "PanelinhaAtleta" pa 
            WHERE pa."panelinhaId" = p.id
          ), 0) as "totalMembros",
          -- Buscar membros com fotos
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', a.id,
                'nome', a.nome,
                'fotoUrl', a."fotoUrl"
              )
            )
            FROM "PanelinhaAtleta" pa2
            INNER JOIN "Atleta" a ON pa2."atletaId" = a.id
            WHERE pa2."panelinhaId" = p.id
            LIMIT 4
          )::text, '[]')::json as "membros"
        FROM "Panelinha" p
        LEFT JOIN "Atleta" ac ON p."atletaIdCriador" = ac.id
        WHERE EXISTS (
          SELECT 1 
          FROM "PanelinhaAtleta" pa
          INNER JOIN "Atleta" a ON pa."atletaId" = a.id
          WHERE pa."panelinhaId" = p.id
          AND a."pointIdPrincipal" = $1
        )
        ORDER BY p.id, p."updatedAt" DESC NULLS LAST
      `;

      const result = await query(sql, [user.pointIdGestor]);
      console.log('[PANELINHA] Query ORGANIZER executada. Resultados:', result.rows.length);
      
      const panelinhas = result.rows.map((row: any) => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao,
        esporte: row.esporte,
        atletaIdCriador: row.atletaIdCriador,
        criadorNome: row.criadorNome || 'Desconhecido',
        ehCriador: false, // ORGANIZER nunca é criador, mas tem acesso de gestor
        totalMembros: parseInt(row.totalMembros) || 0,
        membros: row.membros || [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      const response = NextResponse.json({ panelinhas });
      return withCors(response, request);
    }
    
    // Para USER: buscar atleta e panelinhas normalmente
    const atleta = await verificarAtletaUsuario(user.id);
    console.log('[PANELINHA] Atleta encontrado:', atleta ? { id: atleta.id, nome: atleta.nome } : 'null');
    
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar panelinhas criadas pelo atleta e panelinhas onde ele é membro
    console.log('[PANELINHA] Executando query SQL com atletaId:', atleta.id);
    // Usar DISTINCT ON para evitar duplicatas sem comparar JSON
    const sql = `
      SELECT DISTINCT ON (p.id)
        p.id,
        p.nome,
        p.descricao,
        p."esporte",
        p."atletaIdCriador",
        p."createdAt",
        p."updatedAt",
        -- Nome do criador
        ac.nome as "criadorNome",
        -- Verificar se o atleta é o criador
        (p."atletaIdCriador" = $1) as "ehCriador",
        -- Contar membros
        COALESCE((
          SELECT COUNT(*) 
          FROM "PanelinhaAtleta" pa 
          WHERE pa."panelinhaId" = p.id
        ), 0) as "totalMembros",
        -- Buscar membros com fotos (usar COALESCE para retornar array vazio se null)
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'nome', a.nome,
              'fotoUrl', a."fotoUrl"
            )
          )
          FROM "PanelinhaAtleta" pa2
          INNER JOIN "Atleta" a ON pa2."atletaId" = a.id
          WHERE pa2."panelinhaId" = p.id
          LIMIT 4
        )::text, '[]')::json as "membros"
      FROM "Panelinha" p
      LEFT JOIN "Atleta" ac ON p."atletaIdCriador" = ac.id
      WHERE p."atletaIdCriador" = $1
         OR EXISTS (
           SELECT 1 
           FROM "PanelinhaAtleta" pa 
           WHERE pa."panelinhaId" = p.id 
           AND pa."atletaId" = $1
         )
      ORDER BY p.id, p."updatedAt" DESC NULLS LAST
    `;

    const result = await query(sql, [atleta.id]);
    console.log('[PANELINHA] Query executada com sucesso. Resultados:', result.rows.length);

    const panelinhas = result.rows.map((row: any) => {
      console.log('[PANELINHA] Processando panelinha:', row.id, row.nome);
      return {
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      esporte: row.esporte,
      atletaIdCriador: row.atletaIdCriador,
      criadorNome: row.criadorNome || 'Desconhecido',
      ehCriador: row.ehCriador,
      totalMembros: parseInt(row.totalMembros) || 0,
      membros: row.membros || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      };
    });

    const response = NextResponse.json({ panelinhas });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao listar:', error);
    console.error('[PANELINHA] Erro completo:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    
    // Verificar se é erro de tabela não encontrada
    const errorMessage = error.message || '';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('Panelinha')) {
      const errorResponse = NextResponse.json(
        { 
          mensagem: 'Tabelas de panelinhas não encontradas. Execute a migration create_panelinha.sql no banco de dados.',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined,
          detail: process.env.NODE_ENV === 'development' ? error.detail : undefined,
        },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }
    
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao listar panelinhas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        detail: process.env.NODE_ENV === 'development' ? error.detail : undefined,
        code: process.env.NODE_ENV === 'development' ? error.code : undefined,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/user/panelinha - Criar nova panelinha
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const body = await request.json();
    const { nome, descricao, esporte } = body;

    if (!nome || !nome.trim()) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome da panelinha é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Criar panelinha
    const sql = `
      INSERT INTO "Panelinha" (id, nome, descricao, "esporte", "atletaIdCriador", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
      RETURNING id, nome, descricao, "esporte", "atletaIdCriador", "createdAt", "updatedAt"
    `;

    const result = await query(sql, [
      nome.trim(),
      descricao?.trim() || null,
      esporte?.trim() || null,
      atleta.id
    ]);

    const panelinha = result.rows[0];

    // Adicionar o criador como membro da panelinha
    await query(
      `INSERT INTO "PanelinhaAtleta" (id, "panelinhaId", "atletaId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, NOW())
       ON CONFLICT ("panelinhaId", "atletaId") DO NOTHING`,
      [panelinha.id, atleta.id]
    );

    const response = NextResponse.json({
      ...panelinha,
      ehCriador: true,
      totalMembros: 1,
      membros: [{
        id: atleta.id,
        nome: atleta.nome,
        fotoUrl: atleta.fotoUrl,
      }],
    }, { status: 201 });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao criar:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao criar panelinha',
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

