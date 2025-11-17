// app/api/agendamento/route.ts - Rotas de API para Agendamentos (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';

// GET /api/agendamento - Listar agendamentos com filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quadraId = searchParams.get('quadraId');
    const pointId = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const status = searchParams.get('status');
    const apenasMeus = searchParams.get('apenasMeus') === 'true';

    // Obter usuário autenticado
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    let sql = `SELECT 
      a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
      a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
      a.status, a.observacoes, a."createdAt", a."updatedAt",
      q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
      p.id as "point_id", p.nome as "point_nome",
      u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
      at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone"
    FROM "Agendamento" a
    LEFT JOIN "Quadra" q ON a."quadraId" = q.id
    LEFT JOIN "Point" p ON q."pointId" = p.id
    LEFT JOIN "User" u ON a."usuarioId" = u.id
    LEFT JOIN "Atleta" at ON a."atletaId" = at.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    if (quadraId) {
      sql += ` AND a."quadraId" = $${paramCount}`;
      params.push(quadraId);
      paramCount++;
    }

    if (pointId) {
      sql += ` AND q."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    }

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
    }

    if (apenasMeus && usuario.role !== 'ADMIN') {
      sql += ` AND a."usuarioId" = $${paramCount}`;
      params.push(usuario.id);
      paramCount++;
    }

    sql += ` ORDER BY a."dataHora" ASC`;

    const result = await query(sql, params);

    // Formatar resultado
    const agendamentos = result.rows.map((row) => ({
      id: row.id,
      quadraId: row.quadraId,
      usuarioId: row.usuarioId,
      atletaId: row.atletaId,
      nomeAvulso: row.nomeAvulso,
      telefoneAvulso: row.telefoneAvulso,
      dataHora: row.dataHora,
      duracao: row.duracao,
      valorHora: row.valorHora,
      valorCalculado: row.valorCalculado,
      valorNegociado: row.valorNegociado,
      status: row.status,
      observacoes: row.observacoes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      quadra: {
        id: row.quadra_id,
        nome: row.quadra_nome,
        pointId: row.quadra_pointId,
        point: {
          id: row.point_id,
          nome: row.point_nome,
        },
      },
      usuario: row.usuario_id ? {
        id: row.usuario_id,
        name: row.usuario_name,
        email: row.usuario_email,
      } : null,
      atleta: row.atleta_id ? {
        id: row.atleta_id,
        nome: row.atleta_nome,
        fone: row.atleta_fone,
      } : null,
    }));

    return NextResponse.json(agendamentos);
  } catch (error: any) {
    console.error('Erro ao listar agendamentos:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/agendamento - Criar novo agendamento
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      quadraId,
      dataHora,
      duracao = 60,
      observacoes,
      atletaId,
      nomeAvulso,
      telefoneAvulso,
      valorNegociado,
    } = body;

    if (!quadraId || !dataHora) {
      return NextResponse.json(
        { mensagem: 'Quadra e data/hora são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a quadra existe
    const quadraCheck = await query('SELECT id, "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
    if (quadraCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
    }

    // Verificar conflitos de horário
    const dataHoraInicio = new Date(dataHora);
    const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60000);

    const conflitos = await query(
      `SELECT id FROM "Agendamento"
       WHERE "quadraId" = $1
       AND status = 'CONFIRMADO'
       AND (
         ("dataHora" >= $2 AND "dataHora" < $3)
         OR ("dataHora" + (duracao * INTERVAL '1 minute') >= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') <= $3)
         OR ("dataHora" <= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') >= $3)
       )`,
      [quadraId, dataHoraInicio.toISOString(), dataHoraFim.toISOString()]
    );

    if (conflitos.rows.length > 0) {
      return NextResponse.json(
        { mensagem: 'Já existe um agendamento confirmado neste horário' },
        { status: 400 }
      );
    }

    // Calcular valores (buscar tabela de preços da quadra)
    let valorHora: number | null = null;
    let valorCalculado: number | null = null;

    const tabelaPrecoResult = await query(
      `SELECT "valorHora", "inicioMinutoDia", "fimMinutoDia"
       FROM "TabelaPreco"
       WHERE "quadraId" = $1 AND ativo = true
       ORDER BY "inicioMinutoDia" ASC`,
      [quadraId]
    );

    if (tabelaPrecoResult.rows.length > 0) {
      const horaAgendamento = dataHoraInicio.getHours() * 60 + dataHoraInicio.getMinutes();
      const precoAplicavel = tabelaPrecoResult.rows.find((tp: any) => {
        return horaAgendamento >= tp.inicioMinutoDia && horaAgendamento < tp.fimMinutoDia;
      });

      if (precoAplicavel) {
        valorHora = parseFloat(precoAplicavel.valorHora);
        valorCalculado = (valorHora * duracao) / 60;
      }
    }

    // Se valorNegociado foi informado, usar ele; senão usar valorCalculado
    const valorFinal = valorNegociado != null ? valorNegociado : valorCalculado;

    // Determinar usuarioId: se for admin/organizer agendando para atleta ou avulso, pode ser null
    const usuarioIdFinal = (atletaId || nomeAvulso) ? null : usuario.id;

    const result = await query(
      `INSERT INTO "Agendamento" (
        id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
        "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
        status, observacoes, "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMADO', $11, NOW(), NOW()
      )
      RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
        "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
        status, observacoes, "createdAt", "updatedAt"`,
      [
        quadraId,
        usuarioIdFinal,
        atletaId || null,
        nomeAvulso || null,
        telefoneAvulso || null,
        dataHoraInicio.toISOString(),
        duracao,
        valorHora,
        valorCalculado,
        valorFinal,
        observacoes || null,
      ]
    );

    // Buscar dados relacionados para retorno completo
    const agendamentoId = result.rows[0].id;
    const agendamentoCompleto = await query(
      `SELECT 
        a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
        a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
        a.status, a.observacoes, a."createdAt", a."updatedAt",
        q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
        p.id as "point_id", p.nome as "point_nome",
        u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
        at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "Point" p ON q."pointId" = p.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      WHERE a.id = $1`,
      [agendamentoId]
    );

    const row = agendamentoCompleto.rows[0];
    const agendamento = {
      id: row.id,
      quadraId: row.quadraId,
      usuarioId: row.usuarioId,
      atletaId: row.atletaId,
      nomeAvulso: row.nomeAvulso,
      telefoneAvulso: row.telefoneAvulso,
      dataHora: row.dataHora,
      duracao: row.duracao,
      valorHora: row.valorHora,
      valorCalculado: row.valorCalculado,
      valorNegociado: row.valorNegociado,
      status: row.status,
      observacoes: row.observacoes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      quadra: {
        id: row.quadra_id,
        nome: row.quadra_nome,
        pointId: row.quadra_pointId,
        point: {
          id: row.point_id,
          nome: row.point_nome,
        },
      },
      usuario: row.usuario_id ? {
        id: row.usuario_id,
        name: row.usuario_name,
        email: row.usuario_email,
      } : null,
      atleta: row.atleta_id ? {
        id: row.atleta_id,
        nome: row.atleta_nome,
        fone: row.atleta_fone,
      } : null,
    };

    return NextResponse.json(agendamento, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar agendamento', error: error.message },
      { status: 500 }
    );
  }
}

