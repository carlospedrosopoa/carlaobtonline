// app/api/agendamento/[id]/cancelar/route.ts - Rota para cancelar agendamento
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';

// POST /api/agendamento/[id]/cancelar - Cancelar agendamento
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    const agendamentoCheck = await query(
      'SELECT "usuarioId", status FROM "Agendamento" WHERE id = $1',
      [params.id]
    );

    if (agendamentoCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    const agendamento = agendamentoCheck.rows[0];
    
    if (agendamento.status === 'CANCELADO') {
      return NextResponse.json(
        { mensagem: 'Agendamento já está cancelado' },
        { status: 400 }
      );
    }

    const podeCancelar = usuario.role === 'ADMIN' || 
                        usuario.role === 'ORGANIZER' || 
                        agendamento.usuarioId === usuario.id;

    if (!podeCancelar) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para cancelar este agendamento' },
        { status: 403 }
      );
    }

    const result = await query(
      `UPDATE "Agendamento"
       SET status = 'CANCELADO', "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
         "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
         status, observacoes, "createdAt", "updatedAt"`,
      [params.id]
    );

    // Buscar dados relacionados para retorno completo
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
      [params.id]
    );

    const row = agendamentoCompleto.rows[0];
    const agendamentoRetorno = {
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

    return NextResponse.json(agendamentoRetorno);
  } catch (error: any) {
    console.error('Erro ao cancelar agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao cancelar agendamento', error: error.message },
      { status: 500 }
    );
  }
}

