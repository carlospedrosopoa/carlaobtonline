// app/api/gestao-arena/abertura-caixa/[id]/route.ts - API de Abertura de Caixa individual
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { FecharAberturaCaixaPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/abertura-caixa/[id] - Obter abertura de caixa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await query(
      'SELECT * FROM "AberturaCaixa" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Abertura de caixa não encontrada' },
        { status: 404 }
      );
    }

    const abertura = result.rows[0];

    // Verificar acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, abertura.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta abertura de caixa' },
          { status: 403 }
        );
      }
    }

    // Calcular totais
    const entradasResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "EntradaCaixa" WHERE "aberturaCaixaId" = $1',
      [id]
    );
    const totalEntradas = parseFloat(entradasResult.rows[0].total);

    const saidasResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "SaidaCaixa" WHERE "aberturaCaixaId" = $1',
      [id]
    );
    const totalSaidas = parseFloat(saidasResult.rows[0].total);

    const saldoAtual = parseFloat(abertura.saldoInicial) + totalEntradas - totalSaidas;

    return NextResponse.json({
      id: abertura.id,
      pointId: abertura.pointId,
      saldoInicial: parseFloat(abertura.saldoInicial),
      status: abertura.status,
      dataAbertura: abertura.dataAbertura,
      dataFechamento: abertura.dataFechamento,
      saldoFinal: abertura.saldoFinal ? parseFloat(abertura.saldoFinal) : null,
      observacoes: abertura.observacoes,
      createdAt: abertura.createdAt,
      updatedAt: abertura.updatedAt,
      createdBy: abertura.createdBy,
      fechadoBy: abertura.fechadoBy,
      totalEntradas,
      totalSaidas,
      saldoAtual,
    });
  } catch (error: any) {
    console.error('Erro ao obter abertura de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter abertura de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/gestao-arena/abertura-caixa/[id] - Fechar abertura de caixa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para fechar caixa' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: FecharAberturaCaixaPayload = await request.json();
    const { saldoFinal, observacoes } = body;

    // Verificar se a abertura existe e está aberta
    const aberturaResult = await query(
      'SELECT * FROM "AberturaCaixa" WHERE id = $1',
      [id]
    );

    if (aberturaResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Abertura de caixa não encontrada' },
        { status: 404 }
      );
    }

    const abertura = aberturaResult.rows[0];

    if (abertura.status !== 'ABERTA') {
      return NextResponse.json(
        { mensagem: 'Esta abertura de caixa já está fechada' },
        { status: 400 }
      );
    }

    // Verificar acesso
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, abertura.pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta abertura de caixa' },
          { status: 403 }
        );
      }
    }

    // Calcular saldo atual
    const entradasResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "EntradaCaixa" WHERE "aberturaCaixaId" = $1',
      [id]
    );
    const totalEntradas = parseFloat(entradasResult.rows[0].total);

    const saidasResult = await query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM "SaidaCaixa" WHERE "aberturaCaixaId" = $1',
      [id]
    );
    const totalSaidas = parseFloat(saidasResult.rows[0].total);

    const saldoAtual = parseFloat(abertura.saldoInicial) + totalEntradas - totalSaidas;

    // Fechar abertura
    const saldoFinalValue = saldoFinal !== undefined ? saldoFinal : saldoAtual;
    
    const updateResult = await query(
      `UPDATE "AberturaCaixa" 
       SET status = 'FECHADA', 
           "dataFechamento" = NOW(),
           "saldoFinal" = $1,
           observacoes = COALESCE($2, observacoes),
           "fechadoBy" = $3,
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [saldoFinalValue, observacoes || null, usuario.id, id]
    );

    return NextResponse.json({
      id: updateResult.rows[0].id,
      pointId: updateResult.rows[0].pointId,
      saldoInicial: parseFloat(updateResult.rows[0].saldoInicial),
      status: updateResult.rows[0].status,
      dataAbertura: updateResult.rows[0].dataAbertura,
      dataFechamento: updateResult.rows[0].dataFechamento,
      saldoFinal: updateResult.rows[0].saldoFinal ? parseFloat(updateResult.rows[0].saldoFinal) : null,
      observacoes: updateResult.rows[0].observacoes,
      totalEntradas,
      totalSaidas,
      saldoAtual,
    });
  } catch (error: any) {
    console.error('Erro ao fechar abertura de caixa:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        mensagem: 'Erro ao fechar abertura de caixa', 
        error: error.message,
        detail: error.detail || error.hint || 'Verifique se a tabela AberturaCaixa existe e possui todas as colunas necessárias (dataFechamento, fechadoBy, saldoFinal)',
      },
      { status: 500 }
    );
  }
}

