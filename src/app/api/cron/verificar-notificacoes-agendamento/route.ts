// app/api/cron/verificar-notificacoes-agendamento/route.ts
// Rota para verificar e enviar lembretes de agendamento
// Pode ser chamada manualmente via GET ou configurada para rodar automaticamente
// Para chamar manualmente: GET /api/cron/verificar-notificacoes-agendamento
// Com header: Authorization: Bearer {CRON_SECRET} (se configurado)

import { NextRequest, NextResponse } from 'next/server';
import { normalizarDataHora, query } from '@/lib/db';
import {
  enviarMensagemGzappy,
  formatarNumeroGzappy,
  notificarAtletaConfirmacaoProximoAgendamento,
} from '@/lib/gzappyService';

const TIME_ZONE_NEGOCIO = 'America/Sao_Paulo';
const CRON_LOGICA_VERSAO = '2026-05-10-v2';

function obterPartesDataNoFuso(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || '0');

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function obterAgoraReferenciaAgendamento(): Date {
  const agoraReal = new Date();
  const partesSP = obterPartesDataNoFuso(agoraReal, TIME_ZONE_NEGOCIO);

  // O projeto grava dataHora em UTC, mas tratando a hora local como "naive".
  // Para o cron comparar corretamente, espelhamos o "agora" real no mesmo formato.
  return new Date(
    Date.UTC(
      partesSP.year,
      partesSP.month - 1,
      partesSP.day,
      partesSP.hour,
      partesSP.minute,
      partesSP.second,
      0
    )
  );
}

function extrairDataHoraAgendamento(
  dataHoraValue: unknown
): {
  dataHoraNormalizada: string;
  dataFormatada: string;
  horaFormatada: string;
} | null {
  const dataHoraNormalizada = normalizarDataHora(dataHoraValue);
  if (!dataHoraNormalizada) {
    return null;
  }

  const matchDataHora = dataHoraNormalizada.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!matchDataHora) {
    return null;
  }

  const [, ano, mes, dia, hora, minuto] = matchDataHora;

  return {
    dataHoraNormalizada,
    dataFormatada: `${dia}/${mes}/${ano}`,
    horaFormatada: `${hora}:${minuto}`,
  };
}

export async function GET(request: NextRequest) {
  // Verificar se é uma chamada autorizada
  // Para testes, pode ser chamada manualmente com o header Authorization
  // Ou com parâmetro ?test=true na URL (apenas para desenvolvimento/testes)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const isTestMode = searchParams.get('test') === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Permitir acesso sem autenticação em modo de teste ou desenvolvimento
  // Se CRON_SECRET estiver configurado e não for modo de teste, exigir autenticação
  if (cronSecret && !isTestMode && !isDevelopment) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        mensagem: 'Forneça o header Authorization: Bearer {CRON_SECRET} ou adicione ?test=true na URL para testes'
      }, { status: 401 });
    }
  } else {
    // Em modo de teste ou desenvolvimento, permitir acesso mas avisar
    if (isTestMode) {
      console.warn('[CRON] ⚠️ Modo de teste ativado (?test=true) - permitindo acesso sem autenticação');
    } else if (isDevelopment) {
      console.warn('[CRON] ⚠️ Ambiente de desenvolvimento - permitindo acesso sem autenticação');
    } else {
      console.warn('[CRON] ⚠️ CRON_SECRET não configurado - permitindo acesso sem autenticação (apenas para testes)');
    }
  }

  try {
    const agoraReal = new Date();
    const agora = obterAgoraReferenciaAgendamento();
    
    // Buscar todas as arenas que têm lembretes habilitados
    const arenasComLembretes = await query(
      `SELECT 
        id, nome, "enviarLembretesAgendamento", "antecedenciaLembrete", "gzappyAtivo"
      FROM "Point"
      WHERE "enviarLembretesAgendamento" = true
        AND "gzappyAtivo" = true
        AND "antecedenciaLembrete" IS NOT NULL
        AND "antecedenciaLembrete" > 0`
    );

    if (arenasComLembretes.rows.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhuma arena com lembretes habilitados',
        totalEncontrados: 0,
        notificacoesEnviadas: 0
      });
    }

    const notificacoesEnviadas: string[] = [];
    const erros: Array<{ arena: string; erro: string }> = [];

    // Para cada arena, verificar agendamentos
    for (const arena of arenasComLembretes.rows) {
      const antecedenciaHoras = arena.antecedenciaLembrete;
      const usaJanelaAteAntecedencia = antecedenciaHoras <= 12;

      // Para mensagens interativas (<= 12h), considerar qualquer agendamento
      // entre agora e o limite de antecedência. Como já existe trava de não reenvio,
      // isso evita perder confirmações quando o cron não roda exatamente no "ponto".
      // Para lembretes informativos (> 12h), manter a janela de 1 hora.
      const janelaInicio = usaJanelaAteAntecedencia
        ? agora
        : new Date(agora.getTime() + (antecedenciaHoras - 1) * 60 * 60 * 1000);
      const janelaFim = new Date(agora.getTime() + antecedenciaHoras * 60 * 60 * 1000);

      console.log(`[NOTIFICAÇÃO] Arena ${arena.nome}:`);
      console.log(`  - Versão da lógica do cron: ${CRON_LOGICA_VERSAO}`);
      console.log(`  - Antecedência: ${antecedenciaHoras} horas`);
      console.log(`  - Agora real UTC: ${agoraReal.toISOString()}`);
      console.log(`  - Agora referência agenda (${TIME_ZONE_NEGOCIO}): ${agora.toISOString()}`);
      console.log(`  - Modo da janela: ${usaJanelaAteAntecedencia ? 'agora até o limite de antecedência' : 'faixa de 1h no ponto da antecedência'}`);
      console.log(`  - Janela de busca: ${janelaInicio.toISOString()} até ${janelaFim.toISOString()}`);
      console.log(`  - Buscando agendamentos que acontecerão entre ${janelaInicio.toLocaleString('pt-BR')} e ${janelaFim.toLocaleString('pt-BR')}`);

      try {
        // Primeiro, vamos verificar TODOS os agendamentos confirmados para debug
        const agoraMais24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
        const sqlDebug = `
          SELECT 
            a.id, a."dataHora", a.duracao, a.status,
            at.nome as "atleta_nome", 
            at.fone as "atleta_fone",
            at."aceitaLembretesAgendamento",
            q.nome as "quadra_nome",
            p.nome as "point_nome"
          FROM "Agendamento" a
          INNER JOIN "Quadra" q ON a."quadraId" = q.id
          INNER JOIN "Point" p ON q."pointId" = p.id
          INNER JOIN "Atleta" at ON a."atletaId" = at.id
          WHERE a.status = 'CONFIRMADO'
            AND p.id = $1
            AND a."dataHora" >= $2
            AND a."dataHora" <= $3
          ORDER BY a."dataHora" ASC
        `;
        const debugResult = await query(sqlDebug, [arena.id, agora.toISOString(), agoraMais24h.toISOString()]);
        console.log(`  - Total de agendamentos confirmados nas próximas 24h: ${debugResult.rows.length}`);
        debugResult.rows.forEach((ag: any) => {
          const dataHora = new Date(ag.dataHora);
          const horasRestantes = Math.round((dataHora.getTime() - agora.getTime()) / (1000 * 60 * 60 * 100)) / 10;
          console.log(`    * Agendamento ${ag.id}: ${dataHora.toLocaleString('pt-BR')} (${horasRestantes}h restantes)`);
          console.log(`      - Atleta: ${ag.atleta_nome}, Telefone: ${ag.atleta_fone ? 'SIM' : 'NÃO'}, Aceita lembretes: ${ag.aceitaLembretesAgendamento}`);
        });

        // Buscar agendamentos confirmados que estão na janela de tempo
        // e que ainda não receberam notificação deste tipo
        const sql = `
          SELECT 
            a.id, a."dataHora", a.duracao,
            a."atletaId",
            at.nome as "atleta_nome", 
            at.fone as "atleta_fone",
            q.nome as "quadra_nome",
            p.nome as "point_nome", 
            p.id as "point_id",
            gi_ultima.status as "ultima_interacao_status",
            gi_ultima."respostaRecebida" as "ultima_resposta_recebida",
            gi_ultima."createdAt" as "ultima_interacao_em"
          FROM "Agendamento" a
          INNER JOIN "Quadra" q ON a."quadraId" = q.id
          INNER JOIN "Point" p ON q."pointId" = p.id
          INNER JOIN "Atleta" at ON a."atletaId" = at.id
          LEFT JOIN "NotificacaoAgendamento" n ON n."agendamentoId" = a.id 
            AND n.tipo = $1
            AND n.enviada = true
          LEFT JOIN LATERAL (
            SELECT
              gi.status,
              gi."respostaRecebida",
              gi."createdAt"
            FROM "GzappyInteracaoAgendamento" gi
            WHERE gi."agendamentoId" = a.id
            ORDER BY gi."createdAt" DESC
            LIMIT 1
          ) gi_ultima ON true
          WHERE a.status = 'CONFIRMADO'
            AND p.id = $2
            AND a."dataHora" >= $3
            AND a."dataHora" <= $4
            AND n.id IS NULL
            AND at."aceitaLembretesAgendamento" = true
            AND at.fone IS NOT NULL
            AND at.fone != ''
        `;

        const tipoNotificacao = `LEMBRETE_${antecedenciaHoras}H`;
        const result = await query(sql, [
          tipoNotificacao,
          arena.id,
          janelaInicio.toISOString(),
          janelaFim.toISOString()
        ]);

        console.log(`  - Agendamentos na janela de ${antecedenciaHoras}h: ${result.rows.length}`);

        for (const agendamento of result.rows) {
          try {
            // Usar telefone e nome do atleta (já filtrado na query)
            const telefone = agendamento.atleta_fone;
            const nome = agendamento.atleta_nome;

            if (!telefone || !nome) {
              console.log(`[NOTIFICAÇÃO] Agendamento ${agendamento.id} sem telefone ou nome válido para notificação`);
              continue;
            }

            // Formatar data/hora
            const dataHoraInfo = extrairDataHoraAgendamento(agendamento.dataHora);
            if (!dataHoraInfo) {
              console.error(
                `[NOTIFICAÇÃO] Formato de data inválido para agendamento ${agendamento.id}`,
                { valorRecebido: agendamento.dataHora }
              );
              continue;
            }
            const {
              dataHoraNormalizada,
              dataFormatada,
              horaFormatada,
            } = dataHoraInfo;

            // Formatar duração
            const horas = Math.floor(agendamento.duracao / 60);
            const minutos = agendamento.duracao % 60;
            const duracaoTexto = horas > 0 
              ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
              : `${minutos}min`;

            let enviado = false;

            if (antecedenciaHoras <= 12) {
              const statusInteracaoAtual = agendamento.ultima_interacao_status as string | null;
              const devePularConfirmacaoInterativa = [
                'AGUARDANDO_ENVIO',
                'AGUARDANDO_RESPOSTA',
                'CONFIRMADO_RECEBIMENTO',
                'SOLICITOU_CONTATO',
              ].includes(statusInteracaoAtual || '');

              if (devePularConfirmacaoInterativa) {
                console.log(
                  `[NOTIFICAÇÃO] ⏭️ Confirmação interativa não reenviada para agendamento ${agendamento.id} ` +
                  `(status atual: ${statusInteracaoAtual}, resposta: ${agendamento.ultima_resposta_recebida || 'sem resposta'})`
                );
                continue;
              }

              enviado = await notificarAtletaConfirmacaoProximoAgendamento(
                telefone,
                arena.id,
                {
                  agendamentoId: agendamento.id,
                  quadra: agendamento.quadra_nome,
                  arena: agendamento.point_nome,
                  dataHora: dataHoraNormalizada,
                  duracao: agendamento.duracao,
                  antecedenciaHoras,
                  nomeAtleta: nome,
                }
              );
            } else {
              const mensagem = `🏸 *Lembrete de Agendamento*\n\n` +
                `Olá ${nome}!\n\n` +
                `Você tem um agendamento em *${antecedenciaHoras} horas*:\n\n` +
                `📅 Data: ${dataFormatada}\n` +
                `🕐 Horário: ${horaFormatada}\n` +
                `⏱️ Duração: ${duracaoTexto}\n` +
                `🏟️ Quadra: ${agendamento.quadra_nome}\n` +
                `📍 Arena: ${agendamento.point_nome}\n\n` +
                `Não esqueça! 😊`;

              const telefoneFormatado = formatarNumeroGzappy(telefone);
              enviado = await enviarMensagemGzappy({
                destinatario: telefoneFormatado,
                mensagem,
                tipo: 'texto',
              }, arena.id);
            }

            if (enviado) {
              // Registrar notificação enviada
              await query(
                `INSERT INTO "NotificacaoAgendamento" 
                 (id, "agendamentoId", tipo, enviada, "dataEnvio", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2, true, NOW(), NOW(), NOW())`,
                [agendamento.id, tipoNotificacao]
              );

              notificacoesEnviadas.push(agendamento.id);
              console.log(`[NOTIFICAÇÃO] ✅ Enviada para agendamento ${agendamento.id} (${nome})`);
            } else {
              console.error(`[NOTIFICAÇÃO] ❌ Falha ao enviar para agendamento ${agendamento.id}`);
            }
          } catch (error: any) {
            console.error(`[NOTIFICAÇÃO] Erro ao processar agendamento ${agendamento.id}:`, error);
            erros.push({
              arena: arena.nome,
              erro: `Agendamento ${agendamento.id}: ${error.message}`
            });
          }
        }
      } catch (error: any) {
        console.error(`[NOTIFICAÇÃO] Erro ao processar arena ${arena.nome}:`, error);
        erros.push({
          arena: arena.nome,
          erro: error.message
        });
      }
    }

    return NextResponse.json({
      sucesso: true,
      totalArenas: arenasComLembretes.rows.length,
      notificacoesEnviadas: notificacoesEnviadas.length,
      erros: erros.length > 0 ? erros : undefined
    });
  } catch (error: any) {
    console.error('[NOTIFICAÇÃO] Erro ao verificar notificações:', error);
    return NextResponse.json(
      { 
        sucesso: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204 });
}

