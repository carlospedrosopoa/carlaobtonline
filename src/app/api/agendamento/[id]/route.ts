// app/api/agendamento/[id]/route.ts - Rotas de API para Agendamento individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { temRecorrencia } from '@/lib/recorrenciaService';

// GET /api/agendamento/[id] - Obter agendamento por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const result = await query(
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
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Verificar se ORGANIZER tem acesso a este agendamento (via quadra)
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, row.quadraId);
      if (!temAcesso) {
        return NextResponse.json(
          { mensagem: 'Você não tem permissão para visualizar este agendamento' },
          { status: 403 }
        );
      }
    } else if (usuario.role === 'USER') {
      // USER comum só pode ver seus próprios agendamentos
      if (row.usuarioId !== usuario.id) {
        return NextResponse.json(
          { mensagem: 'Você não tem permissão para visualizar este agendamento' },
          { status: 403 }
        );
      }
    }
    const agendamento = {
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

    return NextResponse.json(agendamento);
  } catch (error: any) {
    console.error('Erro ao obter agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter agendamento', error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/agendamento/[id] - Atualizar agendamento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    let agendamentoCheck;
    try {
      agendamentoCheck = await query(
        'SELECT "usuarioId", "quadraId", "recorrenciaId", "recorrenciaConfig" FROM "Agendamento" WHERE id = $1',
        [id]
      );
    } catch (error: any) {
      // Se os campos não existem, buscar sem eles
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
        agendamentoCheck = await query(
          'SELECT "usuarioId", "quadraId" FROM "Agendamento" WHERE id = $1',
          [id]
        );
      } else {
        throw error;
      }
    }

    if (agendamentoCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    const agendamentoAtual = agendamentoCheck.rows[0];
    const temRecorrenciaAtual = !!agendamentoAtual.recorrenciaId;
    
    // Verificar permissões
    let podeEditar = false;
    
    if (usuario.role === 'ADMIN') {
      podeEditar = true; // ADMIN pode editar tudo
    } else if (usuario.role === 'ORGANIZER') {
      // ORGANIZER pode editar agendamentos das quadras da sua arena
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, agendamentoAtual.quadraId);
      podeEditar = temAcesso;
    } else {
      // USER comum pode editar apenas seus próprios agendamentos
      podeEditar = agendamentoAtual.usuarioId === usuario.id;
    }

    if (!podeEditar) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para editar este agendamento' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      dataHora,
      duracao,
      observacoes,
      atletaId,
      nomeAvulso,
      telefoneAvulso,
      valorNegociado,
      aplicarARecorrencia = false, // false = apenas este, true = este e todos futuros
    } = body;

    // Se dataHora foi alterada, verificar conflitos
    if (dataHora) {
      // Tratar dataHora como horário local (sem conversão para UTC)
      const [dataPart, horaPart] = dataHora.split('T');
      const [ano, mes, dia] = dataPart.split('-').map(Number);
      const [hora, minuto] = horaPart.split(':').map(Number);
      
      const dataHoraLocal = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
      const duracaoFinal = duracao || agendamentoAtual.duracao || 60;
      const dataHoraFim = new Date(dataHoraLocal.getTime() + duracaoFinal * 60000);

      const conflitos = await query(
        `SELECT id FROM "Agendamento"
         WHERE "quadraId" = $1
         AND id != $2
         AND status = 'CONFIRMADO'
         AND (
           ("dataHora" >= $3 AND "dataHora" < $4)
           OR ("dataHora" + (duracao * INTERVAL '1 minute') >= $3 AND "dataHora" + (duracao * INTERVAL '1 minute') <= $4)
           OR ("dataHora" <= $3 AND "dataHora" + (duracao * INTERVAL '1 minute') >= $4)
         )`,
        [agendamentoAtual.quadraId, id, dataHoraLocal.toISOString(), dataHoraFim.toISOString()]
      );

      if (conflitos.rows.length > 0) {
        return NextResponse.json(
          { mensagem: 'Já existe um agendamento confirmado neste horário' },
          { status: 400 }
        );
      }
    }

    // Recalcular valores se necessário
    let valorHora: number | null = null;
    let valorCalculado: number | null = null;

    if (dataHora || duracao) {
      let horaAgendamento: number | null = null;
      const duracaoFinal = duracao || agendamentoAtual.duracao || 60;

      if (dataHora) {
        // Parsear manualmente para obter hora local
        const [dataPart, horaPart] = dataHora.split('T');
        const [, , , hora, minuto] = [...dataPart.split('-').map(Number), ...horaPart.split(':').map(Number)];
        horaAgendamento = hora * 60 + minuto;
      }

      const tabelaPrecoResult = await query(
        `SELECT "valorHora", "inicioMinutoDia", "fimMinutoDia"
         FROM "TabelaPreco"
         WHERE "quadraId" = $1 AND ativo = true
         ORDER BY "inicioMinutoDia" ASC`,
        [agendamentoAtual.quadraId]
      );

      if (tabelaPrecoResult.rows.length > 0 && horaAgendamento !== null) {
        const precoAplicavel = tabelaPrecoResult.rows.find((tp: any) => {
          return horaAgendamento! >= tp.inicioMinutoDia && horaAgendamento! < tp.fimMinutoDia;
        });

        if (precoAplicavel) {
          valorHora = parseFloat(precoAplicavel.valorHora);
          valorCalculado = (valorHora * duracaoFinal) / 60;
        }
      }
    }

    // Montar campos de atualização
    const updates: string[] = [];
    const paramsUpdate: any[] = [];
    let paramCount = 1;

    if (dataHora) {
      // Tratar dataHora como horário local (sem conversão para UTC)
      const [dataPart, horaPart] = dataHora.split('T');
      const [ano, mes, dia] = dataPart.split('-').map(Number);
      const [hora, minuto] = horaPart.split(':').map(Number);
      const dataHoraLocal = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
      
      updates.push(`"dataHora" = $${paramCount}`);
      paramsUpdate.push(dataHoraLocal.toISOString());
      paramCount++;
    }

    if (duracao !== undefined) {
      updates.push(`duracao = $${paramCount}`);
      paramsUpdate.push(duracao);
      paramCount++;
    }

    if (observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      paramsUpdate.push(observacoes || null);
      paramCount++;
    }

    if (atletaId !== undefined) {
      updates.push(`"atletaId" = $${paramCount}`);
      paramsUpdate.push(atletaId || null);
      paramCount++;
    }

    if (nomeAvulso !== undefined) {
      updates.push(`"nomeAvulso" = $${paramCount}`);
      paramsUpdate.push(nomeAvulso || null);
      paramCount++;
    }

    if (telefoneAvulso !== undefined) {
      updates.push(`"telefoneAvulso" = $${paramCount}`);
      paramsUpdate.push(telefoneAvulso || null);
      paramCount++;
    }

    if (valorHora !== null) {
      updates.push(`"valorHora" = $${paramCount}`);
      paramsUpdate.push(valorHora);
      paramCount++;
    }

    if (valorCalculado !== null) {
      updates.push(`"valorCalculado" = $${paramCount}`);
      paramsUpdate.push(valorCalculado);
      paramCount++;
    }

    if (valorNegociado !== undefined) {
      updates.push(`"valorNegociado" = $${paramCount}`);
      paramsUpdate.push(valorNegociado || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    updates.push(`"updatedAt" = NOW()`);
    
    // Se há recorrência e o usuário quer aplicar a todos os futuros
    if (temRecorrenciaAtual && aplicarARecorrencia) {
      // Buscar data/hora atual do agendamento para identificar quais são os "futuros"
      let agendamentoData;
      try {
        agendamentoData = await query(
          'SELECT "dataHora", "recorrenciaId" FROM "Agendamento" WHERE id = $1',
          [id]
        );
      } catch (error: any) {
        if (error.message?.includes('recorrenciaId')) {
          agendamentoData = await query(
            'SELECT "dataHora" FROM "Agendamento" WHERE id = $1',
            [id]
          );
        } else {
          throw error;
        }
      }
      
      const dataHoraAtual = new Date(agendamentoData.rows[0].dataHora);
      const recorrenciaId = agendamentoData.rows[0].recorrenciaId;
      
      if (recorrenciaId) {
        // Atualizar todos os futuros da mesma recorrência (incluindo este)
        const sqlFuturos = `UPDATE "Agendamento"
                     SET ${updates.join(', ')}
                     WHERE "recorrenciaId" = $${paramCount}
                     AND "dataHora" >= $${paramCount + 1}`;
        
        const paramsFuturos = [...paramsUpdate];
        paramsFuturos.push(recorrenciaId);
        paramsFuturos.push(dataHoraAtual.toISOString());
        
        await query(sqlFuturos, paramsFuturos);
      }
    }
    
    // Atualizar o agendamento atual (sempre)
    paramsUpdate.push(id);
    const sql = `UPDATE "Agendamento"
                 SET ${updates.join(', ')}
                 WHERE id = $${paramCount}
                 RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                   "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                   status, observacoes, "createdAt", "updatedAt"`;

    const result = await query(sql, paramsUpdate);

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
      [id]
    );

    const row = agendamentoCompleto.rows[0];
    const agendamento = {
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

    return NextResponse.json(agendamento);
  } catch (error: any) {
    console.error('Erro ao atualizar agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar agendamento', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/agendamento/[id] - Deletar agendamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    let agendamentoCheck;
    try {
      agendamentoCheck = await query(
        'SELECT "usuarioId", "quadraId", "recorrenciaId", "dataHora" FROM "Agendamento" WHERE id = $1',
        [id]
      );
    } catch (error: any) {
      if (error.message?.includes('recorrenciaId')) {
        agendamentoCheck = await query(
          'SELECT "usuarioId", "quadraId", "dataHora" FROM "Agendamento" WHERE id = $1',
          [id]
        );
      } else {
        throw error;
      }
    }

    if (agendamentoCheck.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    const agendamento = agendamentoCheck.rows[0];
    
    // Verificar permissões
    let podeDeletar = false;
    if (usuario.role === 'ADMIN') {
      podeDeletar = true;
    } else if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, agendamento.quadraId);
      podeDeletar = temAcesso;
    } else {
      podeDeletar = agendamento.usuarioId === usuario.id;
    }

    if (!podeDeletar) {
      return NextResponse.json(
        { mensagem: 'Você não tem permissão para deletar este agendamento' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const aplicarARecorrencia = body.aplicarARecorrencia || false;
    const temRecorrenciaAtual = !!agendamento.recorrenciaId;

    // Se há recorrência e o usuário quer deletar todos os futuros
    if (temRecorrenciaAtual && aplicarARecorrencia) {
      const dataHoraAtual = new Date(agendamento.dataHora);
      const recorrenciaId = agendamento.recorrenciaId;
      
      // Deletar este agendamento e todos os futuros da mesma recorrência
      try {
        await query(
          `DELETE FROM "Agendamento"
           WHERE "recorrenciaId" = $1
           AND "dataHora" >= $2`,
          [recorrenciaId, dataHoraAtual.toISOString()]
        );
        return NextResponse.json({ mensagem: 'Agendamento(s) deletado(s) com sucesso' });
      } catch (error: any) {
        // Se o campo não existe, apenas deletar este
        if (!error.message?.includes('recorrenciaId')) {
          throw error;
        }
      }
    }

    // Deletar o agendamento atual (sempre)
    const result = await query(
      `DELETE FROM "Agendamento" WHERE id = $1 RETURNING id`,
      [id]
    );

    return NextResponse.json({ mensagem: 'Agendamento deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao deletar agendamento', error: error.message },
      { status: 500 }
    );
  }
}

