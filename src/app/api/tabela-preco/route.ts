// app/api/tabela-preco/route.ts - Rotas de API para TabelaPreco (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/tabela-preco - Listar todas as tabelas de preço (com filtro opcional por quadraId)
export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const quadraId = searchParams.get('quadraId');

    let sql = `SELECT 
      tp.id, tp."quadraId", tp."inicioMinutoDia", tp."fimMinutoDia", 
      tp."valorHora", tp.ativo, tp."createdAt", tp."updatedAt",
      q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId"
    FROM "TabelaPreco" tp
    LEFT JOIN "Quadra" q ON tp."quadraId" = q.id`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas tabelas de preço das quadras da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` WHERE q."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
      
      if (quadraId) {
        sql += ` AND tp."quadraId" = $${paramCount}`;
        params.push(quadraId);
        paramCount++;
      }
    } else if (quadraId) {
      sql += ` WHERE tp."quadraId" = $${paramCount}`;
      params.push(quadraId);
      paramCount++;
    }

    sql += ` ORDER BY tp."inicioMinutoDia" ASC`;

    const result = await query(sql, params);

    // Formatar resultado para incluir quadra como objeto
    const tabelasPreco = result.rows.map((row) => ({
      id: row.id,
      quadraId: row.quadraId,
      inicioMinutoDia: row.inicioMinutoDia,
      fimMinutoDia: row.fimMinutoDia,
      valorHora: parseFloat(row.valorHora),
      ativo: row.ativo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
        pointId: row.quadra_pointId,
      } : null,
    }));

    const response = NextResponse.json(tabelasPreco);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar tabelas de preço:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar tabelas de preço', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/tabela-preco - Criar nova tabela de preço
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

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem criar tabelas de preço' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { quadraId, horaInicio, horaFim, valorHora, ativo = true } = body;

    if (!quadraId || !horaInicio || !horaFim || valorHora === undefined) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra, horário de início, horário de fim e valor são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a quadra existe
    const quadraCheck = await query('SELECT id FROM "Quadra" WHERE id = $1', [quadraId]);
    if (quadraCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a esta quadra
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, quadraId);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para criar tabelas de preço para esta quadra' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Converter horaInicio e horaFim para minutos desde 00:00
    const [horaInicioH, horaInicioM] = horaInicio.split(':').map(Number);
    const [horaFimH, horaFimM] = horaFim.split(':').map(Number);
    const inicioMinutoDia = horaInicioH * 60 + horaInicioM;
    const fimMinutoDia = horaFimH * 60 + horaFimM;

    if (inicioMinutoDia >= fimMinutoDia) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Horário de início deve ser anterior ao horário de fim' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar sobreposição com outras tabelas de preço da mesma quadra
    const sobreposicao = await query(
      `SELECT id FROM "TabelaPreco"
       WHERE "quadraId" = $1
       AND ativo = true
       AND (
         ($2 >= "inicioMinutoDia" AND $2 < "fimMinutoDia")
         OR ($3 > "inicioMinutoDia" AND $3 <= "fimMinutoDia")
         OR ($2 <= "inicioMinutoDia" AND $3 >= "fimMinutoDia")
       )`,
      [quadraId, inicioMinutoDia, fimMinutoDia]
    );

    if (sobreposicao.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe uma tabela de preço ativa com horário sobreposto para esta quadra' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "TabelaPreco" (id, "quadraId", "inicioMinutoDia", "fimMinutoDia", "valorHora", ativo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, "quadraId", "inicioMinutoDia", "fimMinutoDia", "valorHora", ativo, "createdAt", "updatedAt"`,
      [quadraId, inicioMinutoDia, fimMinutoDia, valorHora, ativo]
    );

    // Buscar quadra para incluir no retorno
    const quadraResult = await query('SELECT id, nome, "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
    const tabelaPreco = {
      ...result.rows[0],
      valorHora: parseFloat(result.rows[0].valorHora),
      quadra: quadraResult.rows[0] || null,
    };

    const response = NextResponse.json(tabelaPreco, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar tabela de preço:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar tabela de preço', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

