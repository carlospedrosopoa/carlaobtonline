// app/api/public/agendamento/criar/route.ts
// API pública para criar agendamento com atleta temporário
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { v4 as uuidv4 } from 'uuid';
import { carregarHorariosAtendimentoPoint, diaSemanaFromYYYYMMDD, inicioDentroDoHorario } from '@/lib/horarioAtendimento';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/public/agendamento/criar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quadraId, dataHora, duracao, atletaId, usuarioId, observacoes } = body;

    if (!quadraId) {
      return withCors(
        NextResponse.json({ mensagem: 'quadraId é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!dataHora) {
      return withCors(
        NextResponse.json({ mensagem: 'dataHora é obrigatória' }, { status: 400 }),
        request
      );
    }

    if (!atletaId) {
      return withCors(
        NextResponse.json({ mensagem: 'atletaId é obrigatório' }, { status: 400 }),
        request
      );
    }

    // Verificar se a quadra existe e está ativa
    const quadraResult = await query(
      'SELECT id, nome, "pointId", ativo FROM "Quadra" WHERE id = $1',
      [quadraId]
    );

    if (quadraResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Quadra não encontrada' }, { status: 404 }),
        request
      );
    }

    const quadra = quadraResult.rows[0];
    if (!quadra.ativo) {
      return withCors(
        NextResponse.json({ mensagem: 'Quadra não está ativa' }, { status: 400 }),
        request
      );
    }

    // Verificar se o atleta existe e se tem usuarioId (atleta cadastrado)
    const atletaResult = await query('SELECT id, nome, fone, "usuarioId" FROM "Atleta" WHERE id = $1', [atletaId]);
    if (atletaResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }),
        request
      );
    }

    const atleta = atletaResult.rows[0];
    
    // Prioridade para usuarioId (comportamento appatleta):
    // 1. PRINCIPAL: Se o atleta tem usuarioId (atleta cadastrado), usar o do atleta
    // 2. FALLBACK: Se o atleta NÃO tem usuarioId (telefone novo/temporário), usar o do parâmetro
    // 3. Se nenhum dos dois, deixar null (agendamento público/temporário)
    let usuarioIdFinal: string | null = null;
    
    // PRINCIPAL: Verificar se o atleta tem usuarioId (comportamento appatleta)
    if (atleta.usuarioId) {
      usuarioIdFinal = atleta.usuarioId;
    } else if (usuarioId) {
      // FALLBACK: Se atleta não tem usuarioId, usar o do parâmetro (se informado)
      // Validar se o usuarioId existe no banco
      const userCheck = await query('SELECT id FROM "User" WHERE id = $1', [usuarioId]);
      if (userCheck.rows.length > 0) {
        usuarioIdFinal = usuarioId;
      } else {
        // Se usuarioId não existe, logar aviso mas continuar sem ele
        console.warn(`usuarioId ${usuarioId} informado não existe no banco, ignorando`);
      }
    }

    // Verificar conflitos de horário
    const dataHoraNormalizada = normalizarDataHora(dataHora);
    const duracaoMinutos = duracao || 60;
    const dataHoraFim = new Date(dataHoraNormalizada);
    dataHoraFim.setUTCMinutes(dataHoraFim.getUTCMinutes() + duracaoMinutos);

    const dataInicio = new Date(dataHoraNormalizada);
    const inicioMin = dataInicio.getUTCHours() * 60 + dataInicio.getUTCMinutes();
    const dataStr = dataHoraNormalizada.slice(0, 10);
    const horariosAtendimento = await carregarHorariosAtendimentoPoint(quadra.pointId);
    const diaSemana = diaSemanaFromYYYYMMDD(dataStr);
    if (!inicioDentroDoHorario(horariosAtendimento, diaSemana, inicioMin)) {
      return withCors(
        NextResponse.json({ mensagem: 'Fora do horário de atendimento' }, { status: 400 }),
        request
      );
    }

    // Verificar conflitos com agendamentos confirmados
    const conflitosResult = await query(
      `SELECT id FROM "Agendamento"
       WHERE "quadraId" = $1
         AND status = 'CONFIRMADO'
         AND (
           ("dataHora" >= $2 AND "dataHora" < $3)
           OR ("dataHora" + (COALESCE(duracao, 60)) * INTERVAL '1 minute' > $2 AND "dataHora" < $3)
         )`,
      [quadraId, dataHoraNormalizada, dataHoraFim.toISOString()]
    );

    if (conflitosResult.rows.length > 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Horário já está ocupado' }, { status: 400 }),
        request
      );
    }
    
    // Função auxiliar para verificar conflito de horário
    function verificarConflitoHorario(bloq: any, inicio: Date, fim: Date): boolean {
      const bloqDataInicio = new Date(bloq.dataInicio);
      const bloqDataFim = new Date(bloq.dataFim);
      
      // Verificar se há sobreposição de datas
      if (fim <= bloqDataInicio || inicio >= bloqDataFim) {
        return false;
      }
      
      // Se o bloqueio tem horaInicio/horaFim, verificar horário específico
      if (bloq.horaInicio !== null && bloq.horaInicio !== undefined &&
          bloq.horaFim !== null && bloq.horaFim !== undefined) {
        const inicioMin = inicio.getUTCHours() * 60 + inicio.getUTCMinutes();
        const fimMin = fim.getUTCHours() * 60 + fim.getUTCMinutes();
        
        return !(fimMin <= bloq.horaInicio || inicioMin >= bloq.horaFim);
      }
      
      // Se não tem hora específica, bloqueia o dia inteiro
      return true;
    }

    // Verificar conflitos com bloqueios
    // BloqueioAgenda usa pointId e quadraIds (JSONB array), não quadraId
    const bloqueiosResult = await query(
      `SELECT id, "quadraIds", "dataInicio", "dataFim", "horaInicio", "horaFim"
       FROM "BloqueioAgenda"
       WHERE "pointId" = $1
         AND ativo = true
         AND "dataInicio" <= $3
         AND "dataFim" >= $2`,
      [quadra.pointId, dataHoraNormalizada, dataHoraFim.toISOString()]
    );

    // Verificar se algum bloqueio afeta esta quadra
    const temBloqueio = bloqueiosResult.rows.some((bloq: any) => {
      // Se quadraIds for null ou vazio, bloqueia todas as quadras
      if (!bloq.quadraIds || (Array.isArray(bloq.quadraIds) && bloq.quadraIds.length === 0)) {
        // Bloqueia todas as quadras - verificar horário
        // normalizarDataHora retorna string, precisamos passar Date
        return verificarConflitoHorario(bloq, new Date(dataHoraNormalizada), dataHoraFim);
      }
      
      // Se tiver quadraIds, verificar se esta quadra está na lista
      if (Array.isArray(bloq.quadraIds) && bloq.quadraIds.includes(quadraId)) {
        // normalizarDataHora retorna string, precisamos passar Date
        return verificarConflitoHorario(bloq, new Date(dataHoraNormalizada), dataHoraFim);
      }
      
      return false;
    });

    if (temBloqueio) {
      return withCors(
        NextResponse.json({ mensagem: 'Horário está bloqueado' }, { status: 400 }),
        request
      );
    }

    // Buscar valor da quadra (se houver tabela de preços)
    let valorHora = null;
    try {
      const precoResult = await query(
        `SELECT "valorHora" FROM "TabelaPreco"
         WHERE "pointId" = $1
           AND "quadraId" = $2
           AND ativo = true
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [quadra.pointId, quadraId]
      );

      if (precoResult.rows.length > 0) {
        valorHora = parseFloat(precoResult.rows[0].valorHora) || null;
      }
    } catch (error) {
      // Se não houver tabela de preços, continua sem valor
      console.warn('Erro ao buscar preço:', error);
    }

    const valorCalculado = valorHora ? (valorHora * duracaoMinutos) / 60 : null;

    // Criar agendamento
    // Se o atleta tem usuarioId, vincular ao usuário (como se fosse feito pelo app do atleta)
    // Se não tem usuarioId, é agendamento público/temporário
    const agendamentoId = uuidv4();
    await query(
      `INSERT INTO "Agendamento" (
        id, "quadraId", "usuarioId", "atletaId", "dataHora", duracao,
        "valorHora", "valorCalculado", status, observacoes,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMADO', $9, NOW(), NOW())`,
      [
        agendamentoId,
        quadraId,
        usuarioIdFinal, // Vincular ao usuário se o atleta for cadastrado
        atletaId,
        dataHoraNormalizada, // Já é uma string ISO retornada por normalizarDataHora
        duracaoMinutos,
        valorHora,
        valorCalculado,
        observacoes || null,
      ]
    );

    // Buscar agendamento criado para retorno
    const agendamentoResult = await query(
      `SELECT 
        a.id, a."quadraId", a."atletaId", a."dataHora", a.duracao,
        a."valorHora", a."valorCalculado", a.status, a.observacoes,
        q.nome as "quadra_nome",
        at.nome as "atleta_nome"
       FROM "Agendamento" a
       LEFT JOIN "Quadra" q ON a."quadraId" = q.id
       LEFT JOIN "Atleta" at ON a."atletaId" = at.id
       WHERE a.id = $1`,
      [agendamentoId]
    );

    const agendamento = agendamentoResult.rows[0];

    if (atleta?.fone) {
      try {
        const pointResult = await query('SELECT nome FROM "Point" WHERE id = $1', [quadra.pointId]);
        const arenaNome = pointResult.rows[0]?.nome || 'Arena';

        import('@/lib/gzappyService')
          .then(({ notificarAtletaNovoAgendamento }) => {
            notificarAtletaNovoAgendamento(atleta.fone, quadra.pointId, {
              quadra: agendamento.quadra_nome || quadra.nome,
              arena: arenaNome,
              dataHora: agendamento.dataHora,
              duracao: duracaoMinutos,
              valor: valorCalculado,
              nomeAtleta: atleta.nome,
            }).catch((err) => {
              console.error('Erro ao enviar notificação Gzappy para atleta (não crítico):', err);
            });
          })
          .catch((err) => {
            console.error('Erro ao importar serviço Gzappy (não crítico):', err);
          });
      } catch (err) {
        console.error('Erro ao buscar arena para notificação (não crítico):', err);
      }
    }

    return withCors(
      NextResponse.json({
        id: agendamento.id,
        quadraId: agendamento.quadraId,
        quadraNome: agendamento.quadra_nome,
        atletaId: agendamento.atletaId,
        atletaNome: agendamento.atleta_nome,
        dataHora: agendamento.dataHora,
        duracao: agendamento.duracao,
        valorCalculado: agendamento.valorCalculado,
        status: agendamento.status,
        mensagem: 'Agendamento criado com sucesso',
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao criar agendamento público:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao criar agendamento', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}
