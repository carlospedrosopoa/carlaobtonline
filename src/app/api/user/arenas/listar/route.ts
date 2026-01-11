// app/api/user/arenas/listar/route.ts - Listar arenas assinantes (para frontend externo)
// Esta é a nova rota organizada. A rota antiga /api/point/public ainda funciona para compatibilidade.
// Retorna apenas informações públicas de arenas assinantes e ativas, sem dados sensíveis
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors } from '@/lib/cors';

// GET /api/user/arenas/listar - Listar arenas assinantes ativas com agenda online
// IMPORTANTE: Esta rota retorna apenas arenas que são assinantes (assinante = true), estão ativas (ativo = true) e têm agenda online ativa (agendaOnlineAtivo = true)
export async function GET(request: NextRequest) {
  try {
    // Retornar apenas campos públicos (sem tokens WhatsApp, etc)
    // Filtrar apenas arenas assinantes, ativas e com agenda online ativa
    let result;
    try {
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", 
          latitude, longitude, ativo, assinante
        FROM "Point"
        WHERE assinante = true AND ativo = true AND "agendaOnlineAtivo" = true
        ORDER BY nome ASC`
      );
    } catch (error: any) {
      // Se a coluna agendaOnlineAtivo não existir ainda, filtrar apenas por assinante e ativo
      if (error.message?.includes('agendaOnlineAtivo') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Coluna agendaOnlineAtivo não encontrada, usando query sem ela');
        result = await query(
          `SELECT 
            id, nome, endereco, telefone, email, descricao, "logoUrl", 
            latitude, longitude, ativo, assinante
          FROM "Point"
          WHERE assinante = true AND ativo = true
          ORDER BY nome ASC`
        );
      } else {
        throw error;
      }
    }

    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar arenas:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar arenas', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

