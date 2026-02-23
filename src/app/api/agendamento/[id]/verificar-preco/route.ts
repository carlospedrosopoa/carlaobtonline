import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);

    if (!usuario) {
      return withCors(NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      ), request);
    }

    // 1. Buscar agendamento
    const agendamentoResult = await query(
      `SELECT "quadraId", "dataHora", duracao, "valorHora", "valorCalculado", "valorNegociado", "ehAula"
       FROM "Agendamento"
       WHERE id = $1`,
      [id]
    );

    if (agendamentoResult.rows.length === 0) {
      return withCors(NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      ), request);
    }

    const agendamento = agendamentoResult.rows[0];
    const dataHoraStr = normalizarDataHora(agendamento.dataHora);
    const dataHora = new Date(dataHoraStr);
    const hora = dataHora.getUTCHours(); // Usar UTC pois normalizarDataHora retorna UTC
    const minuto = dataHora.getUTCMinutes();
    const horaAgendamentoMinutos = hora * 60 + minuto;

    // 2. Buscar tabela de preço vigente
    const tabelaPrecoResult = await query(
      `SELECT "valorHora", "valorHoraAula", "inicioMinutoDia", "fimMinutoDia"
       FROM "TabelaPreco"
       WHERE "quadraId" = $1 AND ativo = true
       ORDER BY "inicioMinutoDia" ASC`,
      [agendamento.quadraId]
    );

    let novoValorHora: number | null = null;
    let novoValorCalculado: number | null = null;

    if (tabelaPrecoResult.rows.length > 0) {
      const precoAplicavel = tabelaPrecoResult.rows.find((tp: any) => {
        return horaAgendamentoMinutos >= tp.inicioMinutoDia && horaAgendamentoMinutos < tp.fimMinutoDia;
      });

      if (precoAplicavel) {
        const ehAula = agendamento.ehAula === true || agendamento.ehAula === 'true' || agendamento.ehAula === 1;
        
        if (ehAula) {
          novoValorHora = precoAplicavel.valorHoraAula !== null 
            ? parseFloat(precoAplicavel.valorHoraAula) 
            : parseFloat(precoAplicavel.valorHora);
        } else {
          novoValorHora = parseFloat(precoAplicavel.valorHora);
        }
        
        novoValorCalculado = (novoValorHora * agendamento.duracao) / 60;
      }
    }

    // 3. Comparar valores
    const valorCalculadoAntigo = parseFloat(agendamento.valorCalculado || 0);
    const valorNegociado = agendamento.valorNegociado !== null ? parseFloat(agendamento.valorNegociado) : null;
    
    // Considerar divergência se houver diferença maior que 0.01 centavos
    const temDivergencia = novoValorCalculado !== null && Math.abs(novoValorCalculado - valorCalculadoAntigo) > 0.01;

    return withCors(NextResponse.json({
      precoTabelaAntigo: valorCalculadoAntigo,
      precoTabelaNovo: novoValorCalculado,
      precoNegociado: valorNegociado,
      valorHoraNovo: novoValorHora,
      temDivergencia: temDivergencia
    }), request);

  } catch (error: any) {
    console.error('Erro ao verificar preço:', error);
    return withCors(NextResponse.json(
      { mensagem: 'Erro ao verificar preço', error: error.message },
      { status: 500 }
    ), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
