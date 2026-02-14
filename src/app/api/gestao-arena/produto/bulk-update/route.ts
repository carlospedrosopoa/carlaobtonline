
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

export async function PUT(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return withCors(NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 }), request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return withCors(
        NextResponse.json({ mensagem: 'Você não tem permissão para atualizar produtos' }, { status: 403 }),
        request
      );
    }

    const body = await request.json();
    const { updates } = body as { updates: { id: string; precoVenda: number }[] };

    if (!Array.isArray(updates) || updates.length === 0) {
      return withCors(NextResponse.json({ mensagem: 'Lista de atualizações inválida' }, { status: 400 }), request);
    }

    // Validação básica e coleta de IDs
    const ids = updates.map(u => u.id);
    const idSet = new Set(ids);
    
    // Verificar se todos os produtos pertencem a arenas que o usuário tem acesso
    const produtosDb = await query(
      `SELECT id, "pointId" FROM "Produto" WHERE id = ANY($1)`,
      [Array.from(idSet)]
    );

    const produtosMap = new Map(produtosDb.rows.map(p => [p.id, p]));

    for (const update of updates) {
      const produto = produtosMap.get(update.id);
      if (!produto) {
        return withCors(
          NextResponse.json({ mensagem: `Produto ${update.id} não encontrado` }, { status: 404 }),
          request
        );
      }

      if (usuario.role === 'ORGANIZER') {
        if (!usuarioTemAcessoAoPoint(usuario, produto.pointId)) {
          return withCors(
            NextResponse.json({ mensagem: `Sem permissão para o produto ${update.id}` }, { status: 403 }),
            request
          );
        }
      }
    }

    // Executar atualizações em transação (simulada via queries sequenciais por enquanto, ou um CASE)
    // Para simplicidade e compatibilidade com o helper `query` atual que não expõe transaction explícita facilmente
    // vamos fazer update com CASE
    
    // UPDATE "Produto" SET "precoVenda" = CASE id WHEN 'id1' THEN val1 WHEN 'id2' THEN val2 ... END, "updatedAt" = NOW() WHERE id IN ('id1', 'id2', ...)

    const whenClauses = updates.map((u, index) => `WHEN id = $${index * 2 + 1} THEN $${index * 2 + 2}`).join(' ');
    const params = updates.flatMap(u => [u.id, u.precoVenda]);
    
    const sql = `
      UPDATE "Produto"
      SET "precoVenda" = CASE ${whenClauses} ELSE "precoVenda" END,
          "updatedAt" = NOW()
      WHERE id = ANY($${params.length + 1})
    `;
    
    await query(sql, [...params, Array.from(idSet)]);

    return withCors(NextResponse.json({ mensagem: 'Produtos atualizados com sucesso', count: updates.length }), request);

  } catch (error: any) {
    console.error('Erro ao atualizar produtos em massa:', error);
    return withCors(
      NextResponse.json({ mensagem: 'Erro ao atualizar produtos', error: error.message }, { status: 500 }),
      request
    );
  }
}
