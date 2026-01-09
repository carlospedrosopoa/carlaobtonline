// app/api/public/agendamento/criar/route.ts
// API pública para criar agendamento com atleta temporário
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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
    const { quadraId, dataHora, duracao, atletaId, usuarioId, observacoes, pointId } = body;

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

    // Validar que a quadra pertence ao point informado (se pointId foi passado)
    // Isso garante que não estamos criando agendamento em quadra de outro point
    if (pointId && quadra.pointId !== pointId) {
      return withCors(
        NextResponse.json({ mensagem: 'Quadra não pertence ao estabelecimento informado' }, { status: 400 }),
        request
      );
    }

    // Verificar se o atleta existe e se tem usuarioId (atleta cadastrado)
    const atletaResult = await query('SELECT id, nome, "usuarioId" FROM "Atleta" WHERE id = $1', [atletaId]);
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
    // Usar o mesmo padrão do appatleta: tratar dataHora como horário "naive" (sem timezone)
    // dataHora vem no formato "YYYY-MM-DDTHH:mm" (horário escolhido pelo usuário)
    // Salvar exatamente como informado, tratando como UTC direto
    const [dataPart, horaPart] = dataHora.split('T');
    const [ano, mes, dia] = dataPart.split('-').map(Number);
    const [hora, minuto] = horaPart.split(':').map(Number);
    
    // Criar data UTC diretamente com os valores informados (sem conversão de timezone)
    const dataHoraUTC = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
    const duracaoMinutos = duracao || 60;
    const dataHoraFim = new Date(dataHoraUTC.getTime() + duracaoMinutos * 60000);

    // Verificar conflitos com agendamentos confirmados
    const conflitosResult = await query(
      `SELECT id FROM "Agendamento"
       WHERE "quadraId" = $1
         AND status = 'CONFIRMADO'
         AND "dataHora" < $3
       AND ("dataHora" + (COALESCE(duracao, 60)) * INTERVAL '1 minute') > $2`,
      [quadraId, dataHoraUTC.toISOString(), dataHoraFim.toISOString()]
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
      [quadra.pointId, dataHoraUTC.toISOString(), dataHoraFim.toISOString()]
    );

    // Verificar se algum bloqueio afeta esta quadra
    const temBloqueio = bloqueiosResult.rows.some((bloq: any) => {
      // Se quadraIds for null ou vazio, bloqueia todas as quadras
      if (!bloq.quadraIds || (Array.isArray(bloq.quadraIds) && bloq.quadraIds.length === 0)) {
        // Bloqueia todas as quadras - verificar horário
        return verificarConflitoHorario(bloq, dataHoraUTC, dataHoraFim);
      }
      
      // Se tiver quadraIds, verificar se esta quadra está na lista
      if (Array.isArray(bloq.quadraIds) && bloq.quadraIds.includes(quadraId)) {
        return verificarConflitoHorario(bloq, dataHoraUTC, dataHoraFim);
      }
      
      return false;
    });

    const verificarConflitoHorario = (bloq: any, inicio: Date, fim: Date): boolean => {
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
    };

    if (temBloqueio) {
      return withCors(
        NextResponse.json({ mensagem: 'Horário está bloqueado' }, { status: 400 }),
        request
      );
    }

    // Calcular valores (buscar tabela de preços da quadra)
    // Usar a mesma lógica do agendamento principal: considerar horários específicos
    let valorHora: number | null = null;
    let valorCalculado: number | null = null;

    try {
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
          // Para agendamento público, usar valorHora (não é aula)
          valorHora = parseFloat(precoAplicavel.valorHora) || null;
          valorCalculado = valorHora ? (valorHora * duracaoMinutos) / 60 : null;
        }
      }
    } catch (error) {
      // Se não houver tabela de preços, continua sem valor
      console.warn('Erro ao buscar preço:', error);
    }

    // Criar agendamento
    // Se o atleta tem usuarioId, vincular ao usuário (como se fosse feito pelo app do atleta)
    // Se não tem usuarioId, é agendamento público/temporário
    const agendamentoId = uuidv4();
    const valorNegociado = valorCalculado; // Para agendamento público, valor negociado = valor calculado
    
    // Tentar inserir com campos opcionais (recorrenciaId, ehAula, professorId, createdById, updatedById)
    try {
      await query(
        `INSERT INTO "Agendamento" (
          id, "quadraId", "usuarioId", "atletaId", "dataHora", duracao,
          "valorHora", "valorCalculado", "valorNegociado", status, observacoes,
          "createdById", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMADO', $10, $11, NOW(), NOW())`,
        [
          agendamentoId,
        quadraId,
        usuarioIdFinal, // Vincular ao usuário se o atleta for cadastrado
        atletaId,
        dataHoraUTC.toISOString(),
        duracaoMinutos,
          valorHora,
          valorCalculado,
          valorNegociado,
          observacoes || null,
          usuarioIdFinal, // createdById - usar o mesmo usuarioId se disponível, senão NULL
        ]
      );
    } catch (error: any) {
      // Se createdById não existe ou é opcional, tentar sem ele
      if (error.message?.includes('createdById') || error.code === '42703') {
        await query(
          `INSERT INTO "Agendamento" (
            id, "quadraId", "usuarioId", "atletaId", "dataHora", duracao,
            "valorHora", "valorCalculado", "valorNegociado", status, observacoes,
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMADO', $10, NOW(), NOW())`,
          [
            agendamentoId,
            quadraId,
            usuarioIdFinal,
            atletaId,
            dataHoraUTC.toISOString(),
            duracaoMinutos,
            valorHora,
            valorCalculado,
            valorNegociado,
            observacoes || null,
          ]
        );
      } else {
        throw error;
      }
    }

    // Buscar agendamento criado para retorno
    const agendamentoResult = await query(
      `SELECT 
        a.id, a."quadraId", a."atletaId", a."dataHora", a.duracao,
        a."valorHora", a."valorCalculado", a.status, a.observacoes,
        q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
        p.nome as "point_nome", p.telefone as "point_telefone",
        at.nome as "atleta_nome", at.fone as "atleta_fone", 
        at."usuarioId" as "atleta_usuarioId", at."aceitaLembretesAgendamento" as "atleta_aceitaLembretes"
       FROM "Agendamento" a
       LEFT JOIN "Quadra" q ON a."quadraId" = q.id
       LEFT JOIN "Point" p ON q."pointId" = p.id
       LEFT JOIN "Atleta" at ON a."atletaId" = at.id
       WHERE a.id = $1`,
      [agendamentoId]
    );

    if (!agendamentoResult.rows || agendamentoResult.rows.length === 0) {
      console.error('[Agendamento Público] Agendamento não encontrado após criação:', agendamentoId);
      return withCors(
        NextResponse.json({ mensagem: 'Erro ao buscar agendamento criado' }, { status: 500 }),
        request
      );
    }

    const agendamento = agendamentoResult.rows[0];
    
    console.log('[Agendamento Público] Dados do agendamento buscado:', {
      id: agendamento.id,
      quadraPointId: agendamento.quadra_pointId,
      pointTelefone: agendamento.point_telefone,
      pointNome: agendamento.point_nome,
      atletaNome: agendamento.atleta_nome,
    });

    // Enviar notificações (em background, não bloqueia a resposta)
    (async () => {
      try {
        const gzappyService = await import('@/lib/gzappyService');
        const { formatarNumeroGzappy, enviarMensagemGzappy } = gzappyService;

        console.log('[Agendamento Público] Verificando dados para envio de notificação:', {
          temPointTelefone: !!agendamento.point_telefone,
          pointTelefone: agendamento.point_telefone,
          temQuadraPointId: !!agendamento.quadra_pointId,
          quadraPointId: agendamento.quadra_pointId,
          atletaNome: agendamento.atleta_nome,
        });

        // Enviar mensagem para o telefone da arena (sempre, para qualquer agendamento novo)
        if (agendamento.point_telefone && agendamento.quadra_pointId) {
          const telefoneArena = agendamento.point_telefone;
          const telefoneFormatado = formatarNumeroGzappy(telefoneArena);
          
          console.log('[Agendamento Público] Enviando mensagem para telefone da arena:', {
            telefoneOriginal: telefoneArena,
            telefoneFormatado: telefoneFormatado,
            pointId: agendamento.quadra_pointId,
          });
          
          // Extrair data e hora
          const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
          let dataFormatada: string;
          let horaFormatada: string;
          
          if (matchDataHora) {
            const [, ano, mes, dia, hora, minuto] = matchDataHora;
            dataFormatada = `${dia}/${mes}/${ano}`;
            horaFormatada = `${hora}:${minuto}`;
          } else {
            const dataHora = new Date(agendamento.dataHora);
            dataFormatada = dataHora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            horaFormatada = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }

          const horas = Math.floor(agendamento.duracao / 60);
          const minutos = agendamento.duracao % 60;
          const duracaoTexto = horas > 0 
            ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
            : `${minutos}min`;

          const nomeArena = agendamento.point_nome || 'Arena';
          const valorFormatado = agendamento.valorCalculado
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(agendamento.valorCalculado)
            : 'N/A';

          const mensagemArena = `*${nomeArena}*

✅ *Agendamento Confirmado*

👤 *Atleta:* ${agendamento.atleta_nome}
🔍 *Quadra:* ${agendamento.quadra_nome}
📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
⏱️ *Duração:* ${duracaoTexto}
💰 *Valor:* ${valorFormatado}

Esperamos você! 🎾`;

          console.log('[Agendamento Público] Mensagem preparada:', mensagemArena.substring(0, 100) + '...');

          const resultadoEnvio = await enviarMensagemGzappy({
            destinatario: telefoneFormatado,
            mensagem: mensagemArena,
            tipo: 'texto',
          }, agendamento.quadra_pointId);
          
          console.log('[Agendamento Público] Resultado do envio:', resultadoEnvio);
        } else {
          console.warn('[Agendamento Público] Não foi possível enviar mensagem:', {
            motivo: !agendamento.point_telefone ? 'Telefone da arena não cadastrado' : 'PointId não encontrado',
            pointTelefone: agendamento.point_telefone,
            quadraPointId: agendamento.quadra_pointId,
          });
        }

        // Nota: Na rota pública não enviamos mensagem para o atleta, apenas para o telefone da arena
        // O atleta já recebe confirmação visual na tela ao criar o agendamento
      } catch (err: any) {
        console.error('[Agendamento Público] Erro ao enviar notificações Gzappy:', err);
        console.error('[Agendamento Público] Stack trace:', err.stack);
      }
    })();

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
    console.error('Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
    });
    return withCors(
      NextResponse.json(
        { 
          mensagem: 'Erro ao criar agendamento', 
          erro: error.message,
          detalhes: process.env.NODE_ENV === 'development' ? {
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
            column: error.column,
          } : undefined
        },
        { status: 500 }
      ),
      request
    );
  }
}

