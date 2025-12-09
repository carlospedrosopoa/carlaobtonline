// app/api/agendamento/limpar-futuros/route.ts - Deletar agendamentos futuros
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import bcrypt from 'bcryptjs';

// POST /api/agendamento/limpar-futuros - Deletar agendamentos futuros a partir de uma data
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

    // Apenas ADMIN e ORGANIZER podem limpar agenda futura
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para executar esta ação' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    const { dataLimite, senha, pointId } = body as {
      dataLimite: string; // ISO string UTC
      senha: string;
      pointId?: string; // Opcional: para ADMIN filtrar por arena específica
    };

    if (!dataLimite || !senha) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Data limite e senha são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar senha do usuário
    const usuarioResult = await query('SELECT password FROM "User" WHERE id = $1', [usuario.id]);
    if (usuarioResult.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Usuário não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const senhaHash = usuarioResult.rows[0].password;
    if (!senhaHash) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Erro na configuração do usuário' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    const senhaValida = await bcrypt.compare(senha, senhaHash);
    if (!senhaValida) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Senha incorreta' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Converter dataLimite para UTC ISO string
    const dataLimiteISO = normalizarDataHora(new Date(dataLimite));

    // Construir query de deleção
    let sql = `DELETE FROM "Agendamento" WHERE "dataHora" >= $1`;
    const params: any[] = [dataLimiteISO];

    // Determinar pointId para filtrar
    let pointIdFiltro: string | null = null;
    
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      // ORGANIZER sempre filtra pela sua arena
      pointIdFiltro = usuario.pointIdGestor;
    } else if (usuario.role === 'ADMIN' && pointId) {
      // ADMIN pode filtrar por uma arena específica se informado
      pointIdFiltro = pointId;
    }

    // Se houver pointId para filtrar, adicionar à query
    if (pointIdFiltro) {
      sql = `DELETE FROM "Agendamento" 
             WHERE "dataHora" >= $1 
             AND "quadraId" IN (
               SELECT id FROM "Quadra" WHERE "pointId" = $2
             )`;
      params.push(pointIdFiltro);
    }

    // Executar deleção
    const result = await query(sql, params);
    const quantidadeDeletada = result.rowCount || 0;

    const response = NextResponse.json({
      mensagem: `${quantidadeDeletada} agendamento(s) deletado(s) com sucesso`,
      quantidadeDeletada,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao limpar agenda futura:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao limpar agenda futura', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

