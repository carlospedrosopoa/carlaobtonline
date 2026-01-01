// app/api/agendamento/route.ts - Rotas de API para Agendamentos (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { gerarAgendamentosRecorrentes } from '@/lib/recorrenciaService';
import { withCors } from '@/lib/cors';
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
    const incluirPassados = searchParams.get('incluirPassados') === 'true';

    // Obter usuário autenticado
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Construir SQL base (sem campos opcionais: professorId, ehAula, recorrenciaId)
    let sqlBase = `SELECT 
      a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
      a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
      a.status, a.observacoes, a."createdAt", a."updatedAt"`;
    
    // Tentar incluir campos de recorrência e professor
    let sql = sqlBase + `, a."recorrenciaId", a."recorrenciaConfig", a."ehAula", a."professorId",
      q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
      p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
      u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
      at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", at."usuarioId" as "atleta_usuarioId",
      pr.id as "professor_id", pr."userId" as "professor_userId", pr.especialidade as "professor_especialidade",
      pr.bio as "professor_bio", pr."valorHora" as "professor_valorHora", pr.ativo as "professor_ativo",
      up.id as "professor_usuario_id", up.name as "professor_usuario_name", up.email as "professor_usuario_email"
    FROM "Agendamento" a
    LEFT JOIN "Quadra" q ON a."quadraId" = q.id
    LEFT JOIN "Point" p ON q."pointId" = p.id
    LEFT JOIN "User" u ON a."usuarioId" = u.id
    LEFT JOIN "Atleta" at ON a."atletaId" = at.id
    LEFT JOIN "Professor" pr ON a."professorId" = pr.id
    LEFT JOIN "User" up ON pr."userId" = up.id
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

    // Filtro de data: lógica diferente para atletas (USER com apenasMeus) vs outros
    if (apenasMeus && usuario.role === 'USER' && !dataInicio && !dataFim) {
      // Para atletas: por padrão mostrar apenas próximos 10 dias (hoje até hoje+10 dias)
      // Só incluir passados se incluirPassados=true (sem limite superior quando incluir passados)
      const hoje = new Date();
      hoje.setUTCHours(0, 0, 0, 0);
      
      if (incluirPassados) {
        // Se pediu passados, mostrar todos (incluindo passados, sem limite de data fim)
        // Não aplicar filtro de data mínima, apenas máximo de 10 dias no futuro
        const dataFimLimite = new Date(hoje);
        dataFimLimite.setUTCDate(dataFimLimite.getUTCDate() + 10);
        dataFimLimite.setUTCHours(23, 59, 59, 999);
        sql += ` AND a."dataHora" <= $${paramCount}`;
        params.push(dataFimLimite.toISOString());
        paramCount++;
      } else {
        // Por padrão: apenas próximos 10 dias (hoje até hoje+10 dias, sem passados)
        const dataFimLimite = new Date(hoje);
        dataFimLimite.setUTCDate(dataFimLimite.getUTCDate() + 10);
        dataFimLimite.setUTCHours(23, 59, 59, 999);
        sql += ` AND a."dataHora" >= $${paramCount} AND a."dataHora" <= $${paramCount + 1}`;
        params.push(hoje.toISOString());
        params.push(dataFimLimite.toISOString());
        paramCount += 2;
      }
    } else if (!incluirPassados && !dataInicio) {
      // Para ADMIN/ORGANIZER ou quando não for apenasMeus: comportamento padrão (hoje em diante)
      const hoje = new Date();
      hoje.setUTCHours(0, 0, 0, 0);
      sql += ` AND a."dataHora" >= $${paramCount}`;
      params.push(hoje.toISOString());
      paramCount++;
    } else if (dataInicio) {
      // Se dataInicio foi especificada, usar ela
      sql += ` AND a."dataHora" >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    // dataFim só é aplicado se não aplicamos o limite de 10 dias acima
    // (ou seja, se dataFim foi passado explicitamente ou se não for atleta com apenasMeus)
    if (dataFim && !(apenasMeus && usuario.role === 'USER' && !dataInicio && !incluirPassados)) {
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
      // Buscar agendamentos onde:
      // 1. usuarioId = usuario.id (agendamentos que o atleta criou)
      // 2. atletaId = atleta do usuário (agendamentos onde a arena colocou o atleta como cliente principal)
      // 3. atleta é participante do agendamento (na tabela AgendamentoAtleta)
      if (usuario.role === 'USER') {
        // Buscar o atletaId do usuário
        const atletaResult = await query(
          `SELECT id FROM "Atleta" WHERE "usuarioId" = $1 LIMIT 1`,
          [usuario.id]
        );
        
        if (atletaResult.rows.length > 0) {
          const atletaId = atletaResult.rows[0].id;
          // Incluir agendamentos onde:
          // - usuarioId = usuario.id OU
          // - atletaId = atleta do usuário OU
          // - atleta é participante (usando EXISTS para verificar na tabela AgendamentoAtleta)
          sql += ` AND (
            a."usuarioId" = $${paramCount} OR 
            a."atletaId" = $${paramCount + 1} OR
            EXISTS (
              SELECT 1 FROM "AgendamentoAtleta" aa 
              WHERE aa."agendamentoId" = a.id 
              AND aa."atletaId" = $${paramCount + 1}
            )
          )`;
          params.push(usuario.id);
          params.push(atletaId);
          paramCount += 2;
        } else {
          // Se não tiver atleta, buscar apenas por usuarioId
          sql += ` AND a."usuarioId" = $${paramCount}`;
          params.push(usuario.id);
          paramCount++;
        }
      } else {
        // Para outros roles (ORGANIZER), buscar apenas por usuarioId
        sql += ` AND a."usuarioId" = $${paramCount}`;
        params.push(usuario.id);
        paramCount++;
      }
    }

    sql += ` ORDER BY a."dataHora" ASC`;

    // Tentar executar com campos de recorrência e professor, se falhar, tentar sem eles
    let result;
    try {
      result = await query(sql, params);
    } catch (error: any) {
      // Se os campos de recorrência, ehAula ou professorId não existem, tentar sem eles
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig') || 
          error.message?.includes('professorId') || error.message?.includes('ehAula') ||
          error.code === '42703') { // 42703 = column does not exist
        sql = sqlBase + `,
      q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
      p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
      u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
      at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", at."usuarioId" as "atleta_usuarioId",
      NULL as "recorrenciaId", NULL as "recorrenciaConfig",
      NULL as "ehAula", NULL as "professorId", NULL as "professor_id", NULL as "professor_userId", NULL as "professor_especialidade",
      NULL as "professor_bio", NULL as "professor_valorHora", NULL as "professor_ativo",
      NULL as "professor_usuario_id", NULL as "professor_usuario_name", NULL as "professor_usuario_email"
    FROM "Agendamento" a
    LEFT JOIN "Quadra" q ON a."quadraId" = q.id
    LEFT JOIN "Point" p ON q."pointId" = p.id
    LEFT JOIN "User" u ON a."usuarioId" = u.id
    LEFT JOIN "Atleta" at ON a."atletaId" = at.id
    WHERE 1=1`;
        
        // Reconstruir filtros e params
        const paramsFallback: any[] = [];
        let paramCount = 1;
        if (quadraId) {
          sql += ` AND a."quadraId" = $${paramCount}`;
          paramsFallback.push(quadraId);
          paramCount++;
        }
        if (pointId) {
          sql += ` AND q."pointId" = $${paramCount}`;
          paramsFallback.push(pointId);
          paramCount++;
        }
        // Filtro de data: lógica diferente para atletas (USER com apenasMeus) vs outros
        if (apenasMeus && usuario.role === 'USER' && !dataInicio && !dataFim) {
          // Para atletas: por padrão mostrar apenas próximos 10 dias (hoje até hoje+10 dias)
          // Só incluir passados se incluirPassados=true (sem limite superior quando incluir passados)
          const hoje = new Date();
          hoje.setUTCHours(0, 0, 0, 0);
          
          if (incluirPassados) {
            // Se pediu passados, mostrar todos (incluindo passados, sem limite de data fim)
            // Não aplicar filtro de data mínima, apenas máximo de 10 dias no futuro
            const dataFimLimite = new Date(hoje);
            dataFimLimite.setUTCDate(dataFimLimite.getUTCDate() + 10);
            dataFimLimite.setUTCHours(23, 59, 59, 999);
            sql += ` AND a."dataHora" <= $${paramCount}`;
            paramsFallback.push(dataFimLimite.toISOString());
            paramCount++;
          } else {
            // Por padrão: apenas próximos 10 dias (hoje até hoje+10 dias, sem passados)
            const dataFimLimite = new Date(hoje);
            dataFimLimite.setUTCDate(dataFimLimite.getUTCDate() + 10);
            dataFimLimite.setUTCHours(23, 59, 59, 999);
            sql += ` AND a."dataHora" >= $${paramCount} AND a."dataHora" <= $${paramCount + 1}`;
            paramsFallback.push(hoje.toISOString());
            paramsFallback.push(dataFimLimite.toISOString());
            paramCount += 2;
          }
        } else if (!incluirPassados && !dataInicio) {
          // Para ADMIN/ORGANIZER ou quando não for apenasMeus: comportamento padrão (hoje em diante)
          const hoje = new Date();
          hoje.setUTCHours(0, 0, 0, 0);
          sql += ` AND a."dataHora" >= $${paramCount}`;
          paramsFallback.push(hoje.toISOString());
          paramCount++;
        } else if (dataInicio) {
          // Se dataInicio foi especificada, usar ela
          sql += ` AND a."dataHora" >= $${paramCount}`;
          paramsFallback.push(dataInicio);
          paramCount++;
        }
        
        // dataFim só é aplicado se não aplicamos o limite de 10 dias acima
        // (ou seja, se dataFim foi passado explicitamente ou se não for atleta com apenasMeus)
        if (dataFim && !(apenasMeus && usuario.role === 'USER' && !dataInicio && !incluirPassados)) {
          // dataFim vem como ISO string UTC
          sql += ` AND a."dataHora" <= $${paramCount}`;
          paramsFallback.push(dataFim);
          paramCount++;
        }
        if (status) {
          sql += ` AND a.status = $${paramCount}`;
          paramsFallback.push(status);
          paramCount++;
        }
        if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
          sql += ` AND q."pointId" = $${paramCount}`;
          paramsFallback.push(usuario.pointIdGestor);
          paramCount++;
        } else if (apenasMeus && usuario.role !== 'ADMIN') {
          // USER comum vê apenas seus próprios agendamentos
          // Buscar agendamentos onde:
          // 1. usuarioId = usuario.id (agendamentos que o atleta criou)
          // 2. atletaId = atleta do usuário (agendamentos onde a arena colocou o atleta como cliente principal)
          // 3. atleta é participante do agendamento (na tabela AgendamentoAtleta)
          if (usuario.role === 'USER') {
            // Buscar o atletaId do usuário
            const atletaResult = await query(
              `SELECT id FROM "Atleta" WHERE "usuarioId" = $1 LIMIT 1`,
              [usuario.id]
            );
            
            if (atletaResult.rows.length > 0) {
              const atletaId = atletaResult.rows[0].id;
              // Incluir agendamentos onde:
              // - usuarioId = usuario.id OU
              // - atletaId = atleta do usuário OU
              // - atleta é participante (usando EXISTS para verificar na tabela AgendamentoAtleta)
              sql += ` AND (
                a."usuarioId" = $${paramCount} OR 
                a."atletaId" = $${paramCount + 1} OR
                EXISTS (
                  SELECT 1 FROM "AgendamentoAtleta" aa 
                  WHERE aa."agendamentoId" = a.id 
                  AND aa."atletaId" = $${paramCount + 1}
                )
              )`;
              paramsFallback.push(usuario.id);
              paramsFallback.push(atletaId);
              paramCount += 2;
            } else {
              // Se não tiver atleta, buscar apenas por usuarioId
              sql += ` AND a."usuarioId" = $${paramCount}`;
              paramsFallback.push(usuario.id);
              paramCount++;
            }
          } else {
            // Para outros roles (ORGANIZER), buscar apenas por usuarioId
            sql += ` AND a."usuarioId" = $${paramCount}`;
            paramsFallback.push(usuario.id);
            paramCount++;
          }
        }
        sql += ` ORDER BY a."dataHora" ASC`;
        result = await query(sql, paramsFallback);
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
        usuarioId: row.atleta_usuarioId || null,
      } : null,
      ehAula: row.ehAula === true || row.ehAula === 'true' || row.ehAula === 1,
      professorId: row.professorId || null,
      professor: row.professor_id ? {
        id: row.professor_id,
        userId: row.professor_userId,
        especialidade: row.professor_especialidade,
        bio: row.professor_bio,
        valorHora: row.professor_valorHora,
        ativo: row.professor_ativo,
        usuario: row.professor_usuario_id ? {
          id: row.professor_usuario_id,
          name: row.professor_usuario_name,
          email: row.professor_usuario_email,
        } : null,
      } : null,
      // Inicializar atletasParticipantes como array vazio (será preenchido depois)
      atletasParticipantes: [],
    }));

    // Buscar atletas participantes para cada agendamento
    try {
      const agendamentosIds = agendamentos.map(a => a.id);
      if (agendamentosIds.length > 0) {
        const participantesResult = await query(
          `SELECT 
            aa."agendamentoId", aa.id, aa."atletaId", aa."createdAt",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
            at."usuarioId" as "atleta_usuarioId", at."fotoUrl" as "atleta_fotoUrl",
            u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
          FROM "AgendamentoAtleta" aa
          LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
          LEFT JOIN "User" u ON at."usuarioId" = u.id
          WHERE aa."agendamentoId" = ANY($1::text[])
          ORDER BY aa."agendamentoId", aa."createdAt" ASC`,
          [agendamentosIds]
        );

        console.log(`[GET /api/agendamento] Buscando participantes para ${agendamentosIds.length} agendamentos`);
        console.log(`[GET /api/agendamento] Encontrados ${participantesResult.rows.length} registros de participantes`);

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
              fotoUrl: rowPart.atleta_fotoUrl || null,
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
          if (agendamento.atletasParticipantes.length > 0) {
            console.log(`[GET /api/agendamento] Agendamento ${agendamento.id} tem ${agendamento.atletasParticipantes.length} participantes`);
          }
        });
      } else {
        // Se não há agendamentos, garantir que o array está vazio
        agendamentos.forEach(agendamento => {
          agendamento.atletasParticipantes = [];
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
        console.error('Stack trace:', error.stack);
        agendamentos.forEach(agendamento => {
          agendamento.atletasParticipantes = [];
        });
      }
    }

    const response = NextResponse.json(agendamentos);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar agendamentos:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar agendamentos', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/agendamento - Criar novo agendamento
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

    const body = await request.json();
    
    // Log completo do body recebido para debug
    console.log('[POST /api/agendamento] ============================================');
    console.log('[POST /api/agendamento] Body completo recebido:', JSON.stringify(body, null, 2));
    console.log('[POST /api/agendamento] ============================================');
    
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
      ehAula,
      professorId,
      competicaoId,
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
      ehAula?: boolean;
      professorId?: string | null;
      competicaoId?: string | null;
    };
    
    // Log dos valores extraídos
    console.log('[POST /api/agendamento] Valores extraídos do body:', {
      ehAula: ehAula,
      ehAulaType: typeof ehAula,
      professorId: professorId,
      professorIdType: typeof professorId,
    });

    if (!quadraId || !dataHora) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra e data/hora são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se a quadra existe
    const quadraCheck = await query('SELECT id, "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
    if (quadraCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Quadra não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se ORGANIZER tem acesso a esta quadra
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, quadraId);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para criar agendamentos nesta quadra' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
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
       AND "dataHora" < $3
       AND ("dataHora" + (duracao * INTERVAL '1 minute')) > $2`,
        [quadraId, dataHoraUTC.toISOString(), dataHoraFim.toISOString()]
    );

    if (conflitos.rows.length > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Já existe um agendamento confirmado neste horário' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar se ehAula requer professorId
    // Garantir que ehAula seja boolean (true/false, não undefined)
    const ehAulaFinal = ehAula === true || Boolean(ehAula);
    
    // Debug log (remover em produção se necessário)
    console.log('[POST /api/agendamento] Valores recebidos:', {
      ehAula: ehAula,
      ehAulaFinal: ehAulaFinal,
      professorId: professorId,
    });
    
    if (ehAulaFinal && !professorId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'professorId é obrigatório quando ehAula é true' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se professor existe (se informado)
    if (professorId) {
      const professorCheck = await query('SELECT id FROM "Professor" WHERE id = $1', [professorId]);
      if (professorCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Professor não encontrado' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Calcular valores (buscar tabela de preços da quadra)
    let valorHora: number | null = null;
    let valorCalculado: number | null = null;

    // Se for aula, buscar valorHoraAula, senão valorHora
    const campoValor = ehAulaFinal ? 'valorHoraAula' : 'valorHora';
    const tabelaPrecoResult = await query(
      `SELECT "valorHora", "valorHoraAula", "inicioMinutoDia", "fimMinutoDia"
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
        if (ehAulaFinal) {
          // Para aula, usar valorHoraAula se disponível, senão usar valorHora como fallback
          valorHora = precoAplicavel.valorHoraAula !== null && precoAplicavel.valorHoraAula !== undefined
            ? parseFloat(precoAplicavel.valorHoraAula)
            : parseFloat(precoAplicavel.valorHora);
        } else {
          valorHora = parseFloat(precoAplicavel.valorHora);
        }
        valorCalculado = (valorHora * duracao) / 60;
      }
    }

    // Se valorNegociado foi informado, usar ele; senão usar valorCalculado
    const valorFinal = valorNegociado != null ? valorNegociado : valorCalculado;

    // Se for USER (appatleta), buscar e vincular automaticamente o perfil de atleta
    let atletaIdFinal = atletaId;
    let nomeAvulsoFinal = nomeAvulso;
    let telefoneAvulsoFinal = telefoneAvulso;

    if (usuario.role === 'USER') {
      // Buscar perfil de atleta do usuário
      const perfilAtletaResult = await query(
        `SELECT id FROM "Atleta" WHERE "usuarioId" = $1 LIMIT 1`,
        [usuario.id]
      );

      if (perfilAtletaResult.rows.length > 0) {
        // Vincular automaticamente ao atleta do usuário
        atletaIdFinal = perfilAtletaResult.rows[0].id;
        nomeAvulsoFinal = undefined;
        telefoneAvulsoFinal = undefined;
      } else {
        // Se não tiver perfil de atleta, retornar erro
        const errorResponse = NextResponse.json(
          { mensagem: 'Você precisa ter um perfil de atleta cadastrado para criar agendamentos' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Determinar usuarioId: 
    // - Para USER: sempre deve ser o id do usuário (mesmo que tenha atletaId vinculado)
    // - Para ADMIN/ORGANIZER: pode ser null se estiver agendando para atleta ou avulso
    const usuarioIdFinal = usuario.role === 'USER' 
      ? usuario.id 
      : ((atletaIdFinal || nomeAvulsoFinal) ? null : usuario.id);

    // Função auxiliar para criar um agendamento
    const criarAgendamentoUnico = async (dataHoraAgendamento: Date, recorrenciaId?: string, recorrenciaConfig?: RecorrenciaConfig) => {
      // Verificar conflitos para este agendamento específico
      const dataFimAgendamento = new Date(dataHoraAgendamento.getTime() + duracao * 60000);
      const conflitos = await query(
        `SELECT id FROM "Agendamento"
         WHERE "quadraId" = $1
         AND status = 'CONFIRMADO'
         AND "dataHora" < $3
         AND ("dataHora" + (duracao * INTERVAL '1 minute')) > $2`,
        [quadraId, dataHoraAgendamento.toISOString(), dataFimAgendamento.toISOString()]
      );

      if (conflitos.rows.length > 0) {
        return null; // Conflito detectado
      }

      // Tentar inserir com campos de recorrência e aula (se existirem)
      try {
        // Valores que serão inseridos
        const valoresInsercao = {
          quadraId,
          usuarioIdFinal,
          atletaIdFinal: atletaIdFinal || null,
          nomeAvulsoFinal: nomeAvulsoFinal || null,
          telefoneAvulsoFinal: telefoneAvulsoFinal || null,
          dataHora: dataHoraAgendamento.toISOString(),
          duracao,
          valorHora,
          valorCalculado,
          valorFinal,
          observacoes: observacoes || null,
          recorrenciaId: recorrenciaId || null,
          recorrenciaConfig: recorrenciaConfig ? JSON.stringify(recorrenciaConfig) : null,
          ehAula: ehAulaFinal,
          professorId: professorId && professorId.trim() ? professorId : null,
        };
        
        // Log detalhado dos valores que serão inseridos
        console.log('[POST /api/agendamento] ============================================');
        console.log('[POST /api/agendamento] Valores que serão inseridos no banco:');
        console.log(JSON.stringify(valoresInsercao, null, 2));
        console.log('[POST /api/agendamento] ============================================');
        
        const result = await query(
          `INSERT INTO "Agendamento" (
            id, "competicaoId", "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
            "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
            status, observacoes, "recorrenciaId", "recorrenciaConfig", "ehAula", "professorId",
            "createdById", "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CONFIRMADO', $12, $13, $14, $15, $16, $17, NOW(), NOW()
          )
          RETURNING id`,
          [
            competicaoId || null,
            valoresInsercao.quadraId,
            valoresInsercao.usuarioIdFinal,
            valoresInsercao.atletaIdFinal,
            valoresInsercao.nomeAvulsoFinal,
            valoresInsercao.telefoneAvulsoFinal,
            valoresInsercao.dataHora,
            valoresInsercao.duracao,
            valoresInsercao.valorHora,
            valoresInsercao.valorCalculado,
            valoresInsercao.valorFinal,
            valoresInsercao.observacoes,
            valoresInsercao.recorrenciaId,
            valoresInsercao.recorrenciaConfig,
            valoresInsercao.ehAula,
            valoresInsercao.professorId,
            usuario.id, // createdById
          ]
        );
        return result.rows[0].id;
      } catch (error: any) {
        // Se os campos de recorrência, ehAula ou professorId não existem, tentar sem eles
        if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig') || 
            error.message?.includes('ehAula') || error.message?.includes('professorId')) {
          // Tentar com apenas campos básicos (sem recorrência, ehAula e professorId)
          try {
            const result = await query(
              `INSERT INTO "Agendamento" (
                id, "competicaoId", "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                status, observacoes, "createdById", "createdAt", "updatedAt"
              )
              VALUES (
                gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CONFIRMADO', $12, $13, NOW(), NOW()
              )
              RETURNING id`,
              [
                competicaoId || null,
                quadraId,
                usuarioIdFinal,
                atletaIdFinal || null,
                nomeAvulsoFinal || null,
                telefoneAvulsoFinal || null,
                dataHoraAgendamento.toISOString(), // Já está em UTC
                duracao,
                valorHora,
                valorCalculado,
                valorFinal,
                observacoes || null,
              ]
            );
            return result.rows[0].id;
          } catch (error2: any) {
            console.error('Erro ao inserir agendamento mesmo sem campos opcionais:', error2);
            throw error2;
          }
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
        atletaId: atletaIdFinal || null,
        nomeAvulso: nomeAvulsoFinal || null,
        telefoneAvulso: telefoneAvulsoFinal || null,
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
           AND "dataHora" < $3
           AND ("dataHora" + (duracao * INTERVAL '1 minute')) > $2`,
          [quadraId, dataAgendamento.toISOString(), dataFimAgendamento.toISOString()]
        );

        if (conflitos.rows.length > 0) {
          conflitosEncontrados.push(dataAgendamento.toISOString());
        }
      }

      if (conflitosEncontrados.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: `Existem conflitos em ${conflitosEncontrados.length} agendamento(s) da recorrência` },
          { status: 400 }
        );
        return withCors(errorResponse, request);
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
        const errorResponse = NextResponse.json(
          { mensagem: 'Não foi possível criar nenhum agendamento da recorrência' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }

      // Retornar o primeiro agendamento criado
      agendamentoId = idsCriados[0];
    } else {
      // Criar agendamento único (sem recorrência)
      const idCriado = await criarAgendamentoUnico(dataHoraUTC);
      if (!idCriado) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um agendamento confirmado neste horário' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      agendamentoId = idCriado;
    }

    // Buscar dados relacionados para retorno completo
    let agendamentoCompleto;
    try {
      // Tentar buscar com campos de recorrência, ehAula e professorId
      agendamentoCompleto = await query(
        `SELECT 
          a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
          a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
          a.status, a.observacoes, a."recorrenciaId", a."recorrenciaConfig", a."ehAula", a."professorId",
          a."createdAt", a."updatedAt",
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
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig') ||
          error.message?.includes('professorId') || error.message?.includes('ehAula')) {
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
      ehAula: row.ehAula ?? false,
      professorId: row.professorId || null,
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

    // Salvar atletas participantes se fornecido
    if (atletasParticipantesIds && atletasParticipantesIds.length > 0) {
      console.log(`[POST /api/agendamento] Salvando ${atletasParticipantesIds.length} participantes para agendamento ${agendamentoId}`);
      try {
        for (const atletaIdPart of atletasParticipantesIds) {
          const insertResult = await query(
            `INSERT INTO "AgendamentoAtleta" ("agendamentoId", "atletaId", "createdBy", "createdAt")
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT ("agendamentoId", "atletaId") DO NOTHING
             RETURNING id`,
            [agendamentoId, atletaIdPart, usuario.id]
          );
          if (insertResult.rows.length > 0) {
            console.log(`[POST /api/agendamento] Participante ${atletaIdPart} adicionado ao agendamento ${agendamentoId}`);
          } else {
            console.log(`[POST /api/agendamento] Participante ${atletaIdPart} já existe no agendamento ${agendamentoId} (conflito ignorado)`);
          }
        }

        // Buscar atletas participantes para retorno
        const participantesResult = await query(
          `SELECT 
            aa.id, aa."atletaId", aa."createdAt",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
            at."usuarioId" as "atleta_usuarioId", at."fotoUrl" as "atleta_fotoUrl",
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
            fotoUrl: rowPart.atleta_fotoUrl || null,
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

    // Enviar notificação Gzappy para o gestor (em background, não bloqueia a resposta)
    if (agendamento.quadra?.point?.id) {
      const clienteNome = agendamento.atleta?.nome || agendamento.nomeAvulso || agendamento.usuario?.name || 'Cliente';
      const clienteTelefone = agendamento.atleta?.fone || agendamento.telefoneAvulso || null;
      
      // Não aguardar a resposta do Gzappy para não bloquear a API
      import('@/lib/gzappyService').then(({ notificarNovoAgendamento }) => {
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
          console.error('Erro ao enviar notificação Gzappy (não crítico):', err);
        });
      }).catch((err) => {
        console.error('Erro ao importar serviço Gzappy (não crítico):', err);
      });
    }

    const response = NextResponse.json(agendamento, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar agendamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

