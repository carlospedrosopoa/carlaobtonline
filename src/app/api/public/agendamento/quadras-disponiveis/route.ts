// app/api/public/agendamento/quadras-disponiveis/route.ts
// API pública para listar quadras disponíveis em um horário específico
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/public/agendamento/quadras-disponiveis?pointId=xxx&data=YYYY-MM-DD&horario=HH:mm&duracao=60
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const data = searchParams.get('data'); // YYYY-MM-DD
    const horario = searchParams.get('horario'); // HH:mm
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

    if (!horario) {
      return withCors(
        NextResponse.json({ mensagem: 'horario é obrigatório (formato: HH:mm)' }, { status: 400 }),
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

    // Buscar todas as quadras ativas da arena (ordenadas alfabeticamente)
    const quadrasResult = await query(
      'SELECT id, nome, "pointId", ativo, "tiposEsporte" FROM "Quadra" WHERE "pointId" = $1 AND ativo = true ORDER BY nome ASC',
      [pointId]
    );

    const todasQuadras = quadrasResult.rows;
    if (todasQuadras.length === 0) {
      return withCors(
        NextResponse.json({ 
          quadras: [],
          mensagem: 'Nenhuma quadra ativa encontrada para esta arena'
        }, { status: 200 }),
        request
      );
    }

    // Calcular dataHora de início e fim
    // normalizarDataHora retorna string ISO, então precisamos criar Date manualmente
    const [ano, mes, dia] = data.split('-').map(Number);
    const [hora, minuto] = horario.split(':').map(Number);
    
    // Criar Date UTC diretamente com os valores informados
    const dataHoraInicio = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0));
    const dataHoraFim = new Date(dataHoraInicio);
    dataHoraFim.setUTCMinutes(dataHoraFim.getUTCMinutes() + duracao);

    // Buscar agendamentos confirmados que conflitam com este horário
    const agendamentosResult = await query(
      `SELECT a."quadraId", a."dataHora", a.duracao
       FROM "Agendamento" a
       INNER JOIN "Quadra" q ON a."quadraId" = q.id
       WHERE q."pointId" = $1
         AND a.status = 'CONFIRMADO'
         AND (
           (a."dataHora" >= $2 AND a."dataHora" < $3)
           OR (a."dataHora" + (COALESCE(a.duracao, 60)) * INTERVAL '1 minute' > $2 AND a."dataHora" < $3)
         )`,
      [pointId, dataHoraInicio.toISOString(), dataHoraFim.toISOString()]
    );

    // Buscar bloqueios que afetam este horário
    const bloqueiosResult = await query(
      `SELECT b."quadraIds", b."dataInicio", b."dataFim", b."horaInicio", b."horaFim"
       FROM "BloqueioAgenda" b
       WHERE b."pointId" = $1
         AND b.ativo = true
         AND b."dataInicio" <= $3
         AND b."dataFim" >= $2`,
      [pointId, dataHoraInicio.toISOString(), dataHoraFim.toISOString()]
    );

    // Função para verificar se uma quadra está bloqueada
    const quadraEstaBloqueada = (quadraId: string): boolean => {
      return bloqueiosResult.rows.some((bloq: any) => {
        // Se quadraIds for null ou vazio, bloqueia todas as quadras
        if (!bloq.quadraIds || (Array.isArray(bloq.quadraIds) && bloq.quadraIds.length === 0)) {
          // Verificar se o bloqueio cobre este horário
          return verificarConflitoHorarioBloqueio(bloq, dataHoraInicio, dataHoraFim);
        }
        
        // Se tiver quadraIds, verificar se esta quadra está na lista
        if (Array.isArray(bloq.quadraIds) && bloq.quadraIds.includes(quadraId)) {
          return verificarConflitoHorarioBloqueio(bloq, dataHoraInicio, dataHoraFim);
        }
        
        return false;
      });
    };

    const verificarConflitoHorarioBloqueio = (bloq: any, inicio: Date, fim: Date): boolean => {
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

    // Filtrar quadras disponíveis (sem conflitos e por esporte se informado)
    const quadrasDisponiveis = todasQuadras.filter((quadra: any) => {
      // Filtrar por esporte se informado
      if (esporte) {
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
        const atendeEsporte = tiposEsporteArray.some((tipo: string) => 
          tipo && tipo.trim().toLowerCase() === esporte.toLowerCase()
        );
        
        if (!atendeEsporte) {
          return false; // Quadra não atende o esporte selecionado
        }
      }

      // Verificar se há agendamento nesta quadra neste horário
      const temAgendamento = agendamentosResult.rows.some((ag: any) => ag.quadraId === quadra.id);
      if (temAgendamento) return false;

      // Verificar se está bloqueada
      if (quadraEstaBloqueada(quadra.id)) return false;

      return true;
    });

    // Ordenar quadras disponíveis alfabeticamente por nome
    quadrasDisponiveis.sort((a: any, b: any) => {
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });

    return withCors(
      NextResponse.json({
        quadras: quadrasDisponiveis.map((q: any) => ({ id: q.id, nome: q.nome })),
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao buscar quadras disponíveis:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao buscar quadras disponíveis', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

