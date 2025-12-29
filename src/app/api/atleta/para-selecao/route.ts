// app/api/atleta/para-selecao/route.ts - Lista simplificada de atletas para seleção em partidas
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';

function calcularIdade(dataNascimento: Date | string): number {
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const searchParams = request.nextUrl.searchParams;
    const busca = searchParams.get('busca') || '';

    // Construir query base - TODOS os usuários autenticados podem ver TODOS os atletas
    // Isso permite que o frontend externo (que loga como USER) possa selecionar qualquer atleta
    let sql = `
      SELECT 
        a.id, 
        a.nome, 
        a."dataNascimento",
        a.categoria,
        a.genero
      FROM "Atleta" a
    `;

    const params: any[] = [];
    let paramCount = 1;

    // Adicionar filtro de busca se fornecido (ignorando acentuação)
    if (busca) {
      // Normalizar a busca removendo acentos (usando translate para remover acentos comuns)
      // Aplica a mesma normalização no campo do banco para comparação case-insensitive e sem acentos
      sql += ` WHERE 
        LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) 
        ILIKE 
        LOWER(TRANSLATE($${paramCount}, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))`;
      params.push(`%${busca}%`);
      paramCount++;
    }

    sql += ` ORDER BY a.nome ASC`;

    const result = await query(sql, params);

    // Formatar resposta com dados simplificados para seleção
    const atletas = result.rows.map((row: any) => ({
      id: row.id,
      nome: row.nome,
      idade: calcularIdade(row.dataNascimento),
      categoria: row.categoria || null,
      genero: row.genero || null,
    }));

    const response = NextResponse.json(atletas, {
      headers: {
        'Cache-Control': 'no-store',
        'Vary': 'Authorization'
      }
    });
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao listar atletas para seleção:', error);
    const errorResponse = NextResponse.json(
      { error: "Erro ao listar atletas" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

