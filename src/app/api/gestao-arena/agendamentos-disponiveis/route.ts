// app/api/gestao-arena/agendamentos-disponiveis/route.ts - API para buscar agendamentos disponíveis para vincular a cards
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';

// GET /api/gestao-arena/agendamentos-disponiveis - Listar agendamentos disponíveis (não vinculados a cards)
export async function GET(request: NextRequest) {
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
        { mensagem: 'Você não tem permissão para listar agendamentos disponíveis' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const status = searchParams.get('status'); // CONFIRMADO, CONCLUIDO, etc.

    let pointIdFiltro = pointId;
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      pointIdFiltro = usuario.pointIdGestor;
    } else if (!pointId && usuario.role !== 'ADMIN') {
      return NextResponse.json(
        { mensagem: 'PointId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a tabela CardAgendamento existe
    let tableExists = false;
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'CardAgendamento'
        )`
      );
      tableExists = tableCheck.rows[0]?.exists || false;
    } catch (error: any) {
      console.warn('Erro ao verificar tabela CardAgendamento:', error);
      tableExists = false;
    }

    // Buscar agendamentos que não estão vinculados a nenhum card
    let sql = `SELECT 
      a.id, a."quadraId", a."dataHora", a.duracao, a."valorCalculado", a."valorNegociado", a.status,
      q.id as "quadra_id", q.nome as "quadra_nome",
      u.id as "usuario_id", u.name as "usuario_name",
      a."nomeAvulso", a."telefoneAvulso"
    FROM "Agendamento" a
    INNER JOIN "Quadra" q ON a."quadraId" = q.id
    LEFT JOIN "User" u ON a."usuarioId" = u.id`;
    
    if (tableExists) {
      sql += ` LEFT JOIN "CardAgendamento" ca ON a.id = ca."agendamentoId"
      WHERE ca.id IS NULL -- Apenas agendamentos não vinculados
      AND q."pointId" = $1`;
    } else {
      sql += ` WHERE q."pointId" = $1`;
    }

    const params: any[] = [pointIdFiltro];
    let paramCount = 2;

    if (dataInicio) {
      sql += ` AND a."dataHora" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    if (dataFim) {
      sql += ` AND a."dataHora" <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    if (status) {
      sql += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    } else {
      // Por padrão, mostrar apenas agendamentos confirmados ou concluídos
      sql += ` AND a.status IN ('CONFIRMADO', 'CONCLUIDO')`;
    }

    sql += ` ORDER BY a."dataHora" DESC LIMIT 100`;

    const result = await query(sql, params);

    const agendamentos = result.rows.map((row: any) => ({
      id: row.id,
      quadraId: row.quadraId,
      dataHora: row.dataHora,
      duracao: row.duracao,
      valorCalculado: row.valorCalculado ? parseFloat(row.valorCalculado) : null,
      valorNegociado: row.valorNegociado ? parseFloat(row.valorNegociado) : null,
      status: row.status,
      quadra: {
        id: row.quadra_id,
        nome: row.quadra_nome,
      },
      usuario: row.usuario_id ? {
        id: row.usuario_id,
        name: row.usuario_name,
      } : null,
      nomeAvulso: row.nomeAvulso,
      telefoneAvulso: row.telefoneAvulso,
    }));

    return NextResponse.json(agendamentos);
  } catch (error: any) {
    console.error('Erro ao listar agendamentos disponíveis:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos disponíveis', error: error.message },
      { status: 500 }
    );
  }
}

