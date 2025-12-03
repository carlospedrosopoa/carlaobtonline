// app/api/gestao-arena/abertura-caixa/route.ts - API de Aberturas de Caixa
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarAberturaCaixaPayload } from '@/types/gestaoArena';

// GET /api/gestao-arena/abertura-caixa - Listar aberturas de caixa
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
    const pointId = searchParams.get('pointId');
    const status = searchParams.get('status'); // 'ABERTA' | 'FECHADA'
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    let pointIdFiltro = pointId;
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      pointIdFiltro = usuario.pointIdGestor;
    } else if (!pointId && usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para listar aberturas de caixa' },
        { status: 403 }
      );
    }

    let sql = `SELECT 
      a.id, a."pointId", a."saldoInicial", a.status, a."dataAbertura", a."dataFechamento",
      a."saldoFinal", a.observacoes, a."createdAt", a."updatedAt", a."createdBy", a."fechadoBy"
    FROM "AberturaCaixa" a
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    if (pointIdFiltro) {
      sql += ` AND a."pointId" = $${paramCount}`;
      params.push(pointIdFiltro);
      paramCount++;
    }

    if (status) {
      sql += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (dataInicio) {
      sql += ` AND a."dataAbertura" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    if (dataFim) {
      sql += ` AND a."dataAbertura" <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    sql += ` ORDER BY a."dataAbertura" DESC, a."createdAt" DESC`;

    const result = await query(sql, params);

    // Calcular totais para cada abertura
    const aberturas = await Promise.all(
      result.rows.map(async (row: any) => {
        // Calcular total de entradas
        const entradasResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "EntradaCaixa" WHERE "aberturaCaixaId" = $1',
          [row.id]
        );
        const totalEntradas = parseFloat(entradasResult.rows[0].total);

        // Calcular total de saídas
        const saidasResult = await query(
          'SELECT COALESCE(SUM(valor), 0) as total FROM "SaidaCaixa" WHERE "aberturaCaixaId" = $1',
          [row.id]
        );
        const totalSaidas = parseFloat(saidasResult.rows[0].total);

        // Calcular saldo atual
        const saldoAtual = parseFloat(row.saldoInicial) + totalEntradas - totalSaidas;

        return {
          id: row.id,
          pointId: row.pointId,
          saldoInicial: parseFloat(row.saldoInicial),
          status: row.status,
          dataAbertura: row.dataAbertura,
          dataFechamento: row.dataFechamento,
          saldoFinal: row.saldoFinal ? parseFloat(row.saldoFinal) : null,
          observacoes: row.observacoes,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          createdBy: row.createdBy,
          fechadoBy: row.fechadoBy,
          totalEntradas,
          totalSaidas,
          saldoAtual,
        };
      })
    );

    return NextResponse.json(aberturas);
  } catch (error: any) {
    console.error('Erro ao listar aberturas de caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar aberturas de caixa', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/gestao-arena/abertura-caixa - Abrir caixa
export async function POST(request: NextRequest) {
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
        { mensagem: 'Você não tem permissão para abrir caixa' },
        { status: 403 }
      );
    }

    const body: CriarAberturaCaixaPayload = await request.json();
    const { pointId, saldoInicial, observacoes, dataAbertura } = body;

    if (!pointId || saldoInicial === undefined || saldoInicial === null) {
      return NextResponse.json(
        { mensagem: 'PointId e saldoInicial são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se ORGANIZER tem acesso a este point
    if (usuario.role === 'ORGANIZER') {
      if (!usuarioTemAcessoAoPoint(usuario, pointId)) {
        return NextResponse.json(
          { mensagem: 'Você não tem acesso a esta arena' },
          { status: 403 }
        );
      }
    }

    // Verificar se já existe uma abertura aberta para este point
    const aberturaAbertaResult = await query(
      'SELECT id FROM "AberturaCaixa" WHERE "pointId" = $1 AND status = $2',
      [pointId, 'ABERTA']
    );

    if (aberturaAbertaResult.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Já existe uma abertura de caixa aberta para esta arena. Feche a abertura atual antes de abrir uma nova.' },
        { status: 400 }
      );
    }

    // Usar data informada ou data atual
    const dataAberturaFinal = dataAbertura || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO "AberturaCaixa" (
        id, "pointId", "saldoInicial", status, "dataAbertura", observacoes, "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, 'ABERTA', $3, $4, NOW(), NOW(), $5
      ) RETURNING *`,
      [pointId, saldoInicial, dataAberturaFinal, observacoes || null, usuario.id]
    );

    const abertura = result.rows[0];

    return NextResponse.json({
      id: abertura.id,
      pointId: abertura.pointId,
      saldoInicial: parseFloat(abertura.saldoInicial),
      status: abertura.status,
      dataAbertura: abertura.dataAbertura,
      observacoes: abertura.observacoes,
      createdAt: abertura.createdAt,
      updatedAt: abertura.updatedAt,
      createdBy: abertura.createdBy,
      totalEntradas: 0,
      totalSaidas: 0,
      saldoAtual: parseFloat(abertura.saldoInicial),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao abrir caixa:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao abrir caixa', error: error.message },
      { status: 500 }
    );
  }
}

