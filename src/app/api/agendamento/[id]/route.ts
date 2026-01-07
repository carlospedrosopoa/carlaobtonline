// app/api/agendamento/[id]/route.ts - Rotas de API para Agendamento individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { temRecorrencia, gerarAgendamentosRecorrentes } from '@/lib/recorrenciaService';
import type { RecorrenciaConfig } from '@/types/agendamento';

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

    let result;
    try {
      // Tentar buscar com campos ehAula e professorId
      result = await query(
        `SELECT 
          a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
          a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
          a.status, a.observacoes, a."ehAula", a."professorId", a."createdAt", a."updatedAt", a."createdById", a."updatedById",
          q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
          p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
          at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", at."usuarioId" as "atleta_usuarioId",
          pr.id as "professor_id", pr."userId" as "professor_userId", pr.especialidade as "professor_especialidade",
          pr.bio as "professor_bio", pr."valorHora" as "professor_valorHora", pr.ativo as "professor_ativo",
          up.id as "professor_usuario_id", up.name as "professor_usuario_name", up.email as "professor_usuario_email",
          uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
          uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
        FROM "Agendamento" a
        LEFT JOIN "Quadra" q ON a."quadraId" = q.id
        LEFT JOIN "Point" p ON q."pointId" = p.id
        LEFT JOIN "User" u ON a."usuarioId" = u.id
        LEFT JOIN "Atleta" at ON a."atletaId" = at.id
        LEFT JOIN "Professor" pr ON a."professorId" = pr.id
        LEFT JOIN "User" up ON pr."userId" = up.id
        LEFT JOIN "User" uc ON a."createdById" = uc.id
        LEFT JOIN "User" uu ON a."updatedById" = uu.id
        WHERE a.id = $1`,
        [id]
      );
    } catch (error: any) {
      // Se os campos ehAula ou professorId não existem, buscar sem eles
      if (error.message?.includes('ehAula') || error.message?.includes('professorId') || error.code === '42703') {
        result = await query(
          `SELECT 
            a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
            a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
            a.status, a.observacoes, a."createdAt", a."updatedAt",
            q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
            p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
            u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
            at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", at."usuarioId" as "atleta_usuarioId",
            NULL as "ehAula", NULL as "professorId", NULL as "professor_id", NULL as "professor_userId", 
            NULL as "professor_especialidade", NULL as "professor_bio", NULL as "professor_valorHora", 
            NULL as "professor_ativo", NULL as "professor_usuario_id", NULL as "professor_usuario_name", 
            NULL as "professor_usuario_email",
            uc.id as "createdBy_user_id", uc.name as "createdBy_user_name", uc.email as "createdBy_user_email",
            uu.id as "updatedBy_user_id", uu.name as "updatedBy_user_name", uu.email as "updatedBy_user_email"
          FROM "Agendamento" a
          LEFT JOIN "Quadra" q ON a."quadraId" = q.id
          LEFT JOIN "Point" p ON q."pointId" = p.id
          LEFT JOIN "User" u ON a."usuarioId" = u.id
          LEFT JOIN "Atleta" at ON a."atletaId" = at.id
          LEFT JOIN "User" uc ON a."createdById" = uc.id
          LEFT JOIN "User" uu ON a."updatedById" = uu.id
          WHERE a.id = $1`,
          [id]
        );
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const row = result.rows[0];

    // Verificar se ORGANIZER tem acesso a este agendamento (via quadra)
    if (usuario.role === 'ORGANIZER') {
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, row.quadraId);
      if (!temAcesso) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para visualizar este agendamento' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    } else if (usuario.role === 'USER') {
      // USER comum só pode ver seus próprios agendamentos (onde ele é o proprietário direto)
      if (row.usuarioId !== usuario.id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você não tem permissão para visualizar este agendamento' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    }
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
      ehAula: row.ehAula === true || row.ehAula === 'true' || row.ehAula === 1 || (row.ehAula !== null && row.ehAula !== undefined ? Boolean(row.ehAula) : false),
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdById: row.createdById || null,
      createdBy: row.createdBy_user_id ? {
        id: row.createdBy_user_id,
        name: row.createdBy_user_name,
        email: row.createdBy_user_email,
      } : null,
      updatedById: row.updatedById || null,
      updatedBy: row.updatedBy_user_id ? {
        id: row.updatedBy_user_id,
        name: row.updatedBy_user_name,
        email: row.updatedBy_user_email,
      } : null,
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
    };

    // Buscar atletas participantes (múltiplos)
    try {
      const participantesResult = await query(
        `SELECT 
          aa.id, aa."atletaId", aa."nomeAvulso", aa."telefoneAvulso", aa."createdAt",
          at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
          at."usuarioId" as "atleta_usuarioId", at."fotoUrl" as "atleta_fotoUrl",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
        FROM "AgendamentoAtleta" aa
        LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
        LEFT JOIN "User" u ON at."usuarioId" = u.id
        WHERE aa."agendamentoId" = $1
        ORDER BY aa."createdAt" ASC`,
        [id]
      );

      agendamento.atletasParticipantes = participantesResult.rows.map((rowPart: any) => {
        // Se for participante avulso (sem atletaId)
        if (!rowPart.atletaId && rowPart.nomeAvulso) {
          return {
            id: rowPart.id,
            atletaId: null,
            atleta: {
              id: null,
              nome: rowPart.nomeAvulso,
              fone: rowPart.telefoneAvulso || null,
              usuarioId: null,
              fotoUrl: null,
              usuario: null,
            },
            createdAt: rowPart.createdAt,
          };
        }
        // Se for atleta cadastrado
        return {
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
        };
      });
    } catch (error: any) {
      // Se a tabela AgendamentoAtleta não existir ainda, retornar array vazio
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn('Tabela AgendamentoAtleta não encontrada, retornando array vazio');
        agendamento.atletasParticipantes = [];
      } else {
        console.error('Erro ao buscar atletas participantes:', error);
        agendamento.atletasParticipantes = [];
      }
    }

    const response = NextResponse.json(agendamento);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter agendamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter agendamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/agendamento/[id] - Atualizar agendamento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[API PUT] ========== INÍCIO PUT /api/agendamento/[id] ==========');
  try {
    const { id } = await params;
    console.log('[API PUT] ID do agendamento:', id);
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
        'SELECT "usuarioId", "quadraId", "recorrenciaId", "recorrenciaConfig", "ehAula", "professorId" FROM "Agendamento" WHERE id = $1',
        [id]
      );
    } catch (error: any) {
      // Se os campos não existem, buscar sem eles
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig') || error.message?.includes('ehAula') || error.message?.includes('professorId')) {
        try {
          agendamentoCheck = await query(
            'SELECT "usuarioId", "quadraId", "ehAula", "professorId" FROM "Agendamento" WHERE id = $1',
            [id]
          );
        } catch (error2: any) {
          if (error2.message?.includes('ehAula') || error2.message?.includes('professorId')) {
            agendamentoCheck = await query(
              'SELECT "usuarioId", "quadraId" FROM "Agendamento" WHERE id = $1',
              [id]
            );
            // Adicionar valores padrão
            if (agendamentoCheck.rows.length > 0) {
              agendamentoCheck.rows[0].ehAula = false;
              agendamentoCheck.rows[0].professorId = null;
            }
          } else {
            throw error2;
          }
        }
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
      // USER comum pode editar apenas seus próprios agendamentos (onde ele é o proprietário direto)
      podeEditar = agendamentoAtual.usuarioId === usuario.id;
    }

    if (!podeEditar) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para editar este agendamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    console.log('[API PUT] Recebido payload:', JSON.stringify(body, null, 2));
    const {
      quadraId,
      dataHora,
      duracao,
      observacoes,
      atletaId,
      nomeAvulso,
      telefoneAvulso,
      valorNegociado,
      aplicarARecorrencia = false, // false = apenas este, true = este e todos futuros
      recorrencia, // Configuração de recorrência (opcional, para criar ou atualizar recorrência)
      atletasParticipantesIds, // IDs dos atletas participantes
      participantesAvulsos, // Participantes avulsos (não são atletas cadastrados)
      ehAula,
      professorId,
    } = body as {
      quadraId?: string;
      dataHora?: string;
      duracao?: number;
      observacoes?: string;
      atletaId?: string | null;
      nomeAvulso?: string | null;
      telefoneAvulso?: string | null;
      valorNegociado?: number | null;
      valorHora?: number | null;
      valorCalculado?: number | null;
      aplicarARecorrencia?: boolean;
      recorrencia?: RecorrenciaConfig;
      atletasParticipantesIds?: string[] | null;
      participantesAvulsos?: Array<{ nome: string }> | null;
      ehAula?: boolean;
      professorId?: string | null;
    };

    // Se quadraId foi alterado, verificar se o usuário tem acesso à nova quadra
    const quadraIdFinal = quadraId || agendamentoAtual.quadraId;
    if (quadraId && quadraId !== agendamentoAtual.quadraId) {
      // Verificar se a nova quadra existe
      const quadraCheck = await query('SELECT id, "pointId" FROM "Quadra" WHERE id = $1', [quadraId]);
      if (quadraCheck.rows.length === 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Quadra não encontrada' },
          { status: 404 }
        );
        return withCors(errorResponse, request);
      }

      // Verificar se ORGANIZER tem acesso à nova quadra
      if (usuario.role === 'ORGANIZER') {
        const temAcesso = await usuarioTemAcessoAQuadra(usuario, quadraId);
        if (!temAcesso) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Você não tem acesso a esta quadra' },
            { status: 403 }
          );
          return withCors(errorResponse, request);
        }
      }
    }

    // Validar regras de negócio para alteração
    // 1. Verificar se pode alterar data/hora/duração (precisa faltar 12 horas ou mais)
    const dataHoraAtual = new Date(agendamentoAtual.dataHora);
    const agora = new Date();
    const diferencaMs = dataHoraAtual.getTime() - agora.getTime();
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);
    const podeAlterarDataHora = diferencaHoras >= 12;
    
    // Normalizar dataHora para comparação (extrair apenas YYYY-MM-DDTHH:mm)
    const normalizarDataHoraParaComparacao = (dataHoraStr: string) => {
      if (!dataHoraStr) return null;
      // Extrair apenas data e hora (sem segundos/milissegundos/timezone)
      // Formato esperado: YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DDTHH:mm:ss.sssZ
      const match = dataHoraStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      return match ? match[1] : null;
    };
    
    // Verificar se está tentando alterar data/hora/duração
    // Só considerar como alteração se o campo foi enviado E o valor normalizado for diferente
    let tentandoAlterarDataHora = false;
    
    if (dataHora !== undefined) {
      const dataHoraNormalizada = normalizarDataHoraParaComparacao(dataHora);
      const dataHoraAtualNormalizada = normalizarDataHoraParaComparacao(agendamentoAtual.dataHora);
      
      // Só considerar alteração se ambos existirem E forem diferentes
      if (dataHoraNormalizada && dataHoraAtualNormalizada && dataHoraNormalizada !== dataHoraAtualNormalizada) {
        tentandoAlterarDataHora = true;
      }
    }
    
    // Verificar duração e quadraId
    if (duracao !== undefined && duracao !== agendamentoAtual.duracao) {
      tentandoAlterarDataHora = true;
    }
    
    if (quadraId !== undefined && quadraId !== agendamentoAtual.quadraId) {
      tentandoAlterarDataHora = true;
    }
    
    // ADMIN e ORGANIZER podem alterar mesmo com menos de 12 horas
    const podeBypass12Horas = usuario.role === 'ADMIN' || usuario.role === 'ORGANIZER';
    
    if (tentandoAlterarDataHora && !podeAlterarDataHora && !podeBypass12Horas) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível alterar data, hora ou duração. Faltam menos de 12 horas para o início do agendamento.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }
    
    // 2. Verificar se pode alterar observações e atletas (não pode se status for CONCLUIDO ou CANCELADO)
    const podeAlterarDetalhes = agendamentoAtual.status !== 'CONCLUIDO' && agendamentoAtual.status !== 'CANCELADO';
    const tentandoAlterarDetalhes = (observacoes !== undefined && observacoes !== (agendamentoAtual.observacoes || null)) ||
                                     (atletasParticipantesIds !== undefined);
    
    if (tentandoAlterarDetalhes && !podeAlterarDetalhes && usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: `Não é possível alterar observações ou participantes. O agendamento está ${agendamentoAtual.status === 'CONCLUIDO' ? 'concluído' : 'cancelado'}.` },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se dataHora ou quadraId foi alterado, verificar conflitos
    if (dataHora || (quadraId && quadraId !== agendamentoAtual.quadraId)) {
      // Tratar dataHora como horário local do usuário e converter para UTC
      // Se dataHora foi fornecida, usar ela; caso contrário, buscar do banco
      let dataHoraParaVerificar: string | undefined;
      
      if (dataHora) {
        dataHoraParaVerificar = dataHora;
      } else {
        // Buscar dataHora atual do banco se não foi fornecida
        const agendamentoDataCheck = await query(
          'SELECT "dataHora" FROM "Agendamento" WHERE id = $1',
          [id]
        );
        
        if (agendamentoDataCheck.rows.length === 0 || !agendamentoDataCheck.rows[0].dataHora) {
          const errorResponse = NextResponse.json(
            { mensagem: 'Data/hora do agendamento não encontrada' },
            { status: 400 }
          );
          return withCors(errorResponse, request);
        }
        
        // Normalizar dataHora do banco para string ISO
        dataHoraParaVerificar = normalizarDataHora(agendamentoDataCheck.rows[0].dataHora);
      }
      
      // Verificar se dataHoraParaVerificar existe e é válida
      if (!dataHoraParaVerificar) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Data/hora do agendamento não encontrada' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      
      const [dataPart, horaPart] = dataHoraParaVerificar.split('T');
      
      // Verificar se dataPart e horaPart foram extraídos corretamente
      if (!dataPart || !horaPart) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Formato de data/hora inválido' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
      
      const [ano, mes, dia] = dataPart.split('-').map(Number);
      const [hora, minuto] = horaPart.split(':').map(Number);
      
      // Criar data UTC diretamente (mesma lógica da criação)
      const dataHoraUTC = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
      const duracaoFinal = duracao || agendamentoAtual.duracao || 60;
      const dataHoraFim = new Date(dataHoraUTC.getTime() + duracaoFinal * 60000);

      const conflitos = await query(
        `SELECT id FROM "Agendamento"
         WHERE "quadraId" = $1
         AND id != $2
         AND status = 'CONFIRMADO'
         AND "dataHora" < $4
         AND ("dataHora" + ($5 * INTERVAL '1 minute')) > $3`,
        [quadraIdFinal, id, dataHoraUTC.toISOString(), dataHoraFim.toISOString(), duracaoFinal]
      );

      if (conflitos.rows.length > 0) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Já existe um agendamento confirmado neste horário para esta quadra' },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Validar se ehAula requer professorId
    if (ehAula !== undefined && ehAula && !professorId) {
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

    // Determinar se é aula: usar valor informado ou buscar do banco
    const ehAulaFinal = ehAula !== undefined ? ehAula : (agendamentoAtual.ehAula || false);
    const professorIdFinal = professorId !== undefined ? professorId : (agendamentoAtual.professorId || null);

    // Recalcular valores sempre que houver qualquer alteração (para permitir atualizar valores quando tabela de preços foi criada)
    let valorHora: number | null = null;
    let valorCalculado: number | null = null;

    // Se valores foram enviados no payload, usar esses valores (já calculados no frontend)
    if (body.valorHora !== undefined) {
      valorHora = body.valorHora;
    }
    if (body.valorCalculado !== undefined) {
      valorCalculado = body.valorCalculado;
    }

    // Recalcular se não foram enviados ou se mudou quadra, data/hora ou duração
    if (!body.valorHora && (quadraId || dataHora || duracao)) {
      let horaAgendamento: number | null = null;
      const duracaoFinal = duracao || agendamentoAtual.duracao || 60;

      if (dataHora) {
        // Parsear manualmente para obter hora local
        const [dataPart, horaPart] = dataHora.split('T');
        const [, , , hora, minuto] = [...dataPart.split('-').map(Number), ...horaPart.split(':').map(Number)];
        horaAgendamento = hora * 60 + minuto;
      } else if (agendamentoAtual.dataHora) {
        // Se não mudou dataHora, usar a atual para calcular valores
        const dataHoraAtualValores = new Date(agendamentoAtual.dataHora);
        horaAgendamento = dataHoraAtualValores.getUTCHours() * 60 + dataHoraAtualValores.getUTCMinutes();
      }

      const tabelaPrecoResult = await query(
        `SELECT "valorHora", "valorHoraAula", "inicioMinutoDia", "fimMinutoDia"
         FROM "TabelaPreco"
         WHERE "quadraId" = $1 AND ativo = true
         ORDER BY "inicioMinutoDia" ASC`,
        [quadraIdFinal]
      );

      if (tabelaPrecoResult.rows.length > 0 && horaAgendamento !== null) {
        const precoAplicavel = tabelaPrecoResult.rows.find((tp: any) => {
          return horaAgendamento! >= tp.inicioMinutoDia && horaAgendamento! < tp.fimMinutoDia;
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
          valorCalculado = (valorHora * duracaoFinal) / 60;
        }
      }
    }

    // Montar campos de atualização
    const updates: string[] = [];
    const paramsUpdate: any[] = [];
    let paramCount = 1;

    if (quadraId && quadraId !== agendamentoAtual.quadraId) {
      updates.push(`"quadraId" = $${paramCount}`);
      paramsUpdate.push(quadraId);
      paramCount++;
    }

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
      // Permitir que 0 seja salvo corretamente (não usar || null que converte 0 em null)
      paramsUpdate.push(valorNegociado !== null && valorNegociado !== undefined ? valorNegociado : null);
      paramCount++;
    }

    if (ehAula !== undefined) {
      updates.push(`"ehAula" = $${paramCount}`);
      paramsUpdate.push(ehAula);
      paramCount++;
    }

    if (professorId !== undefined) {
      updates.push(`"professorId" = $${paramCount}`);
      paramsUpdate.push(professorId || null);
      paramCount++;
    }

    // Adicionar configuração de recorrência aos updates se fornecida
    // IMPORTANTE: Só atualizar se recorrencia for um objeto válido (não null, não undefined)
    // Se for null ou undefined, manter o valor atual (não remover a recorrência existente)
    if (recorrencia !== undefined && recorrencia !== null) {
      try {
        updates.push(`"recorrenciaConfig" = $${paramCount}`);
        paramsUpdate.push(JSON.stringify(recorrencia));
        paramCount++;
      } catch (error: any) {
        // Se o campo não existe, tentar sem ele
        if (!error.message?.includes('recorrenciaConfig')) {
          throw error;
        }
      }
    }

    if (updates.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    updates.push(`"updatedAt" = NOW()`);
    updates.push(`"updatedById" = $${paramCount}`);
    paramsUpdate.push(usuario.id);
    paramCount++;
    
    // Buscar dados atuais do agendamento antes de atualizar
    let agendamentoDataAtual;
    try {
      agendamentoDataAtual = await query(
        'SELECT "dataHora", "recorrenciaId", "recorrenciaConfig", "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso", duracao, "valorHora", "valorCalculado", "valorNegociado", observacoes FROM "Agendamento" WHERE id = $1',
        [id]
      );
    } catch (error: any) {
      if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
        try {
          agendamentoDataAtual = await query(
            'SELECT "dataHora", "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso", duracao, "valorHora", "valorCalculado", "valorNegociado", observacoes, "ehAula", "professorId" FROM "Agendamento" WHERE id = $1',
            [id]
          );
        } catch (error2: any) {
          if (error2.message?.includes('ehAula') || error2.message?.includes('professorId')) {
            agendamentoDataAtual = await query(
              'SELECT "dataHora", "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso", duracao, "valorHora", "valorCalculado", "valorNegociado", observacoes FROM "Agendamento" WHERE id = $1',
              [id]
            );
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }
    
    if (!agendamentoDataAtual || agendamentoDataAtual.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }
    
    const dadosAtuais = agendamentoDataAtual.rows[0];
    // Normalizar dataHora para garantir que seja tratada como UTC
    // normalizarDataHora retorna string ISO, então converter para Date
    const dataHoraAtualRecorrenciaStr = normalizarDataHora(dadosAtuais.dataHora);
    const dataHoraAtualRecorrencia = new Date(dataHoraAtualRecorrenciaStr);
    const recorrenciaIdAtual = dadosAtuais.recorrenciaId || null;
    
    console.log('[API] dataHoraAtualRecorrencia (após normalizarDataHora):', dataHoraAtualRecorrencia.toISOString(), 'timestamp:', dataHoraAtualRecorrencia.getTime());
    
    // Se há recorrência e o usuário quer aplicar a todos os futuros E há nova configuração de recorrência
    console.log('[API] Verificando condições:', {
      temRecorrenciaAtual,
      aplicarARecorrencia,
      temRecorrencia: !!recorrencia,
      temTipo: recorrencia?.tipo,
      recorrenciaIdAtual,
    });
    
    if (temRecorrenciaAtual && aplicarARecorrencia && recorrencia && recorrencia.tipo) {
      console.log('[API] Entrando no bloco: Recriar recorrência');
      // 1. Deletar todos os agendamentos futuros da recorrência atual (exceto o atual)
      if (recorrenciaIdAtual) {
        await query(
          `DELETE FROM "Agendamento"
           WHERE "recorrenciaId" = $1
           AND "dataHora" > $2
           AND id != $3`,
          [recorrenciaIdAtual, dataHoraAtualRecorrencia.toISOString(), id]
        );
      }
      
      // 2. Preparar dados atualizados para gerar novas recorrências
      const dataHoraFinal = dataHora ? (() => {
        const [dataPart, horaPart] = dataHora.split('T');
        const [ano, mes, dia] = dataPart.split('-').map(Number);
        const [hora, minuto] = horaPart.split(':').map(Number);
        return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
      })() : dataHoraAtualRecorrencia;
      
      const duracaoFinal = duracao !== undefined ? duracao : dadosAtuais.duracao;
      const valorHoraFinal = valorHora !== null ? valorHora : dadosAtuais.valorHora;
      const valorCalculadoFinal = valorCalculado !== null ? valorCalculado : dadosAtuais.valorCalculado;
      const valorNegociadoFinal = valorNegociado !== null ? valorNegociado : dadosAtuais.valorNegociado;
      
      // 3. Atualizar o agendamento atual primeiro
      paramsUpdate.push(id);
      
      // Construir RETURNING de forma segura (sem campos que podem não existir)
      let sqlAtualizar;
      try {
        sqlAtualizar = `UPDATE "Agendamento"
                 SET ${updates.join(', ')}
                 WHERE id = $${paramCount}
                 RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                   "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                   status, observacoes, "recorrenciaId", "recorrenciaConfig", "createdAt", "updatedAt"`;
      } catch (error: any) {
        // Se houver erro ao construir SQL, tentar sem campos opcionais
        sqlAtualizar = `UPDATE "Agendamento"
                 SET ${updates.join(', ')}
                 WHERE id = $${paramCount}
                 RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                   "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                   status, observacoes, "createdAt", "updatedAt"`;
      }

      console.log('[API PUT] Executando UPDATE com SQL:', sqlAtualizar);
      console.log('[API PUT] Parâmetros:', paramsUpdate);
      
      let result;
      try {
        result = await query(sqlAtualizar, paramsUpdate);
      } catch (error: any) {
        // Se falhar por causa de campos no RETURNING, tentar sem eles
        if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
          console.warn('[API PUT] Campos de recorrência não encontrados, tentando sem eles');
          sqlAtualizar = `UPDATE "Agendamento"
                   SET ${updates.join(', ')}
                   WHERE id = $${paramCount}
                   RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                     "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                     status, observacoes, "createdAt", "updatedAt"`;
          result = await query(sqlAtualizar, paramsUpdate);
        } else {
          console.error('[API PUT] Erro na query UPDATE:', error);
          console.error('[API PUT] SQL:', sqlAtualizar);
          console.error('[API PUT] Parâmetros:', paramsUpdate);
          throw error;
        }
      }
      
      // 4. Gerar novos agendamentos recorrentes baseados nos dados atualizados
      const dadosBase = {
        quadraId: quadraIdFinal,
        usuarioId: dadosAtuais.usuarioId,
        atletaId: atletaId !== undefined ? atletaId : dadosAtuais.atletaId,
        nomeAvulso: nomeAvulso !== undefined ? nomeAvulso : dadosAtuais.nomeAvulso,
        telefoneAvulso: telefoneAvulso !== undefined ? telefoneAvulso : dadosAtuais.telefoneAvulso,
        duracao: duracaoFinal,
        valorHora: valorHoraFinal,
        valorCalculado: valorCalculadoFinal,
        valorNegociado: valorNegociadoFinal,
        observacoes: observacoes !== undefined ? observacoes : dadosAtuais.observacoes,
      };
      
      // Buscar o novo recorrenciaId do agendamento atualizado
      const agendamentoAtualizado = result.rows[0];
      const novoRecorrenciaId = agendamentoAtualizado.recorrenciaId || recorrenciaIdAtual;
      
      // Gerar agendamentos recorrentes (a partir do próximo, já que o atual já existe)
      const agendamentosRecorrentes = gerarAgendamentosRecorrentes(dataHoraFinal, recorrencia, dadosBase);
      
      // Filtrar apenas os futuros (excluir o atual)
      // Comparar timestamps para garantir que são realmente futuros
      const timestampAtual = dataHoraFinal.getTime();
      const agendamentosFuturos = agendamentosRecorrentes.filter(ag => {
        const dataAg = new Date(ag.dataHora);
        return dataAg.getTime() > timestampAtual;
      });
      
      // Verificar conflitos antes de criar
      const conflitosEncontrados: string[] = [];
      for (const agendamentoRec of agendamentosFuturos) {
        const dataAgendamento = new Date(agendamentoRec.dataHora);
        const dataFimAgendamento = new Date(dataAgendamento.getTime() + duracaoFinal * 60000);
        const conflitos = await query(
          `SELECT id FROM "Agendamento"
           WHERE "quadraId" = $1
           AND status = 'CONFIRMADO'
           AND id != $2
           AND "dataHora" < $4
           AND ("dataHora" + ($5 * INTERVAL '1 minute')) > $3`,
          [quadraIdFinal, id, dataAgendamento.toISOString(), dataFimAgendamento.toISOString(), duracaoFinal]
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
      
      // Criar novos agendamentos recorrentes
      const criarAgendamentoUnico = async (dataHoraAgendamento: Date, recorrenciaId: string, recorrenciaConfig: RecorrenciaConfig) => {
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
              dadosBase.quadraId,
              dadosBase.usuarioId,
              dadosBase.atletaId,
              dadosBase.nomeAvulso,
              dadosBase.telefoneAvulso,
              dataHoraAgendamento.toISOString(),
              dadosBase.duracao,
              dadosBase.valorHora,
              dadosBase.valorCalculado,
              dadosBase.valorNegociado,
              dadosBase.observacoes,
              recorrenciaId,
              JSON.stringify(recorrenciaConfig),
            ]
          );
          return result.rows[0].id;
        } catch (error: any) {
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
                dadosBase.quadraId,
                dadosBase.usuarioId,
                dadosBase.atletaId,
                dadosBase.nomeAvulso,
                dadosBase.telefoneAvulso,
                dataHoraAgendamento.toISOString(),
                dadosBase.duracao,
                dadosBase.valorHora,
                dadosBase.valorCalculado,
                dadosBase.valorNegociado,
                dadosBase.observacoes,
              ]
            );
            return result.rows[0].id;
          }
          throw error;
        }
      };
      
      // Criar todos os agendamentos futuros
      for (const agendamentoRec of agendamentosFuturos) {
        await criarAgendamentoUnico(
          new Date(agendamentoRec.dataHora),
          novoRecorrenciaId,
          recorrencia
        );
      }
      
      // Buscar o agendamento atualizado para retornar
      const agendamentoCompleto = await query(
        `SELECT 
          a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
          a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
          a.status, a.observacoes, a."recorrenciaId", a."recorrenciaConfig", a."createdAt", a."updatedAt",
          q.id as "quadra_id", q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
          p.id as "point_id", p.nome as "point_nome", p."logoUrl" as "point_logoUrl",
          u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email",
          at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", at."usuarioId" as "atleta_usuarioId"
        FROM "Agendamento" a
        LEFT JOIN "Quadra" q ON a."quadraId" = q.id
        LEFT JOIN "Point" p ON q."pointId" = p.id
        LEFT JOIN "User" u ON a."usuarioId" = u.id
        LEFT JOIN "Atleta" at ON a."atletaId" = at.id
        WHERE a.id = $1`,
        [id]
      );
      
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
      
      const response = NextResponse.json(agendamento);
      return withCors(response, request);
    } else {
      // Apenas atualizar o agendamento atual (sem recriar recorrências)
      paramsUpdate.push(id);
      const sql = `UPDATE "Agendamento"
                   SET ${updates.join(', ')}
                   WHERE id = $${paramCount}
                   RETURNING id, "quadraId", "usuarioId", "atletaId", "nomeAvulso", "telefoneAvulso",
                     "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado",
                     status, observacoes, "createdAt", "updatedAt"`;

      console.log('[API PUT] Executando UPDATE simples com SQL:', sql);
      console.log('[API PUT] Parâmetros:', paramsUpdate);
      
      let result;
      try {
        result = await query(sql, paramsUpdate);
      } catch (error: any) {
        console.error('[API PUT] Erro na query UPDATE simples:', error);
        console.error('[API PUT] SQL:', sql);
        console.error('[API PUT] Parâmetros:', paramsUpdate);
        throw error;
      }

      // Buscar dados relacionados para retorno completo
      let agendamentoCompleto;
      try {
        agendamentoCompleto = await query(
          `SELECT 
            a.id, a."quadraId", a."usuarioId", a."atletaId", a."nomeAvulso", a."telefoneAvulso",
            a."dataHora", a.duracao, a."valorHora", a."valorCalculado", a."valorNegociado",
            a.status, a.observacoes, a."recorrenciaId", a."recorrenciaConfig", a."createdAt", a."updatedAt",
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
      } catch (error: any) {
        if (error.message?.includes('recorrenciaId') || error.message?.includes('recorrenciaConfig')) {
          agendamentoCompleto = await query(
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

      // Atualizar atletas participantes e participantes avulsos se fornecido
      if (atletasParticipantesIds !== undefined || participantesAvulsos !== undefined) {
        try {
          console.log(`[PUT /api/agendamento/${id}] Atualizando participantes:`, {
            atletasParticipantesIds,
            participantesAvulsos,
          });

          // Remover todos os participantes existentes
          await query(
            'DELETE FROM "AgendamentoAtleta" WHERE "agendamentoId" = $1',
            [id]
          );
          console.log(`[PUT /api/agendamento/${id}] Participantes existentes removidos`);

          // Adicionar novos participantes (atletas)
          if (atletasParticipantesIds && atletasParticipantesIds.length > 0) {
            console.log(`[PUT /api/agendamento/${id}] Adicionando ${atletasParticipantesIds.length} atletas participantes`);
            for (const atletaIdPart of atletasParticipantesIds) {
              const result = await query(
                `INSERT INTO "AgendamentoAtleta" ("agendamentoId", "atletaId", "nomeAvulso", "telefoneAvulso", "createdById", "createdAt")
                 VALUES ($1, $2, NULL, NULL, $3, NOW())
                 ON CONFLICT ("agendamentoId", "atletaId") DO NOTHING
                 RETURNING id`,
                [id, atletaIdPart, usuario.id]
              );
              if (result.rows.length > 0) {
                console.log(`[PUT /api/agendamento/${id}] Atleta ${atletaIdPart} adicionado com sucesso`);
              } else {
                console.log(`[PUT /api/agendamento/${id}] Atleta ${atletaIdPart} já existia (conflito ignorado)`);
              }
            }
          }

          // Adicionar participantes avulsos
          if (participantesAvulsos && participantesAvulsos.length > 0) {
            console.log(`[PUT /api/agendamento/${id}] Adicionando ${participantesAvulsos.length} participantes avulsos`);
            for (const avulso of participantesAvulsos) {
              if (avulso.nome && avulso.nome.trim()) {
                try {
                  const result = await query(
                    `INSERT INTO "AgendamentoAtleta" ("agendamentoId", "atletaId", "nomeAvulso", "telefoneAvulso", "createdById", "createdAt")
                     VALUES ($1, NULL, $2, NULL, $3, NOW())
                     RETURNING id`,
                    [id, avulso.nome.trim(), usuario.id]
                  );
                  console.log(`[PUT /api/agendamento/${id}] ✅ Participante avulso "${avulso.nome}" adicionado com sucesso. ID: ${result.rows[0]?.id}`);
                } catch (error: any) {
                  console.error(`[PUT /api/agendamento/${id}] ❌ Erro ao adicionar participante avulso "${avulso.nome}":`, error);
                  console.error(`[PUT /api/agendamento/${id}] Detalhes do erro:`, {
                    message: error.message,
                    code: error.code,
                    detail: error.detail,
                    constraint: error.constraint,
                  });
                  throw error;
                }
              } else {
                console.warn(`[PUT /api/agendamento/${id}] Participante avulso com nome vazio ignorado:`, avulso);
              }
            }
          } else {
            console.log(`[PUT /api/agendamento/${id}] Nenhum participante avulso para adicionar`);
          }

          // Buscar participantes atualizados para retorno (incluindo avulsos)
          const participantesResult = await query(
            `SELECT 
              aa.id, aa."atletaId", aa."nomeAvulso", aa."telefoneAvulso", aa."createdAt",
              at.id as "atleta_id", at.nome as "atleta_nome", at.fone as "atleta_fone", 
              at."usuarioId" as "atleta_usuarioId", at."fotoUrl" as "atleta_fotoUrl",
              u.id as "usuario_id", u.name as "usuario_name", u.email as "usuario_email"
            FROM "AgendamentoAtleta" aa
            LEFT JOIN "Atleta" at ON aa."atletaId" = at.id
            LEFT JOIN "User" u ON at."usuarioId" = u.id
            WHERE aa."agendamentoId" = $1
            ORDER BY aa."createdAt" ASC`,
            [id]
          );

          agendamento.atletasParticipantes = participantesResult.rows.map((rowPart: any) => {
            // Se for participante avulso (sem atletaId)
            if (!rowPart.atletaId && rowPart.nomeAvulso) {
              return {
                id: rowPart.id,
                atletaId: null,
                atleta: {
                  id: null,
                  nome: rowPart.nomeAvulso,
                  fone: rowPart.telefoneAvulso || null,
                  usuarioId: null,
                  fotoUrl: null,
                  usuario: null,
                },
                createdAt: rowPart.createdAt,
              };
            }
            // Se for atleta cadastrado
            return {
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
            };
          });
        } catch (error: any) {
          // Se a tabela AgendamentoAtleta não existir ainda, apenas logar o erro
          if (error.message?.includes('does not exist') || error.code === '42P01') {
            console.warn('Tabela AgendamentoAtleta não encontrada, ignorando atualização de participantes');
            agendamento.atletasParticipantes = [];
          } else {
            console.error('Erro ao atualizar atletas participantes:', error);
            // Não falhar a requisição, apenas logar o erro
            agendamento.atletasParticipantes = [];
          }
        }
      } else {
        // Se não foi fornecido, buscar os existentes
        try {
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
            [id]
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
          if (error.message?.includes('does not exist') || error.code === '42P01') {
            agendamento.atletasParticipantes = [];
          } else {
            console.error('Erro ao buscar atletas participantes:', error);
            agendamento.atletasParticipantes = [];
          }
        }
      }

      const response = NextResponse.json(agendamento);
      return withCors(response, request);
    }
  } catch (error: any) {
    console.error('[API PUT] Erro ao atualizar agendamento:', error);
    console.error('[API PUT] Stack trace:', error.stack);
    console.error('[API PUT] Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      hint: error.hint,
    });
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao atualizar agendamento', 
        error: error.message,
        detail: error.detail || error.message,
        constraint: error.constraint,
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
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
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const agendamento = agendamentoCheck.rows[0];
    
    // Verificar permissões - apenas ADMIN e ORGANIZER podem deletar
    let podeDeletar = false;
    if (usuario.role === 'ADMIN') {
      podeDeletar = true; // ADMIN pode deletar tudo
    } else if (usuario.role === 'ORGANIZER') {
      // ORGANIZER pode deletar agendamentos das quadras da sua arena
      const temAcesso = await usuarioTemAcessoAQuadra(usuario, agendamento.quadraId);
      podeDeletar = temAcesso;
    }
    // USER comum não pode deletar, apenas cancelar

    if (!podeDeletar) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e organizadores podem excluir agendamentos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json().catch(() => ({}));
    const aplicarARecorrencia = body.aplicarARecorrencia || false;
    const temRecorrenciaAtual = !!agendamento.recorrenciaId;

    // Se há recorrência e o usuário quer deletar todos os futuros
    if (temRecorrenciaAtual && aplicarARecorrencia) {
      const dataHoraAtual = new Date(agendamento.dataHora);
      const recorrenciaId = agendamento.recorrenciaId;
      
      // Deletar este agendamento e todos os futuros da mesma recorrência
      // IMPORTANTE: Incluir o agendamento atual explicitamente usando OR id = $3
      // para garantir que ele seja sempre deletado, mesmo que haja problemas de timezone
      try {
        const result = await query(
          `DELETE FROM "Agendamento"
           WHERE "recorrenciaId" = $1
           AND ("dataHora" >= $2 OR id = $3)`,
          [recorrenciaId, dataHoraAtual.toISOString(), id]
        );
        const response = NextResponse.json({ 
          mensagem: 'Agendamento(s) deletado(s) com sucesso',
          deletados: result.rowCount 
        });
        return withCors(response, request);
      } catch (error: any) {
        // Se o campo não existe, apenas deletar este
        if (!error.message?.includes('recorrenciaId')) {
          throw error;
        }
      }
    }

    // Deletar apenas o agendamento atual (quando não é para deletar todos os futuros)
    const result = await query(
      `DELETE FROM "Agendamento" WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado ou já foi deletado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ mensagem: 'Agendamento deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar agendamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar agendamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

