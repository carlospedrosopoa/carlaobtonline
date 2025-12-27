// app/api/agendamento/[id]/cancelar/route.ts - Rota para cancelar agendamento
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { temRecorrencia } from '@/lib/recorrenciaService';

// POST /api/agendamento/[id]/cancelar - Cancelar agendamento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    let agendamentoCheck;
    try {
      agendamentoCheck = await query(
        'SELECT "usuarioId", "quadraId", status, "recorrenciaId", "dataHora" FROM "Agendamento" WHERE id = $1',
        [id]
      );
    } catch (error: any) {
      if (error.message?.includes('recorrenciaId')) {
        agendamentoCheck = await query(
          'SELECT "usuarioId", "quadraId", status, "dataHora" FROM "Agendamento" WHERE id = $1',
          [id]
        );
      } else {
        throw error;
      }
    }

    if (agendamentoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const agendamento = agendamentoCheck.rows[0];
    
    if (agendamento.status === 'CANCELADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento já está cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões
    let podeCancelar = false;
    
    if (usuario.role === 'ADMIN') {
      podeCancelar = true; // ADMIN pode cancelar tudo
    } else if (usuario.role === 'ORGANIZER') {
      // ORGANIZER pode cancelar agendamentos das quadras da sua arena
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, agendamento.quadraId);
      podeCancelar = temAcesso;
    } else {
      // USER comum pode cancelar apenas seus próprios agendamentos
      podeCancelar = agendamento.usuarioId === usuario.id;
    }

    if (!podeCancelar) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para cancelar este agendamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json().catch(() => ({}));
    const aplicarARecorrencia = body.aplicarARecorrencia || false;
    const temRecorrenciaAtual = !!agendamento.recorrenciaId;

    // Se há recorrência e o usuário quer cancelar todos os futuros
    if (temRecorrenciaAtual && aplicarARecorrencia) {
      const dataHoraAtual = new Date(agendamento.dataHora);
      const recorrenciaId = agendamento.recorrenciaId;
      
      // Cancelar este agendamento e todos os futuros da mesma recorrência
      try {
        await query(
          `UPDATE "Agendamento"
           SET status = 'CANCELADO', "updatedAt" = NOW()
           WHERE "recorrenciaId" = $1
           AND "dataHora" >= $2`,
          [recorrenciaId, dataHoraAtual.toISOString()]
        );
      } catch (error: any) {
        // Se o campo não existe, apenas cancelar este
        if (!error.message?.includes('recorrenciaId')) {
          throw error;
        }
      }
    }

    // Cancelar o agendamento atual (sempre)
    const result = await query(
      `UPDATE "Agendamento"
       SET status = 'CANCELADO', "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
         "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
         status, observacoes, "createdAt", "updatedAt"`,
      [id]
    );

    // Buscar dados relacionados para retorno completo
    const agendamentoCompleto = await query(
      `SELECT 
        a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
        a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
        a.status, a.observacoes, a."createdAt", a."updatedAt",
        q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
        p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
        u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
        at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "Point" p ON q."pointId" = p.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      WHERE a.id = $1`,
      [id]
    );

    const row = agendamentoCompleto.rows[0];
    const agendamentoRetorno = {
      id: row.id,
      quadraId: row.quadraId,
      usuarioId: row.usuarioId,
      atletaId: row.atletaId,
      nomeAvulso: row.nomeAvulso,
      telefoneAvulso: row.telefoneAvulso,
      dataHora: normalizarDataHora(row.dataHora),
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
          logoUrl: row.point_logoUrl || null,
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

    // Enviar notificações Gzappy (em background, não bloqueia a resposta)
    if (agendamentoRetorno.quadra?.point?.id) {
      const clienteNome = agendamentoRetorno.atleta?.nome || agendamentoRetorno.nomeAvulso || agendamentoRetorno.usuario?.name || 'Cliente';
      
      // Prioridade para telefone: telefoneAvulso > fone do atleta vinculado
      const telefoneAtleta = agendamentoRetorno.telefoneAvulso || agendamentoRetorno.atleta?.fone || null;
      
      // Não aguardar a resposta do Gzappy para não bloquear a API
      import('@/lib/gzappyService').then(({ notificarCancelamentoAgendamento, notificarAtletaCancelamentoAgendamento }) => {
        const pointId = agendamentoRetorno.quadra.point.id;
        
        // Enviar notificação para o gestor
        notificarCancelamentoAgendamento(
          pointId,
          {
            quadra: agendamentoRetorno.quadra.nome,
            dataHora: agendamentoRetorno.dataHora,
            cliente: clienteNome,
          }
        ).catch((err) => {
          console.error('Erro ao enviar notificação Gzappy para gestor (não crítico):', err);
        });

        // Enviar notificação para o atleta (se tiver telefone)
        if (telefoneAtleta) {
          notificarAtletaCancelamentoAgendamento(
            pointId,
            {
              quadra: agendamentoRetorno.quadra.nome,
              dataHora: agendamentoRetorno.dataHora,
              telefone: telefoneAtleta,
              nomeAtleta: clienteNome,
              nomeArena: agendamentoRetorno.quadra.point?.nome || 'Arena',
            }
          ).catch((err) => {
            console.error('Erro ao enviar notificação Gzappy para atleta (não crítico):', err);
          });
        } else {
          console.log('Atleta não possui telefone cadastrado, não será enviada notificação de cancelamento');
        }
      }).catch((err) => {
        console.error('Erro ao importar serviço Gzappy (não crítico):', err);
      });
    }

    const response = NextResponse.json(agendamentoRetorno);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao cancelar agendamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao cancelar agendamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

