import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAQuadra } from '@/lib/auth';

function parseDataHoraNaiveToUtc(value: string): Date | null {
  if (!value) return null;
  if (value.endsWith('Z')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [ano, mes, dia] = datePart.split('-').map(Number);
  const [hora, minuto] = timePart.split(':').map(Number);
  if (!ano || !mes || !dia || Number.isNaN(hora) || Number.isNaN(minuto)) return null;
  const date = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json({ mensagem: 'Sem permissão para manutenção da agenda' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const quadraId = (body?.quadraId as string | undefined)?.trim();
    const dataHoraRaw = (body?.dataHora as string | undefined)?.trim();
    const aplicarARecorrencia = Boolean(body?.aplicarARecorrencia);

    if (!quadraId || !dataHoraRaw) {
      return NextResponse.json({ mensagem: 'quadraId e dataHora são obrigatórios' }, { status: 400 });
    }

    const dataHoraDestino = parseDataHoraNaiveToUtc(dataHoraRaw);
    if (!dataHoraDestino) {
      return NextResponse.json({ mensagem: 'dataHora inválida' }, { status: 400 });
    }

    const resultado = await transaction(async (client) => {
      const agendamentoAtualRes = await client.query(
        'SELECT id, "quadraId", "dataHora", "recorrenciaId" FROM "Agendamento" WHERE id = $1 LIMIT 1',
        [id]
      );

      if (agendamentoAtualRes.rows.length === 0) {
        return { erro: NextResponse.json({ mensagem: 'Agendamento não encontrado' }, { status: 404 }) };
      }

      const agendamentoAtual = agendamentoAtualRes.rows[0] as {
        id: string;
        quadraId: string;
        dataHora: string;
        recorrenciaId: string | null;
      };

      const quadraDestinoRes = await client.query(
        'SELECT id FROM "Quadra" WHERE id = $1 LIMIT 1',
        [quadraId]
      );
      if (quadraDestinoRes.rows.length === 0) {
        return { erro: NextResponse.json({ mensagem: 'Quadra de destino não encontrada' }, { status: 404 }) };
      }

      if (usuario.role === 'ORGANIZER') {
        const acessoOrigem = await usuarioTemAcessoAQuadra(usuario, agendamentoAtual.quadraId);
        const acessoDestino = await usuarioTemAcessoAQuadra(usuario, quadraId);
        if (!acessoOrigem || !acessoDestino) {
          return { erro: NextResponse.json({ mensagem: 'Sem acesso à quadra de origem/destino' }, { status: 403 }) };
        }
      }

      const dataHoraOrigem = new Date(agendamentoAtual.dataHora);
      if (Number.isNaN(dataHoraOrigem.getTime())) {
        return { erro: NextResponse.json({ mensagem: 'Data/hora atual inválida no agendamento' }, { status: 400 }) };
      }

      const deltaMs = dataHoraDestino.getTime() - dataHoraOrigem.getTime();
      const agora = new Date().toISOString();

      if (aplicarARecorrencia && agendamentoAtual.recorrenciaId) {
        const futurosRes = await client.query(
          `SELECT id, "dataHora"
           FROM "Agendamento"
           WHERE "recorrenciaId" = $1
             AND "dataHora" >= $2
             AND status <> 'CANCELADO'
           ORDER BY "dataHora" ASC`,
          [agendamentoAtual.recorrenciaId, dataHoraOrigem.toISOString()]
        );

        let atualizados = 0;
        for (const row of futurosRes.rows as Array<{ id: string; dataHora: string }>) {
          const base = new Date(row.dataHora);
          if (Number.isNaN(base.getTime())) continue;
          const novaData = new Date(base.getTime() + deltaMs);
          await client.query(
            `UPDATE "Agendamento"
             SET "quadraId" = $1,
                 "dataHora" = $2,
                 "updatedAt" = $3,
                 "updatedById" = $4
             WHERE id = $5`,
            [quadraId, novaData.toISOString(), agora, usuario.id, row.id]
          );
          atualizados += 1;
        }

        return {
          data: {
            mensagem: `Manutenção aplicada em ${atualizados} agendamento(s) da recorrência`,
            quantidadeAtualizada: atualizados,
            aplicarARecorrencia: true,
          },
        };
      }

      await client.query(
        `UPDATE "Agendamento"
         SET "quadraId" = $1,
             "dataHora" = $2,
             "updatedAt" = $3,
             "updatedById" = $4
         WHERE id = $5`,
        [quadraId, dataHoraDestino.toISOString(), agora, usuario.id, id]
      );

      return {
        data: {
          mensagem: 'Manutenção aplicada ao agendamento',
          quantidadeAtualizada: 1,
          aplicarARecorrencia: false,
        },
      };
    });

    if ('erro' in resultado) return resultado.erro;
    return NextResponse.json(resultado.data);
  } catch (error: any) {
    return NextResponse.json(
      { mensagem: 'Erro ao executar manutenção da agenda', error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
