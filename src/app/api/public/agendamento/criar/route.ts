// app/api/public/agendamento/criar/route.ts
// API pública para criar agendamento com atleta temporário
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { v4 as uuidv4 } from 'uuid';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/public/agendamento/criar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quadraId, dataHora, duracao, atletaId, observacoes } = body;

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

    // Verificar se o atleta existe
    const atletaResult = await query('SELECT id, nome FROM "Atleta" WHERE id = $1', [atletaId]);
    if (atletaResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Atleta não encontrado' }, { status: 404 }),
        request
      );
    }

    // Verificar conflitos de horário
    const dataHoraNormalizada = normalizarDataHora(dataHora);
    const duracaoMinutos = duracao || 60;
    const dataHoraFim = new Date(dataHoraNormalizada);
    dataHoraFim.setUTCMinutes(dataHoraFim.getUTCMinutes() + duracaoMinutos);

    // Verificar conflitos com agendamentos confirmados
    const conflitosResult = await query(
      `SELECT id FROM "Agendamento"
       WHERE "quadraId" = $1
         AND status = 'CONFIRMADO'
         AND (
           ("dataHora" >= $2 AND "dataHora" < $3)
           OR ("dataHora" + (COALESCE(duracao, 60)) * INTERVAL '1 minute' > $2 AND "dataHora" < $3)
         )`,
      [quadraId, dataHoraNormalizada.toISOString(), dataHoraFim.toISOString()]
    );

    if (conflitosResult.rows.length > 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Horário já está ocupado' }, { status: 400 }),
        request
      );
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
      [quadra.pointId, dataHoraNormalizada.toISOString(), dataHoraFim.toISOString()]
    );

    // Verificar se algum bloqueio afeta esta quadra
    const temBloqueio = bloqueiosResult.rows.some((bloq: any) => {
      // Se quadraIds for null ou vazio, bloqueia todas as quadras
      if (!bloq.quadraIds || (Array.isArray(bloq.quadraIds) && bloq.quadraIds.length === 0)) {
        // Bloqueia todas as quadras - verificar horário
        return verificarConflitoHorario(bloq, dataHoraNormalizada, dataHoraFim);
      }
      
      // Se tiver quadraIds, verificar se esta quadra está na lista
      if (Array.isArray(bloq.quadraIds) && bloq.quadraIds.includes(quadraId)) {
        return verificarConflitoHorario(bloq, dataHoraNormalizada, dataHoraFim);
      }
      
      return false;
    });

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
    const agendamentoId = uuidv4();
    await query(
      `INSERT INTO "Agendamento" (
        id, "quadraId", "atletaId", "dataHora", duracao,
        "valorHora", "valorCalculado", status, observacoes,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMADO', $8, NOW(), NOW())`,
      [
        agendamentoId,
        quadraId,
        atletaId,
        dataHoraNormalizada.toISOString(),
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

