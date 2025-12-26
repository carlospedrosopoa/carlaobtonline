// app/api/competicao/[id]/gerar-jogos/route.ts - Gerar jogos da competição (sorteio)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { gerarSorteioSuper8, gerarSorteioSuper8DuplasRoundRobin } from '@/lib/sorteioCompeticao';
import { randomUUID } from 'crypto';

// POST /api/competicao/[id]/gerar-jogos - Gerar jogos da competição
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id: competicaoId } = await params;

    // Verificar se competição existe e se usuário tem acesso
    const competicaoCheck = await query(
      `SELECT "pointId", tipo, formato, status FROM "Competicao" WHERE id = $1`,
      [competicaoId]
    );

    if (competicaoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Competição não encontrada' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const competicao = competicaoCheck.rows[0];

    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== competicao.pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se já existem jogos gerados
    const jogosExistentes = await query(
      `SELECT COUNT(*) as total FROM "JogoCompeticao" WHERE "competicaoId" = $1`,
      [competicaoId]
    );

    if (parseInt(jogosExistentes.rows[0].total) > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Jogos já foram gerados para esta competição. Delete os jogos existentes antes de gerar novos.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar participantes
    const participantesResult = await query(
      `SELECT 
        ac.id, ac."competicaoId", ac."atletaId", ac."parceriaId", ac."parceiroAtletaId",
        a.id as "atleta_id", a.nome as "atleta_nome", a."fotoUrl" as "atleta_fotoUrl",
        p_atleta.id as "parceiro_id", p_atleta.nome as "parceiro_nome"
      FROM "AtletaCompeticao" ac
      LEFT JOIN "Atleta" a ON ac."atletaId" = a.id
      LEFT JOIN "Atleta" p_atleta ON ac."parceiroAtletaId" = p_atleta.id
      WHERE ac."competicaoId" = $1
      ORDER BY ac."createdAt" ASC`,
      [competicaoId]
    );

    const participantes: any[] = participantesResult.rows.map((row) => ({
      id: row.id,
      competicaoId: row.competicaoId,
      atletaId: row.atletaId,
      parceriaId: row.parceriaId || null,
      parceiroAtletaId: row.parceiroAtletaId || null,
      atleta: row.atleta_id ? {
        id: row.atleta_id,
        nome: row.atleta_nome,
        fotoUrl: row.atleta_fotoUrl || null,
      } : null,
      parceiro: row.parceiro_id ? {
        id: row.parceiro_id,
        nome: row.parceiro_nome,
      } : null,
    }));

    // Validar quantidade de participantes
    if (competicao.formato === 'INDIVIDUAL' && participantes.length !== 8) {
      const errorResponse = NextResponse.json(
        { mensagem: `Super 8 Individual requer exatamente 8 atletas, mas a competição tem ${participantes.length}` },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (competicao.formato === 'DUPLAS') {
      // Para duplas round-robin, verificar se temos exatamente 8 atletas
      const atletasUnicos = new Set(participantes.filter(p => p.atletaId).map(p => p.atletaId));
      if (atletasUnicos.size !== 8 || participantes.length !== 8) {
        const errorResponse = NextResponse.json(
          { mensagem: `Super 8 Duplas Round-Robin requer exatamente 8 atletas, mas a competição tem ${atletasUnicos.size} atletas únicos (${participantes.length} registros)` },
          { status: 400 }
        );
        return withCors(errorResponse, request);
      }
    }

    // Gerar sorteio
    let jogosSorteados: any[];
    let usarRoundRobin = false;

    if (competicao.formato === 'DUPLAS') {
      // Usar round-robin para duplas (cada atleta joga 7 jogos com parceiros diferentes)
      jogosSorteados = gerarSorteioSuper8DuplasRoundRobin(participantes);
      usarRoundRobin = true;
    } else {
      // Usar formato tradicional (quartas/semi/final) para individual
      jogosSorteados = gerarSorteioSuper8(participantes, competicao.formato);
    }

    // Inserir jogos no banco
    const jogosCriados: any[] = [];
    
    // Função auxiliar para criar ou obter parceriaId baseado nos atletas
    async function obterOuCriarParceria(atleta1Id: string, atleta2Id: string): Promise<string> {
      // Ordenar IDs para garantir consistência
      const idsOrdenados = [atleta1Id, atleta2Id].sort();
      const parceriaKey = idsOrdenados.join('-');
      
      // Verificar se já existe uma parceria com esses atletas nesta competição
      const parceriaExistente = await query(
        `SELECT DISTINCT "parceriaId" 
         FROM "AtletaCompeticao" 
         WHERE "competicaoId" = $1 
           AND "atletaId" = $2 
           AND "parceiroAtletaId" = $3
           AND "parceriaId" IS NOT NULL
         LIMIT 1`,
        [competicaoId, idsOrdenados[0], idsOrdenados[1]]
      );

      if (parceriaExistente.rows.length > 0 && parceriaExistente.rows[0].parceriaId) {
        return parceriaExistente.rows[0].parceriaId;
      }

      // Criar nova parceria (usar UUID)
      const novaParceriaId = randomUUID();

      // Garantir que ambos os atletas tenham registro na competição com essa parceria
      await query(
        `UPDATE "AtletaCompeticao" 
         SET "parceriaId" = $1, "parceiroAtletaId" = $2
         WHERE "competicaoId" = $3 AND "atletaId" = $4`,
        [novaParceriaId, idsOrdenados[1], competicaoId, idsOrdenados[0]]
      );

      await query(
        `UPDATE "AtletaCompeticao" 
         SET "parceriaId" = $1, "parceiroAtletaId" = $2
         WHERE "competicaoId" = $3 AND "atletaId" = $4`,
        [novaParceriaId, idsOrdenados[0], competicaoId, idsOrdenados[1]]
      );

      return novaParceriaId;
    }
    
    for (const jogo of jogosSorteados) {
      let atleta1Id: string | null = null;
      let atleta2Id: string | null = null;
      let parceria1Id: string | null = null;
      let parceria2Id: string | null = null;

      if (competicao.formato === 'INDIVIDUAL') {
        atleta1Id = jogo.participante1.atletaId || null;
        atleta2Id = jogo.participante2.atletaId || null;
      } else if (usarRoundRobin && 'participante1Atletas' in jogo) {
        // Formato round-robin: criar/obter parcerias dinamicamente
        const jogoRoundRobin = jogo as any;
        parceria1Id = await obterOuCriarParceria(
          jogoRoundRobin.participante1Atletas[0],
          jogoRoundRobin.participante1Atletas[1]
        );
        parceria2Id = await obterOuCriarParceria(
          jogoRoundRobin.participante2Atletas[0],
          jogoRoundRobin.participante2Atletas[1]
        );
      } else {
        // Formato tradicional de duplas
        parceria1Id = jogo.participante1.parceriaId || null;
        parceria2Id = jogo.participante2.parceriaId || null;
      }

      const result = await query(
        `INSERT INTO "JogoCompeticao" (
          id, "competicaoId", rodada, "numeroJogo",
          "atleta1Id", "atleta2Id", "atleta1ParceriaId", "atleta2ParceriaId",
          status, "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text, $1, $2, $3,
          $4, $5, $6, $7,
          'AGENDADO', NOW(), NOW()
        )
        RETURNING id`,
        [
          competicaoId,
          jogo.rodada,
          jogo.numeroJogo,
          atleta1Id,
          atleta2Id,
          parceria1Id,
          parceria2Id,
        ]
      );

      jogosCriados.push({
        id: result.rows[0].id,
        rodada: jogo.rodada,
        numeroJogo: jogo.numeroJogo,
        participante1: jogo.participante1,
        participante2: jogo.participante2,
      });
    }

    // Atualizar status da competição para EM_ANDAMENTO
    await query(
      `UPDATE "Competicao" SET status = 'EM_ANDAMENTO', "updatedAt" = NOW() WHERE id = $1`,
      [competicaoId]
    );

    const response = NextResponse.json({
      mensagem: `${jogosCriados.length} jogos gerados com sucesso`,
      jogos: jogosCriados,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao gerar jogos:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao gerar jogos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

