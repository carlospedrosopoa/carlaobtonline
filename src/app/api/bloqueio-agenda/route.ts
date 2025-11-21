// app/api/bloqueio-agenda/route.ts - Rotas de API para BloqueioAgenda (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest, usuarioTemAcessoAoPoint } from '@/lib/auth';
import type { CriarBloqueioAgendaPayload } from '@/types/agendamento';

// Converter hora "HH:mm" para minutos desde 00:00
function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// GET /api/bloqueio-agenda - Listar bloqueios com filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true';

    // Obter usuário autenticado
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Construir SQL base
    let sql = `SELECT 
      b.id, b."pointId", b."quadraIds", b.titulo, b.descricao,
      b."dataInicio", b."dataFim", b."horaInicio", b."horaFim",
      b.ativo, b."createdAt", b."updatedAt",
      p.id as "point_id", p.nome as "point_nome"
    FROM "BloqueioAgenda" b
    LEFT JOIN "Point" p ON b."pointId" = p.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, mostrar apenas bloqueios da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND b."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId && usuario.role === 'ADMIN') {
      // ADMIN pode filtrar por pointId se quiser
      sql += ` AND b."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    }

    if (dataInicio) {
      const [dataPart, horaPart] = dataInicio.split('T');
      const [ano, mes, dia] = dataPart.split('-').map(Number);
      const [hora, minuto, segundo] = (horaPart || '00:00:00').split(':').map(Number);
      const dataInicioLocal = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo || 0));
      
      sql += ` AND b."dataFim" >= $${paramCount}`;
      params.push(dataInicioLocal.toISOString());
      paramCount++;
    }

    if (dataFim) {
      const [dataPart, horaPart] = dataFim.split('T');
      const [ano, mes, dia] = dataPart.split('-').map(Number);
      const [hora, minuto, segundo] = (horaPart || '23:59:59').split(':').map(Number);
      const dataFimLocal = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo || 0));
      
      sql += ` AND b."dataInicio" <= $${paramCount}`;
      params.push(dataFimLocal.toISOString());
      paramCount++;
    }

    if (apenasAtivos) {
      sql += ` AND b.ativo = true`;
    }

    sql += ` ORDER BY b."dataInicio" ASC, b."createdAt" DESC`;

    const result = await query(sql, params);

    // Formatar resultado
    const bloqueios = result.rows.map((row) => {
      const bloqueio: any = {
        id: row.id,
        pointId: row.pointId,
        quadraIds: row.quadraIds, // JSONB já vem como array ou null
        titulo: row.titulo,
        descricao: row.descricao,
        dataInicio: row.dataInicio,
        dataFim: row.dataFim,
        horaInicio: row.horaInicio,
        horaFim: row.horaFim,
        ativo: row.ativo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

      if (row.point_id) {
        bloqueio.point = {
          id: row.point_id,
          nome: row.point_nome,
        };
      }

      return bloqueio;
    });

    return NextResponse.json(bloqueios);
  } catch (error: any) {
    console.error('Erro ao listar bloqueios:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar bloqueios', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/bloqueio-agenda - Criar novo bloqueio
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Apenas ADMIN e ORGANIZER podem criar bloqueios
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      return NextResponse.json(
        { mensagem: 'Sem permissão para criar bloqueios' },
        { status: 403 }
      );
    }

    const body: CriarBloqueioAgendaPayload = await request.json();

    // Validações
    if (!body.pointId || !body.titulo || !body.dataInicio || !body.dataFim) {
      return NextResponse.json(
        { mensagem: 'Campos obrigatórios: pointId, titulo, dataInicio, dataFim' },
        { status: 400 }
      );
    }

    // Verificar acesso ao point
    if (usuario.role === 'ORGANIZER') {
      if (usuario.pointIdGestor !== body.pointId) {
        return NextResponse.json(
          { mensagem: 'Sem permissão para criar bloqueio neste point' },
          { status: 403 }
        );
      }
    } else if (usuario.role === 'ADMIN') {
      const temAcesso = await usuarioTemAcessoAoPoint(usuario, body.pointId);
      if (!temAcesso) {
        return NextResponse.json(
          { mensagem: 'Sem permissão para criar bloqueio neste point' },
          { status: 403 }
        );
      }
    }

    // Converter datas para timestamp
    const dataInicio = new Date(body.dataInicio);
    const dataFim = new Date(body.dataFim);

    // Validar que dataInicio <= dataFim
    if (dataInicio > dataFim) {
      return NextResponse.json(
        { mensagem: 'dataInicio deve ser anterior ou igual a dataFim' },
        { status: 400 }
      );
    }

    // Converter horas para minutos (se fornecidas)
    let horaInicio: number | null = null;
    let horaFim: number | null = null;

    if (body.horaInicio) {
      horaInicio = horaParaMinutos(body.horaInicio);
    }
    if (body.horaFim) {
      horaFim = horaParaMinutos(body.horaFim);
    }

    // Validar que se horaInicio fornecida, horaFim também deve ser
    if ((horaInicio !== null && horaFim === null) || (horaInicio === null && horaFim !== null)) {
      return NextResponse.json(
        { mensagem: 'horaInicio e horaFim devem ser fornecidas juntas ou ambas null' },
        { status: 400 }
      );
    }

    if (horaInicio !== null && horaFim !== null && horaInicio >= horaFim) {
      return NextResponse.json(
        { mensagem: 'horaInicio deve ser anterior a horaFim' },
        { status: 400 }
      );
    }

    // Validar quadras (se fornecidas)
    if (body.quadraIds && body.quadraIds.length > 0) {
      // Verificar se as quadras pertencem ao point
      const quadrasCheck = await query(
        `SELECT id FROM "Quadra" WHERE id = ANY($1::text[]) AND "pointId" = $2`,
        [body.quadraIds, body.pointId]
      );

      if (quadrasCheck.rows.length !== body.quadraIds.length) {
        return NextResponse.json(
          { mensagem: 'Uma ou mais quadras não pertencem ao point especificado' },
          { status: 400 }
        );
      }
    }

    // Inserir bloqueio
    const result = await query(
      `INSERT INTO "BloqueioAgenda" 
        ("pointId", "quadraIds", titulo, descricao, "dataInicio", "dataFim", "horaInicio", "horaFim", ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *`,
      [
        body.pointId,
        body.quadraIds ? JSON.stringify(body.quadraIds) : null,
        body.titulo,
        body.descricao || null,
        dataInicio.toISOString(),
        dataFim.toISOString(),
        horaInicio,
        horaFim,
      ]
    );

    const bloqueio = result.rows[0];

    // Buscar dados relacionados
    const pointResult = await query(`SELECT id, nome FROM "Point" WHERE id = $1`, [body.pointId]);
    const point = pointResult.rows[0];

    const bloqueioCompleto = {
      id: bloqueio.id,
      pointId: bloqueio.pointId,
      quadraIds: bloqueio.quadraIds ? JSON.parse(bloqueio.quadraIds) : null,
      titulo: bloqueio.titulo,
      descricao: bloqueio.descricao,
      dataInicio: bloqueio.dataInicio,
      dataFim: bloqueio.dataFim,
      horaInicio: bloqueio.horaInicio,
      horaFim: bloqueio.horaFim,
      ativo: bloqueio.ativo,
      createdAt: bloqueio.createdAt,
      updatedAt: bloqueio.updatedAt,
      point: point ? { id: point.id, nome: point.nome } : null,
    };

    return NextResponse.json(bloqueioCompleto, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar bloqueio:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar bloqueio', error: error.message },
      { status: 500 }
    );
  }
}

