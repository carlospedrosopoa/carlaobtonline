// app/api/public/agendamento/horarios-disponiveis/route.ts
// API pública para listar horários disponíveis de uma arena
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { agendamentoService } from '@/services/agendamentoService';
import { bloqueioAgendaService } from '@/services/agendamentoService';
import { quadraService } from '@/services/agendamentoService';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/public/agendamento/horarios-disponiveis?pointId=xxx&data=YYYY-MM-DD&duracao=60
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const data = searchParams.get('data'); // YYYY-MM-DD
    const duracao = parseInt(searchParams.get('duracao') || '60', 10);

    if (!pointId) {
      return withCors(
        NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!data) {
      return withCors(
        NextResponse.json({ mensagem: 'data é obrigatória (formato: YYYY-MM-DD)' }, { status: 400 }),
        request
      );
    }

    // Verificar se o point existe e está ativo
    const pointResult = await query('SELECT id, nome, ativo FROM "Point" WHERE id = $1', [pointId]);
    if (pointResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não encontrada' }, { status: 404 }),
        request
      );
    }

    const point = pointResult.rows[0];
    if (!point.ativo) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não está ativa' }, { status: 400 }),
        request
      );
    }

    // Obter esporte do parâmetro (opcional)
    const esporte = searchParams.get('esporte');

    // Buscar quadras ativas da arena (ordenadas alfabeticamente)
    const quadrasResult = await query(
      'SELECT id, nome, "pointId", ativo, "tiposEsporte" FROM "Quadra" WHERE "pointId" = $1 AND ativo = true ORDER BY nome ASC',
      [pointId]
    );

    let quadras = quadrasResult.rows;
    
    // Filtrar por esporte se informado
    if (esporte) {
      quadras = quadras.filter((quadra: any) => {
        let tiposEsporteArray: string[] = [];
        
        if (!quadra.tiposEsporte) {
          return false; // Quadra sem tipos de esporte não aparece no filtro
        }
        
        // Parse do JSON se for string
        if (Array.isArray(quadra.tiposEsporte)) {
          tiposEsporteArray = quadra.tiposEsporte;
        } else if (typeof quadra.tiposEsporte === 'string') {
          try {
            tiposEsporteArray = JSON.parse(quadra.tiposEsporte);
          } catch (e) {
            return false; // Erro ao fazer parse, excluir
          }
        }
        
        // Verificar se a quadra atende o esporte selecionado
        return tiposEsporteArray.some((tipo: string) => 
          tipo && tipo.trim().toLowerCase() === esporte.toLowerCase()
        );
      });
    }
    if (quadras.length === 0) {
      return withCors(
        NextResponse.json({ 
          horarios: [],
          mensagem: 'Nenhuma quadra ativa encontrada para esta arena'
        }, { status: 200 }),
        request
      );
    }

    // Buscar agendamentos confirmados do dia
    const dataInicioDia = `${data}T00:00:00`;
    const dataFimDia = `${data}T23:59:59`;

    const agendamentosResult = await query(
      `SELECT a."quadraId", a."dataHora", a.duracao
       FROM "Agendamento" a
       INNER JOIN "Quadra" q ON a."quadraId" = q.id
       WHERE q."pointId" = $1
         AND a."dataHora" >= $2
         AND a."dataHora" <= $3
         AND a.status = 'CONFIRMADO'`,
      [pointId, dataInicioDia, dataFimDia]
    );

    // Buscar bloqueios do dia
    // BloqueioAgenda usa pointId e quadraIds (JSONB array), não quadraId
    const bloqueiosResult = await query(
      `SELECT b."pointId", b."quadraIds", b."dataInicio", b."dataFim", b."horaInicio", b."horaFim"
       FROM "BloqueioAgenda" b
       WHERE b."pointId" = $1
         AND b."dataInicio" <= $3
         AND b."dataFim" >= $2
         AND b.ativo = true`,
      [pointId, dataInicioDia, dataFimDia]
    );

    // Gerar slots de horário (exemplo: 06:00 até 23:00, de hora em hora)
    const slots: string[] = [];
    for (let hora = 6; hora < 24; hora++) {
      slots.push(`${hora.toString().padStart(2, '0')}:00`);
    }

    // Verificar quais horários estão disponíveis
    const horariosDisponiveis: string[] = [];
    const quadrasIds = quadras.map(q => q.id);

    for (const slot of slots) {
      const [hStr, mStr] = slot.split(':');
      const slotInicioMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
      const slotFimMin = slotInicioMin + duracao;

      // Verificar se alguma quadra está livre neste horário
      const temQuadraLivre = quadrasIds.some(quadraId => {
        // Verificar conflitos com agendamentos
        const temConflitoAgendamento = agendamentosResult.rows.some((ag: any) => {
          if (ag.quadraId !== quadraId) return false;
          
          const agDataHora = new Date(ag.dataHora);
          const agInicioMin = agDataHora.getUTCHours() * 60 + agDataHora.getUTCMinutes();
          const agDuracao = ag.duracao || 60;
          const agFimMin = agInicioMin + agDuracao;

          // Verificar sobreposição
          return !(slotFimMin <= agInicioMin || slotInicioMin >= agFimMin);
        });

        if (temConflitoAgendamento) return false;

        // Verificar conflitos com bloqueios
        const temConflitoBloqueio = bloqueiosResult.rows.some((bloq: any) => {
          // Verificar se o bloqueio afeta esta quadra
          // Se quadraIds for null ou vazio, bloqueia todas as quadras do point
          // Se tiver quadraIds, verificar se esta quadra está na lista
          if (bloq.quadraIds && Array.isArray(bloq.quadraIds) && bloq.quadraIds.length > 0) {
            if (!bloq.quadraIds.includes(quadraId)) {
              return false; // Bloqueio não afeta esta quadra
            }
          }
          // Se quadraIds for null/vazio, bloqueia todas as quadras

          // Verificar conflito de data/hora
          const bloqDataInicio = new Date(bloq.dataInicio);
          const bloqDataFim = new Date(bloq.dataFim);
          
          // Se o bloqueio tem horaInicio/horaFim, usar eles
          // Senão, bloqueia o dia inteiro
          let bloqInicioMin: number;
          let bloqFimMin: number;
          
          if (bloq.horaInicio !== null && bloq.horaInicio !== undefined) {
            bloqInicioMin = bloq.horaInicio; // Já está em minutos
          } else {
            bloqInicioMin = 0; // Início do dia
          }
          
          if (bloq.horaFim !== null && bloq.horaFim !== undefined) {
            bloqFimMin = bloq.horaFim; // Já está em minutos
          } else {
            bloqFimMin = 24 * 60; // Fim do dia (1440 minutos)
          }

          // Verificar se a data do slot está dentro do período do bloqueio
          const slotDate = new Date(`${data}T${slot}:00`);
          const slotDateStr = slotDate.toISOString().split('T')[0];
          const bloqDataInicioStr = bloqDataInicio.toISOString().split('T')[0];
          const bloqDataFimStr = bloqDataFim.toISOString().split('T')[0];
          
          if (slotDateStr < bloqDataInicioStr || slotDateStr > bloqDataFimStr) {
            return false; // Fora do período do bloqueio
          }

          // Verificar sobreposição de horário
          return !(slotFimMin <= bloqInicioMin || slotInicioMin >= bloqFimMin);
        });

        return !temConflitoBloqueio;
      });

      if (temQuadraLivre) {
        horariosDisponiveis.push(slot);
      }
    }

    return withCors(
      NextResponse.json({
        horarios: horariosDisponiveis,
        quadras: quadras.map(q => ({ id: q.id, nome: q.nome })),
        arena: {
          id: point.id,
          nome: point.nome,
        },
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao buscar horários disponíveis:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao buscar horários disponíveis', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

