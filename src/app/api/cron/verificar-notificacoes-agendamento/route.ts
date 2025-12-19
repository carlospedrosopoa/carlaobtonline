// app/api/cron/verificar-notificacoes-agendamento/route.ts
// Rota para verificar e enviar lembretes de agendamento
// Pode ser chamada manualmente via GET ou configurada para rodar automaticamente
// Para chamar manualmente: GET /api/cron/verificar-notificacoes-agendamento
// Com header: Authorization: Bearer {CRON_SECRET} (se configurado)

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { enviarMensagemGzappy, formatarNumeroGzappy } from '@/lib/gzappyService';

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
    const agora = new Date();
    
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
      
      // Calcular janela de tempo (entre antecedencia-1h e antecedencia)
      // Isso garante que verificamos uma vez por hora e não perdemos nenhum
      const emAntecedenciaMenos1h = new Date(agora.getTime() + (antecedenciaHoras - 1) * 60 * 60 * 1000);
      const emAntecedencia = new Date(agora.getTime() + antecedenciaHoras * 60 * 60 * 1000);

      try {
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
            p.id as "point_id"
          FROM "Agendamento" a
          INNER JOIN "Quadra" q ON a."quadraId" = q.id
          INNER JOIN "Point" p ON q."pointId" = p.id
          INNER JOIN "Atleta" at ON a."atletaId" = at.id
          LEFT JOIN "NotificacaoAgendamento" n ON n."agendamentoId" = a.id 
            AND n.tipo = $1
            AND n.enviada = true
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
          emAntecedenciaMenos1h.toISOString(),
          emAntecedencia.toISOString()
        ]);

        console.log(`[NOTIFICAÇÃO] Arena ${arena.nome}: ${result.rows.length} agendamentos para notificar`);

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
            const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (!matchDataHora) {
              console.error(`[NOTIFICAÇÃO] Formato de data inválido para agendamento ${agendamento.id}`);
              continue;
            }

            const [, ano, mes, dia, hora, minuto] = matchDataHora;
            const dataFormatada = `${dia}/${mes}/${ano}`;
            const horaFormatada = `${hora}:${minuto}`;

            // Formatar duração
            const horas = Math.floor(agendamento.duracao / 60);
            const minutos = agendamento.duracao % 60;
            const duracaoTexto = horas > 0 
              ? `${horas}h${minutos > 0 ? ` e ${minutos}min` : ''}`
              : `${minutos}min`;

            // Montar mensagem
            const mensagem = `🏸 *Lembrete de Agendamento*\n\n` +
              `Olá ${nome}!\n\n` +
              `Você tem um agendamento em *${antecedenciaHoras} horas*:\n\n` +
              `📅 Data: ${dataFormatada}\n` +
              `🕐 Horário: ${horaFormatada}\n` +
              `⏱️ Duração: ${duracaoTexto}\n` +
              `🏟️ Quadra: ${agendamento.quadra_nome}\n` +
              `📍 Arena: ${agendamento.point_nome}\n\n` +
              `Não esqueça! 😊`;

            // Enviar via Gzappy usando credenciais da arena
            const telefoneFormatado = formatarNumeroGzappy(telefone);
            const enviado = await enviarMensagemGzappy({
              destinatario: telefoneFormatado,
              mensagem,
              tipo: 'texto',
            }, arena.id);

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

