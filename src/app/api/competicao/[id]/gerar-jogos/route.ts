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
  let competicaoId: string | undefined;
  try {
    const { id } = await params;
    competicaoId = id;
    
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

    // Buscar participantes (APENAS atletas individuais, sem parceriaId)
    const participantesResult = await query(
      `SELECT 
        ac.id, ac."competicaoId", ac."atletaId", ac."parceriaId", ac."parceiroAtletaId",
        a.id as "atleta_id", a.nome as "atleta_nome", a."fotoUrl" as "atleta_fotoUrl"
      FROM "AtletaCompeticao" ac
      LEFT JOIN "Atleta" a ON ac."atletaId" = a.id
      WHERE ac."competicaoId" = $1
        AND ac."parceriaId" IS NULL
      ORDER BY ac."createdAt" ASC`,
      [competicaoId]
    );

    const participantes: any[] = participantesResult.rows.map((row) => ({
      id: row.id,
      competicaoId: row.competicaoId,
      atletaId: row.atletaId,
      parceriaId: null, // Atletas individuais não têm parceriaId
      parceiroAtletaId: null, // Atletas individuais não têm parceiroAtletaId
      atleta: row.atleta_id ? {
        id: row.atleta_id,
        nome: row.atleta_nome,
        fotoUrl: row.atleta_fotoUrl || null,
      } : null,
      parceiro: null, // Atletas individuais não têm parceiro
    }));

    // Normalizar formato para garantir comparação correta
    const formatoNormalizado = (competicao.formato || '').toUpperCase().trim();
    
    console.log('[GERAR JOGOS] Formato original:', competicao.formato);
    console.log('[GERAR JOGOS] Formato normalizado:', formatoNormalizado);
    console.log('[GERAR JOGOS] Número de participantes:', participantes.length);
    console.log('[GERAR JOGOS] Participantes:', participantes.map(p => ({ atletaId: p.atletaId, nome: p.atleta?.nome })));

    // SEMPRE gerar jogos de duplas (round-robin)
    // Independente do formato (INDIVIDUAL ou DUPLAS), sempre formar duplas dinamicamente
    // onde cada atleta joga 7 jogos com parceiros diferentes
    
    // Verificar se temos exatamente 8 atletas únicos
    const atletasUnicos = new Set(participantes.filter(p => p.atletaId).map(p => p.atletaId));
    
    if (atletasUnicos.size !== 8) {
      const errorResponse = NextResponse.json(
        { mensagem: `Super 8 Round-Robin requer exatamente 8 atletas únicos, mas a competição tem ${atletasUnicos.size} (${participantes.length} registros). No formato Individual, as duplas serão formadas dinamicamente pelo sistema.` },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Gerar sorteio - SEMPRE usar round-robin de duplas
    // No formato INDIVIDUAL: atletas soltos, sistema forma duplas dinamicamente
    // No formato DUPLAS: mesmo processo (formar duplas dinamicamente)
    console.log('[GERAR JOGOS] Usando Round-Robin de Duplas (formato:', formatoNormalizado, ')');
    const jogosSorteados = gerarSorteioSuper8DuplasRoundRobin(participantes);
    const usarRoundRobin = true;

    console.log('[GERAR JOGOS] Jogos gerados:', jogosSorteados.length);

    // Inserir jogos no banco
    const jogosCriados: any[] = [];
    
    // Função auxiliar para criar parceriaId para uso nos jogos
    // IMPORTANTE: As parcerias só existem nos jogos, não modificamos AtletaCompeticao
    // Cada parceria recebe um UUID único que será usado apenas na tabela JogoCompeticao
    function criarParceriaId(): string {
      return randomUUID();
    }
    
    console.log('[GERAR JOGOS] Iniciando criação de', jogosSorteados.length, 'jogos');
    
    for (let index = 0; index < jogosSorteados.length; index++) {
      const jogo = jogosSorteados[index];
      try {
        console.log(`[GERAR JOGOS] Processando jogo ${index + 1}/${jogosSorteados.length}:`, {
          rodada: jogo.rodada,
          numeroJogo: jogo.numeroJogo,
          participante1Atletas: (jogo as any).participante1Atletas,
          participante2Atletas: (jogo as any).participante2Atletas,
        });
        // SEMPRE usar parcerias (jogos de duplas)
        // As duplas são formadas dinamicamente no round-robin
        let parceria1Id: string | null = null;
        let parceria2Id: string | null = null;
        let atleta1Id: string | null = null;
        let atleta2Id: string | null = null;
        let atleta3Id: string | null = null;
        let atleta4Id: string | null = null;

        if (usarRoundRobin && 'participante1Atletas' in jogo) {
          // Formato round-robin: criar parcerias apenas para uso nos jogos (não modifica AtletaCompeticao)
          const jogoRoundRobin = jogo as any;
          
          if (!jogoRoundRobin.participante1Atletas || jogoRoundRobin.participante1Atletas.length !== 2) {
            throw new Error(`Participante 1 não tem 2 atletas: ${JSON.stringify(jogoRoundRobin.participante1Atletas)}`);
          }
          
          if (!jogoRoundRobin.participante2Atletas || jogoRoundRobin.participante2Atletas.length !== 2) {
            throw new Error(`Participante 2 não tem 2 atletas: ${JSON.stringify(jogoRoundRobin.participante2Atletas)}`);
          }

          // Criar parcerias apenas como IDs para uso nos jogos (não modifica AtletaCompeticao)
          parceria1Id = criarParceriaId();
          parceria2Id = criarParceriaId();
          
          // Armazenar IDs dos atletas diretamente no jogo para facilitar busca
          atleta1Id = jogoRoundRobin.participante1Atletas[0];
          atleta2Id = jogoRoundRobin.participante1Atletas[1];
          atleta3Id = jogoRoundRobin.participante2Atletas[0];
          atleta4Id = jogoRoundRobin.participante2Atletas[1];
          
          console.log('[GERAR JOGOS] Parcerias criadas para o jogo:', {
            parceria1Id,
            parceria1Atletas: jogoRoundRobin.participante1Atletas,
            parceria2Id,
            parceria2Atletas: jogoRoundRobin.participante2Atletas,
          });
        } else {
          // Fallback (não deve acontecer, mas por segurança)
          parceria1Id = jogo.participante1.parceriaId || null;
          parceria2Id = jogo.participante2.parceriaId || null;
        }

        console.log(`[GERAR JOGOS] Criando jogo ${index + 1} no banco:`, {
          rodada: jogo.rodada,
          numeroJogo: jogo.numeroJogo,
          parceria1Id,
          parceria2Id,
        });

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

        console.log(`[GERAR JOGOS] ✅ Jogo ${index + 1} criado:`, {
          jogoId: result.rows[0].id,
          parceria1Id,
          parceria2Id,
        });

        jogosCriados.push({
          id: result.rows[0].id,
          rodada: jogo.rodada,
          numeroJogo: jogo.numeroJogo,
          participante1: jogo.participante1,
          participante2: jogo.participante2,
        });
      } catch (jogoError: any) {
        console.error(`[GERAR JOGOS] Erro ao processar jogo ${index + 1}/${jogosSorteados.length}:`, {
          rodada: jogo.rodada,
          numeroJogo: jogo.numeroJogo,
          error: jogoError.message,
          stack: jogoError.stack,
        });
        throw new Error(`Erro ao processar jogo ${jogo.numeroJogo} da rodada ${jogo.rodada}: ${jogoError.message}`);
      }
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
    console.error('[GERAR JOGOS] Erro geral ao gerar jogos:', {
      message: error?.message,
      stack: error?.stack,
      competicaoId,
    });
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao gerar jogos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

