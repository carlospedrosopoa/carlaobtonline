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

    // Buscar quadras ativas da arena
    const quadrasResult = await query(
      'SELECT id, nome, "pointId", ativo FROM "Quadra" WHERE "pointId" = $1 AND ativo = true',
      [pointId]
    );

    const quadras = quadrasResult.rows;
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
    const bloqueiosResult = await query(
      `SELECT b."quadraId", b."dataHoraInicio", b."dataHoraFim"
       FROM "BloqueioAgenda" b
       INNER JOIN "Quadra" q ON b."quadraId" = q.id
       WHERE q."pointId" = $1
         AND b."dataHoraInicio" <= $3
         AND b."dataHoraFim" >= $2
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
          if (bloq.quadraId !== quadraId) return false;

          const bloqInicio = new Date(bloq.dataHoraInicio);
          const bloqFim = new Date(bloq.dataHoraFim);
          const bloqInicioMin = bloqInicio.getUTCHours() * 60 + bloqInicio.getUTCMinutes();
          const bloqFimMin = bloqFim.getUTCHours() * 60 + bloqFim.getUTCMinutes();

          // Verificar sobreposição
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

