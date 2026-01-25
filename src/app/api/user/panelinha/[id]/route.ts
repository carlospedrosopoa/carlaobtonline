// app/api/user/panelinha/[id]/route.ts - Operações em panelinha específica
// GET: Obter panelinha
// PUT: Atualizar panelinha
// DELETE: Deletar panelinha
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

// GET /api/user/panelinha/[id] - Obter panelinha com todos os membros
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id } = await params;

    // Se for ORGANIZER, verificar acesso através da arena
    if (user.role === 'ORGANIZER' && user.pointIdGestor) {
      // Verificar se a panelinha tem membros da arena do ORGANIZER
      const panelinhaCheck = await query(
        `SELECT p.id, p.nome, p.descricao, p."esporte", p."atletaIdCriador", p."createdAt", p."updatedAt"
         FROM "Panelinha" p
         WHERE p.id = $1
         AND EXISTS (
           SELECT 1 
           FROM "PanelinhaAtleta" pa
           INNER JOIN "Atleta" a ON pa."atletaId" = a.id
           WHERE pa."panelinhaId" = p.id
           AND a."pointIdPrincipal" = $2
         )`,
        [id, user.pointIdGestor]
      );

      if (panelinhaCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Panelinha não encontrada ou você não tem acesso a esta panelinha' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      // Buscar membros da panelinha
      const membrosResult = await query(
        `SELECT 
          a.id, a.nome, a."fotoUrl", a.fone, a."dataNascimento", a.genero, a.categoria
         FROM "PanelinhaAtleta" pa
         INNER JOIN "Atleta" a ON pa."atletaId" = a.id
         WHERE pa."panelinhaId" = $1
         ORDER BY a.nome`,
        [id]
      );

      const row = panelinhaCheck.rows[0];
      const panelinha = {
        id: row.id,
        nome: row.nome,
        descricao: row.descricao,
        esporte: row.esporte,
        atletaIdCriador: row.atletaIdCriador,
        ehCriador: false, // ORGANIZER nunca é criador
        totalMembros: membrosResult.rows.length,
        membros: membrosResult.rows.map((m: any) => ({
          id: m.id,
          nome: m.nome,
          fotoUrl: m.fotoUrl,
          telefone: m.fone,
          dataNascimento: m.dataNascimento,
          genero: m.genero,
          categoria: m.categoria,
        })),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

      const response = NextResponse.json(panelinha);
      return withCors(response, request);
    }

    // Para USER: buscar atleta e verificar acesso normalmente
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é membro ou criador
    const panelinhaCheck = await query(
      `SELECT p.id, p.nome, p.descricao, p."esporte", p."atletaIdCriador", p."createdAt", p."updatedAt",
              (p."atletaIdCriador" = $1) as "ehCriador",
              EXISTS (
                SELECT 1 FROM "PanelinhaAtleta" pa 
                WHERE pa."panelinhaId" = p.id AND pa."atletaId" = $1
              ) as "ehMembro"
       FROM "Panelinha" p
       WHERE p.id = $2`,
      [atleta.id, id]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const checkRow = panelinhaCheck.rows[0];
    if (!checkRow.ehCriador && !checkRow.ehMembro) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem acesso a esta panelinha' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar panelinha com todos os membros
    const sql = `
      SELECT 
        p.id,
        p.nome,
        p.descricao,
        p."esporte",
        p."atletaIdCriador",
        p."createdAt",
        p."updatedAt",
        -- Verificar se o atleta é o criador
        (p."atletaIdCriador" = $1) as "ehCriador",
        -- Buscar todos os membros
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'nome', a.nome,
              'fotoUrl', a."fotoUrl",
              'telefone', a.fone,
              'dataNascimento', a."dataNascimento",
              'genero', a.genero,
              'categoria', a.categoria
            )
            ORDER BY a.nome
          )
          FROM "PanelinhaAtleta" pa
          INNER JOIN "Atleta" a ON pa."atletaId" = a.id
          WHERE pa."panelinhaId" = p.id
        ) as "membros"
      FROM "Panelinha" p
      WHERE p.id = $2
    `;

    const result = await query(sql, [atleta.id, id]);

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];
    const panelinha = {
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      esporte: row.esporte,
      atletaIdCriador: row.atletaIdCriador,
      ehCriador: row.ehCriador,
      totalMembros: row.membros ? row.membros.length : 0,
      membros: row.membros || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    const response = NextResponse.json(panelinha);
    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao obter:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao obter panelinha',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/user/panelinha/[id] - Atualizar panelinha
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id } = await params;
    const body = await request.json();
    const { nome, descricao, esporte } = body;

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é o criador
    const panelinhaCheck = await query(
      'SELECT "atletaIdCriador" FROM "Panelinha" WHERE id = $1',
      [id]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (panelinhaCheck.rows[0].atletaIdCriador !== atleta.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para editar esta panelinha' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Atualizar panelinha
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Nome da panelinha é obrigatório' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      updates.push(`nome = $${paramIndex++}`);
      values.push(nome.trim());
    }

    if (descricao !== undefined) {
      updates.push(`descricao = $${paramIndex++}`);
      values.push(descricao?.trim() || null);
    }

    if (esporte !== undefined) {
      updates.push(`"esporte" = $${paramIndex++}`);
      values.push(esporte?.trim() || null);
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    const sql = `
      UPDATE "Panelinha"
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, nome, descricao, "esporte", "atletaIdCriador", "createdAt", "updatedAt"
    `;

    const result = await query(sql, values);
    const panelinha = result.rows[0];

    const response = NextResponse.json(panelinha);
    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao atualizar:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao atualizar panelinha',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/user/panelinha/[id] - Deletar panelinha
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const { id } = await params;

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a panelinha existe e se o atleta é o criador
    const panelinhaCheck = await query(
      'SELECT "atletaIdCriador" FROM "Panelinha" WHERE id = $1',
      [id]
    );

    if (panelinhaCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Panelinha não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (panelinhaCheck.rows[0].atletaIdCriador !== atleta.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar esta panelinha' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Deletar panelinha (cascade deleta PanelinhaAtleta automaticamente)
    await query('DELETE FROM "Panelinha" WHERE id = $1', [id]);

    const response = NextResponse.json({ mensagem: 'Panelinha deletada com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('[PANELINHA] Erro ao deletar:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao deletar panelinha',
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

