import { NextRequest, NextResponse } from 'next/server';
import { normalizarDataHora, query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';

function ymdToUtcStart(ymd: string) {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function ymdToUtcEnd(ymd: string) {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function toYMDUTC(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=domingo
  const diffToMonday = (day + 6) % 7;

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - diffToMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

type ClienteCard = {
  id: string;
  nome: string;
  telefone: string | null;
  origem: 'ATLETA' | 'USUARIO' | 'AVULSO';
  agendamentos: Array<{
    id: string;
    dataHora: string;
    duracao: number;
    status: string;
    observacoes: string | null;
    quadraNome: string | null;
    nomeAvulso: string | null;
    telefoneAvulso: string | null;
    ehAula: boolean | null;
    professorNome: string | null;
  }>;
};

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json({ mensagem: 'Você não tem permissão para acessar este recurso' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const incluirCancelados = searchParams.get('incluirCancelados') === '1';

    let pointId = searchParams.get('pointId') || '';
    if (usuario.role === 'ORGANIZER') {
      if (!usuario.pointIdGestor) {
        return NextResponse.json({ mensagem: 'PointId do gestor não configurado' }, { status: 400 });
      }
      pointId = usuario.pointIdGestor;
    }

    if (!pointId) {
      return NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 });
    }

    const range = dataInicio && dataFim ? { start: ymdToUtcStart(dataInicio), end: ymdToUtcEnd(dataFim) } : getCurrentWeekUTC();

    const pointResult = await query(`SELECT id, nome, "logoUrl" FROM "Point" WHERE id = $1 LIMIT 1`, [pointId]);
    if (pointResult.rows.length === 0) {
      return NextResponse.json({ mensagem: 'Arena não encontrada' }, { status: 404 });
    }
    const point = pointResult.rows[0];

    const sql = `
      SELECT
        a.id,
        a."dataHora",
        a.duracao,
        a.status,
        a.observacoes,
        a."nomeAvulso",
        a."telefoneAvulso",
        a."ehAula",
        a."professorId",
        q.nome as "quadraNome",
        u.id as "usuarioId",
        u.name as "usuarioName",
        at.id as "atletaId",
        at.nome as "atletaNome",
        at.fone as "atletaFone",
        up.name as "professorUsuarioName"
      FROM "Agendamento" a
      INNER JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      LEFT JOIN "Professor" pr ON a."professorId" = pr.id
      LEFT JOIN "User" up ON pr."userId" = up.id
      WHERE q."pointId" = $1
        AND a."dataHora" >= $2
        AND a."dataHora" <= $3
        ${incluirCancelados ? '' : `AND a.status <> 'CANCELADO'`}
      ORDER BY a."dataHora" ASC
    `;

    const result = await query(sql, [pointId, range.start.toISOString(), range.end.toISOString()]);

    const byCliente = new Map<string, ClienteCard>();

    for (const row of result.rows as any[]) {
      const atletaId = row.atletaId ? String(row.atletaId) : '';
      const usuarioId = row.usuarioId ? String(row.usuarioId) : '';
      const nomeAvulso = row.nomeAvulso ? String(row.nomeAvulso) : '';
      const telefoneAvulso = row.telefoneAvulso ? String(row.telefoneAvulso) : '';

      let clienteId = '';
      let clienteNome = '';
      let clienteTelefone: string | null = null;
      let origem: ClienteCard['origem'] = 'AVULSO';

      if (atletaId) {
        clienteId = `ATLETA:${atletaId}`;
        clienteNome = row.atletaNome || 'Atleta';
        clienteTelefone = row.atletaFone || null;
        origem = 'ATLETA';
      } else if (usuarioId) {
        clienteId = `USUARIO:${usuarioId}`;
        clienteNome = row.usuarioName || 'Usuário';
        clienteTelefone = null;
        origem = 'USUARIO';
      } else {
        const nomeKey = nomeAvulso.trim().toLowerCase();
        const telKey = telefoneAvulso.trim();
        clienteId = `AVULSO:${telKey}:${nomeKey}`;
        clienteNome = nomeAvulso || 'Avulso';
        clienteTelefone = telefoneAvulso || null;
        origem = 'AVULSO';
      }

      if (!byCliente.has(clienteId)) {
        byCliente.set(clienteId, {
          id: clienteId,
          nome: clienteNome,
          telefone: clienteTelefone,
          origem,
          agendamentos: [],
        });
      }

      const card = byCliente.get(clienteId)!;
      card.agendamentos.push({
        id: String(row.id),
        dataHora: normalizarDataHora(row.dataHora),
        duracao: Number(row.duracao || 0),
        status: String(row.status),
        observacoes: row.observacoes ? String(row.observacoes) : null,
        quadraNome: row.quadraNome ? String(row.quadraNome) : null,
        nomeAvulso: row.nomeAvulso ? String(row.nomeAvulso) : null,
        telefoneAvulso: row.telefoneAvulso ? String(row.telefoneAvulso) : null,
        ehAula: row.ehAula ?? null,
        professorNome: row.professorUsuarioName ? String(row.professorUsuarioName) : null,
      });
    }

    for (const card of byCliente.values()) {
      card.agendamentos.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
    }

    const clientes = Array.from(byCliente.values()).sort((a, b) => {
      const aFirst = a.agendamentos[0]?.dataHora ? new Date(a.agendamentos[0].dataHora).getTime() : Number.POSITIVE_INFINITY;
      const bFirst = b.agendamentos[0]?.dataHora ? new Date(b.agendamentos[0].dataHora).getTime() : Number.POSITIVE_INFINITY;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.nome.localeCompare(b.nome);
    });

    return NextResponse.json({
      arena: {
        id: String(point.id),
        nome: String(point.nome),
        logoUrl: point.logoUrl ?? null,
      },
      periodo: {
        dataInicio: toYMDUTC(range.start),
        dataFim: toYMDUTC(range.end),
      },
      clientes,
    });
  } catch (error: any) {
    return NextResponse.json({ mensagem: 'Erro ao gerar cards de agendamento', error: error?.message }, { status: 500 });
  }
}
