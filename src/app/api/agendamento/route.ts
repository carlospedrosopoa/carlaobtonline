// app/api/agendamento/route.ts - Rotas de API para Agendamentos (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { gerarAgendamentosRecorrentes } from '@/lib/recorrenciaService';
import type { RecorrenciaConfig } from '@/types/agendamento';

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

    // Construir SQL base
    let sqlBase = `SELECT 
      a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
      a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
      a.status, a.observacoes, a."createdAt", a."updatedAt"`;
    
    // Tentar incluir campos de recorrência
    let sql = sqlBase + `, a."recorrenciaId", a."recorrenciaConfig",
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
      // dataInicio vem como ISO string UTC (ex: "2024-01-15T00:00:00.000Z")
      // Usar diretamente como UTC para comparação no banco
      sql += ` AND a."dataHora" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    if (dataFim) {
      // dataFim vem como ISO string UTC (ex: "2024-01-15T23:59:59.999Z")
      // Usar diretamente como UTC para comparação no banco
      sql += ` AND a."dataHora" <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    if (status) {
      sql += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Se for ORGANIZER, filtrar apenas agendamentos das quadras da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND q."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (apenasMeus && usuario.role !== 'ADMIN') {
      // USER comum vê apenas seus próprios agendamentos
      sql += ` AND a."usuarioId" = $${paramCount}`;
      params.push(usuario.id);
      paramCount++;
    }

    sql += ` ORDER BY a."dataHora" ASC`;

    // Tentar executar com campos de recorrência, se falhar, tentar sem eles
    let result;
    try {
      result = await query(sql, params);
    } catch (error: any) {
      // Se os campos de recorrência não existem, tentar sem eles
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
        sql = sqlBase + `
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
        
        // Reconstruir filtros
        let paramCount = 1;
        if (quadraId) {
          sql += ` AND a."quadraId" = $${paramCount}`;
          paramCount++;
        }
        if (pointId) {
          sql += ` AND q."pointId" = $${paramCount}`;
          paramCount++;
        }
        if (dataInicio) {
          // dataInicio vem como ISO string UTC
          sql += ` AND a."dataHora" >= $${paramCount}`;
          params.push(dataInicio);
          paramCount++;
        }
        if (dataFim) {
          // dataFim vem como ISO string UTC
          sql += ` AND a."dataHora" <= $${paramCount}`;
          params.push(dataFim);
          paramCount++;
        }
        if (status) {
          sql += ` AND a.status = $${paramCount}`;
          params.push(status);
          paramCount++;
        }
        if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
          sql += ` AND q."pointId" = $${paramCount}`;
          params.push(usuario.pointIdGestor);
          paramCount++;
        } else if (apenasMeus && usuario.role !== 'ADMIN') {
          sql += ` AND a."usuarioId" = $${paramCount}`;
          params.push(usuario.id);
          paramCount++;
        }
        sql += ` ORDER BY a."dataHora" ASC`;
        result = await query(sql, params);
      } else {
        throw error;
      }
    }

    // Formatar resultado
    // Garantir que dataHora seja sempre retornada como ISO string UTC
    const agendamentos: any[] = result.rows.map((row) => ({
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
      recorrenciaId: row.recorrenciaId || null,
      recorrenciaConfig: row.recorrenciaConfig 
        ? (typeof row.recorrenciaConfig === 'string' 
          ? JSON.parse(row.recorrenciaConfig) 
          : row.recorrenciaConfig)
        : null,
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

    // Buscar atletas participantes para cada agendamento
    try {
      const agendamentosIds = agendamentos.map(a => a.id);
      if (agendamentosIds.length > 0) {
        const participantesResult = await query(
          `SELECT 
            aa."agendamentoId", aa.id, aa."atletaId", aa."createdAt",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
            at."usuarioId" as "atleta_usuarioId",
            u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
          FROM "AgendamentoAtleta" aa
          LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
          LEFT JOIN "User" u ON at."usuarioId" = u.id
          WHERE aa."agendamentoId" = ANY($1::text[])
          ORDER BY aa."agendamentoId", aa."createdAt" ASC`,
          [agendamentosIds]
        );

        // Agrupar participantes por agendamento
        const participantesPorAgendamento: Record<string, any[]> = {};
        participantesResult.rows.forEach((rowPart: any) => {
          if (!participantesPorAgendamento[rowPart.agendamentoId]) {
            participantesPorAgendamento[rowPart.agendamentoId] = [];
          }
          participantesPorAgendamento[rowPart.agendamentoId].push({
            id: rowPart.id,
            atletaId: rowPart.atletaId,
            atleta: {
              id: rowPart.atleta_id,
              nome: rowPart.atleta_nome,
              fone: rowPart.atleta_fone,
              usuarioId: rowPart.atleta_usuarioId || null,
              usuario: rowPart.usuario_id ? {
                id: rowPart.usuario_id,
                name: rowPart.usuario_name,
                email: rowPart.usuario_email,
              } : null,
            },
            createdAt: rowPart.createdAt,
          });
        });

        // Adicionar participantes a cada agendamento
        agendamentos.forEach(agendamento => {
          agendamento.atletasParticipantes = participantesPorAgendamento[agendamento.id] || [];
        });
      }
    } catch (error: any) {
      // Se a tabela AgendamentoAtleta não existir ainda, apenas logar o erro
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn('Tabela AgendamentoAtleta não encontrada, retornando array vazio para participantes');
        agendamentos.forEach(agendamento => {
          agendamento.atletasParticipantes = [];
        });
      } else {
        console.error('Erro ao buscar atletas participantes:', error);
        agendamentos.forEach(agendamento => {
          agendamento.atletasParticipantes = [];
        });
      }
    }

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
      recorrencia,
      atletasParticipantesIds,
    } = body as {
      quadraId: string;
      dataHora: string;
      duracao?: number;
      observacoes?: string;
      atletaId?: string;
      nomeAvulso?: string;
      telefoneAvulso?: string;
      valorNegociado?: number;
      recorrencia?: RecorrenciaConfig;
      atletasParticipantesIds?: string[];
    };

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

    // Verificar se ORGANIZER tem acesso a esta quadra
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, quadraId);
      if (!temAcesso) {
        return NextResponse.json(
          { mensagem: 'Você não tem permissão para criar agendamentos nesta quadra' },
          { status: 403 }
        );
      }
    }

    // Verificar conflitos de horário
    // Tratar dataHora como horário "naive" (sem timezone) - gravar exatamente como informado
    // dataHora vem no formato "YYYY-MM-DDTHH:mm" (horário escolhido pelo usuário)
    // Vamos salvar exatamente como informado, tratando como UTC direto
    // Isso garante que 20h escolhido = 20h gravado no banco
    const [dataPart, horaPart] = dataHora.split('T');
    const [ano, mes, dia] = dataPart.split('-').map(Number);
    const [hora, minuto] = horaPart.split(':').map(Number);
    
    // Criar data UTC diretamente com os valores informados (sem conversão de timezone)
    // Isso garante que o horário escolhido pelo usuário seja gravado exatamente como informado
    const dataHoraUTC = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
    const dataHoraFim = new Date(dataHoraUTC.getTime() + duracao * 60000);

    const conflitos = await query(
      `SELECT id FROM "Agendamento"
       WHERE "quadraId" = $1
       AND status = 'CONFIRMADO'
       AND (
         ("dataHora" >= $2 AND "dataHora" < $3)
         OR ("dataHora" + (duracao * INTERVAL '1 minute') >= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') <= $3)
         OR ("dataHora" <= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') >= $3)
       )`,
        [quadraId, dataHoraUTC.toISOString(), dataHoraFim.toISOString()]
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
      // Usar hora local (sem conversão de timezone)
      const horaAgendamento = hora * 60 + minuto;
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

    // Função auxiliar para criar um agendamento
    const criarAgendamentoUnico = async (dataHoraAgendamento: Date, recorrenciaId?: string, recorrenciaConfig?: RecorrenciaConfig) => {
      // Verificar conflitos para este agendamento específico
      const dataFimAgendamento = new Date(dataHoraAgendamento.getTime() + duracao * 60000);
      const conflitos = await query(
        `SELECT id FROM "Agendamento"
         WHERE "quadraId" = $1
         AND status = 'CONFIRMADO'
         AND (
           ("dataHora" >= $2 AND "dataHora" < $3)
           OR ("dataHora" + (duracao * INTERVAL '1 minute') >= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') <= $3)
           OR ("dataHora" <= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') >= $3)
         )`,
        [quadraId, dataHoraAgendamento.toISOString(), dataFimAgendamento.toISOString()]
      );

      if (conflitos.rows.length > 0) {
        return null; // Conflito detectado
      }

      // Tentar inserir com campos de recorrência (se existirem)
      try {
        const result = await query(
          `INSERT INTO "Agendamento" (
            id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
            "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
            status, observacoes, "recorrenciaId", "recorrenciaConfig", "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMADO', $11, $12, $13, NOW(), NOW()
          )
          RETURNING id`,
          [
            quadraId,
            usuarioIdFinal,
            atletaId || null,
            nomeAvulso || null,
            telefoneAvulso || null,
            dataHoraAgendamento.toISOString(), // Já está em UTC
            duracao,
            valorHora,
            valorCalculado,
            valorFinal,
            observacoes || null,
            recorrenciaId || null,
            recorrenciaConfig ? JSON.stringify(recorrenciaConfig) : null,
          ]
        );
        return result.rows[0].id;
      } catch (error: any) {
        // Se os campos de recorrência não existem, tentar sem eles
        if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
          const result = await query(
            `INSERT INTO "Agendamento" (
              id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
              "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
              status, observacoes, "createdAt", "updatedAt"
            )
            VALUES (
              gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMADO', $11, NOW(), NOW()
            )
            RETURNING id`,
            [
              quadraId,
              usuarioIdFinal,
              atletaId || null,
              nomeAvulso || null,
              telefoneAvulso || null,
              dataHoraAgendamento.toISOString(), // Já está em UTC
              duracao,
              valorHora,
              valorCalculado,
              valorFinal,
              observacoes || null,
            ]
          );
          return result.rows[0].id;
        }
        throw error;
      }
    };

    // Variável para armazenar o ID do agendamento criado
    let agendamentoId: string;

    // Se há recorrência, gerar todos os agendamentos
    if (recorrencia && recorrencia.tipo) {
      const dadosBase = {
        quadraId,
        usuarioId: usuarioIdFinal,
        atletaId: atletaId || null,
        nomeAvulso: nomeAvulso || null,
        telefoneAvulso: telefoneAvulso || null,
        duracao,
        valorHora,
        valorCalculado,
        valorNegociado: valorFinal,
        observacoes: observacoes || null,
      };

      const agendamentosRecorrentes = gerarAgendamentosRecorrentes(dataHoraUTC, recorrencia, dadosBase);
      
      // Verificar conflitos para todos antes de criar
      const conflitosEncontrados: string[] = [];
      for (const agendamentoRec of agendamentosRecorrentes) {
        const dataAgendamento = new Date(agendamentoRec.dataHora);
        const dataFimAgendamento = new Date(dataAgendamento.getTime() + duracao * 60000);
        const conflitos = await query(
          `SELECT id FROM "Agendamento"
           WHERE "quadraId" = $1
           AND status = 'CONFIRMADO'
           AND (
             ("dataHora" >= $2 AND "dataHora" < $3)
             OR ("dataHora" + (duracao * INTERVAL '1 minute') >= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') <= $3)
             OR ("dataHora" <= $2 AND "dataHora" + (duracao * INTERVAL '1 minute') >= $3)
           )`,
          [quadraId, dataAgendamento.toISOString(), dataFimAgendamento.toISOString()]
        );

        if (conflitos.rows.length > 0) {
          conflitosEncontrados.push(dataAgendamento.toISOString());
        }
      }

      if (conflitosEncontrados.length > 0) {
        return NextResponse.json(
          { mensagem: `Existem conflitos em ${conflitosEncontrados.length} agendamento(s) da recorrência` },
          { status: 400 }
        );
      }

      // Criar todos os agendamentos recorrentes
      const idsCriados: string[] = [];
      for (const agendamentoRec of agendamentosRecorrentes) {
        const id = await criarAgendamentoUnico(
          new Date(agendamentoRec.dataHora),
          agendamentoRec.recorrenciaId,
          agendamentoRec.recorrenciaConfig
        );
        if (id) {
          idsCriados.push(id);
        }
      }

      if (idsCriados.length === 0) {
        return NextResponse.json(
          { mensagem: 'Não foi possível criar nenhum agendamento da recorrência' },
          { status: 400 }
        );
      }

      // Retornar o primeiro agendamento criado
      agendamentoId = idsCriados[0];
    } else {
      // Criar agendamento único (sem recorrência)
      const idCriado = await criarAgendamentoUnico(dataHoraUTC);
      if (!idCriado) {
        return NextResponse.json(
          { mensagem: 'Já existe um agendamento confirmado neste horário' },
          { status: 400 }
        );
      }
      agendamentoId = idCriado;
    }

    // Buscar dados relacionados para retorno completo
    let agendamentoCompleto;
    try {
      // Tentar buscar com campos de recorrência
      agendamentoCompleto = await query(
        `SELECT 
          a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
          a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
          a.status, a.observacoes, a."recorrenciaId", a."recorrenciaConfig", a."createdAt", a."updatedAt",
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
    } catch (error: any) {
      // Se os campos não existem, buscar sem eles
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
        agendamentoCompleto = await query(
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
      } else {
        throw error;
      }
    }

    const row = agendamentoCompleto.rows[0];
    const agendamento: any = {
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
      recorrenciaId: row.recorrenciaId || null,
      recorrenciaConfig: row.recorrenciaConfig 
        ? (typeof row.recorrenciaConfig === 'string' 
          ? JSON.parse(row.recorrenciaConfig) 
          : row.recorrenciaConfig)
        : null,
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

    // Salvar atletas participantes se fornecido
    if (atletasParticipantesIds && atletasParticipantesIds.length > 0) {
      try {
        for (const atletaIdPart of atletasParticipantesIds) {
          await query(
            `INSERT INTO "AgendamentoAtleta" ("agendamentoId", "atletaId", "createdBy", "createdAt")
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT ("agendamentoId", "atletaId") DO NOTHING`,
            [agendamentoId, atletaIdPart, usuario.id]
          );
        }

        // Buscar atletas participantes para retorno
        const participantesResult = await query(
          `SELECT 
            aa.id, aa."atletaId", aa."createdAt",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
            at."usuarioId" as "atleta_usuarioId",
            u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
          FROM "AgendamentoAtleta" aa
          LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
          LEFT JOIN "User" u ON at."usuarioId" = u.id
          WHERE aa."agendamentoId" = $1
          ORDER BY aa."createdAt" ASC`,
          [agendamentoId]
        );

        agendamento.atletasParticipantes = participantesResult.rows.map((rowPart: any) => ({
          id: rowPart.id,
          atletaId: rowPart.atletaId,
          atleta: {
            id: rowPart.atleta_id,
            nome: rowPart.atleta_nome,
            fone: rowPart.atleta_fone,
            usuarioId: rowPart.atleta_usuarioId || null,
            usuario: rowPart.usuario_id ? {
              id: rowPart.usuario_id,
              name: rowPart.usuario_name,
              email: rowPart.usuario_email,
            } : null,
          },
          createdAt: rowPart.createdAt,
        }));
      } catch (error: any) {
        // Se a tabela AgendamentoAtleta não existir ainda, apenas logar o erro
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          console.warn('Tabela AgendamentoAtleta não encontrada, ignorando salvamento de participantes');
          agendamento.atletasParticipantes = [];
        } else {
          console.error('Erro ao salvar atletas participantes:', error);
          // Não falhar a requisição, apenas logar o erro
          agendamento.atletasParticipantes = [];
        }
      }
    } else {
      agendamento.atletasParticipantes = [];
    }

    // Enviar notificação WhatsApp para o gestor (em background, não bloqueia a resposta)
    if (agendamento.quadra?.point?.id) {
      const clienteNome = agendamento.atleta?.nome || agendamento.nomeAvulso || agendamento.usuario?.name || 'Cliente';
      const clienteTelefone = agendamento.atleta?.fone || agendamento.telefoneAvulso || null;
      
      // Não aguardar a resposta do WhatsApp para não bloquear a API
      import('@/lib/whatsappService').then(({ notificarNovoAgendamento }) => {
        notificarNovoAgendamento(
          agendamento.quadra.point.id,
          {
            quadra: agendamento.quadra.nome,
            dataHora: agendamento.dataHora,
            cliente: clienteNome,
            telefone: clienteTelefone,
            duracao: agendamento.duracao,
          }
        ).catch((err) => {
          console.error('Erro ao enviar notificação WhatsApp (não crítico):', err);
        });
      }).catch((err) => {
        console.error('Erro ao importar serviço WhatsApp (não crítico):', err);
      });
    }

    return NextResponse.json(agendamento, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar agendamento', error: error.message },
      { status: 500 }
    );
  }
}

