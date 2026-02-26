// app/api/public/agendamento/horarios-disponiveis/route.ts
// API pública para listar horários disponíveis de uma arena
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { carregarHorariosAtendimentoPoint, diaSemanaFromYYYYMMDD, slotDentroDoHorario } from '@/lib/horarioAtendimento';

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
    const pointResult = await query(
      'SELECT id, nome, endereco, "logoUrl", ativo FROM "Point" WHERE id = $1',
      [pointId]
    );
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

    const inicioDiaUTC = new Date(`${data}T00:00:00Z`);
    const diaAnteriorUTC = new Date(inicioDiaUTC);
    diaAnteriorUTC.setUTCDate(diaAnteriorUTC.getUTCDate() - 1);
    const proximoDiaUTC = new Date(inicioDiaUTC);
    proximoDiaUTC.setUTCDate(proximoDiaUTC.getUTCDate() + 1);
    const dataDiaAnterior = diaAnteriorUTC.toISOString().slice(0, 10);
    const dataProximoDia = proximoDiaUTC.toISOString().slice(0, 10);

    const dataInicioBusca = `${dataDiaAnterior}T00:00:00Z`;
    const dataFimBusca = `${dataProximoDia}T23:59:59Z`;

    const horariosAtendimento = await carregarHorariosAtendimentoPoint(pointId);
    const diaSemana = diaSemanaFromYYYYMMDD(data);

    const agendamentosResult = await query(
      `SELECT a."quadraId", a."dataHora", a.duracao
       FROM "Agendamento" a
       INNER JOIN "Quadra" q ON a."quadraId" = q.id
       WHERE q."pointId" = $1
         AND a."dataHora" >= $2
         AND a."dataHora" <= $3
         AND a.status = 'CONFIRMADO'`,
      [pointId, dataInicioBusca, dataFimBusca]
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
      [pointId, dataInicioBusca, dataFimBusca]
    );

    const slots: string[] = [];
    for (let hora = 6; hora <= 23; hora++) {
      const inicioMin = hora * 60;
      if (!slotDentroDoHorario(horariosAtendimento, diaSemana, inicioMin, duracao)) continue;
      slots.push(`${hora.toString().padStart(2, '0')}:00`);
    }

    // Verificar quais horários estão disponíveis
    const horariosDisponiveis: string[] = [];
    const quadrasIds = quadras.map(q => q.id);

    const parseQuadraIds = (value: any): string[] | null => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    const parseDateUTC = (value: any) => {
      const v = String(value || '');
      if (/[zZ]|[+-]\d\d:\d\d$/.test(v)) return new Date(v);
      return new Date(`${v}Z`);
    };

    const bloqueioConflita = (bloq: any, quadraId: string, slotInicio: Date, slotFim: Date): boolean => {
      const quadraIds = parseQuadraIds(bloq.quadraIds);
      if (quadraIds && quadraIds.length > 0 && !quadraIds.includes(quadraId)) return false;

      const bloqInicio = parseDateUTC(bloq.dataInicio);
      const bloqFim = parseDateUTC(bloq.dataFim);
      const bloqInicioDia = new Date(Date.UTC(bloqInicio.getUTCFullYear(), bloqInicio.getUTCMonth(), bloqInicio.getUTCDate()));
      const bloqFimDia = new Date(Date.UTC(bloqFim.getUTCFullYear(), bloqFim.getUTCMonth(), bloqFim.getUTCDate()));

      const slotInicioDia = new Date(Date.UTC(slotInicio.getUTCFullYear(), slotInicio.getUTCMonth(), slotInicio.getUTCDate()));
      const slotFimDia = new Date(Date.UTC(slotFim.getUTCFullYear(), slotFim.getUTCMonth(), slotFim.getUTCDate()));

      const dia = new Date(slotInicioDia);
      while (dia <= slotFimDia) {
        if (dia >= bloqInicioDia && dia <= bloqFimDia) {
          const inicioMin = bloq.horaInicio !== null && bloq.horaInicio !== undefined ? Number(bloq.horaInicio) : 0;
          const fimMin = bloq.horaFim !== null && bloq.horaFim !== undefined ? Number(bloq.horaFim) : 1440;
          const bloqueioInicio = new Date(dia.getTime() + inicioMin * 60_000);
          const bloqueioFim = new Date(dia.getTime() + fimMin * 60_000);
          if (bloqueioInicio < slotFim && bloqueioFim > slotInicio) return true;
        }
        dia.setUTCDate(dia.getUTCDate() + 1);
      }

      return false;
    };

    for (const slot of slots) {
      const slotInicio = new Date(`${data}T${slot}:00Z`);
      const slotFim = new Date(slotInicio.getTime() + duracao * 60_000);

      const temQuadraLivre = quadrasIds.some((quadraId) => {
        const temConflitoAgendamento = agendamentosResult.rows.some((ag: any) => {
          if (ag.quadraId !== quadraId) return false;
          const agInicio = parseDateUTC(ag.dataHora);
          const agFim = new Date(agInicio.getTime() + (Number(ag.duracao) || 60) * 60_000);
          return agInicio < slotFim && agFim > slotInicio;
        });
        if (temConflitoAgendamento) return false;

        const temConflitoBloqueio = bloqueiosResult.rows.some((bloq: any) => bloqueioConflita(bloq, quadraId, slotInicio, slotFim));
        return !temConflitoBloqueio;
      });

      if (temQuadraLivre) horariosDisponiveis.push(slot);
    }

    return withCors(
      NextResponse.json({
        horarios: horariosDisponiveis,
        quadras: quadras.map(q => ({ id: q.id, nome: q.nome })),
        arena: {
          id: point.id,
          nome: point.nome,
          endereco: point.endereco || null,
          logoUrl: point.logoUrl || null,
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

