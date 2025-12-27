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
    
    // Função auxiliar para criar ou obter parceriaId baseado nos atletas
    // IMPORTANTE: No round-robin, cada atleta tem múltiplas parcerias diferentes
    // Então precisamos buscar/atualizar apenas registros que NÃO têm parceriaId ainda,
    // ou que têm exatamente esta parceria
    async function obterOuCriarParceria(atleta1Id: string, atleta2Id: string): Promise<string> {
      // Ordenar IDs para garantir consistência
      const idsOrdenados = [atleta1Id, atleta2Id].sort();
      
      // Verificar se já existe uma parceria com esses dois atletas específicos nesta competição
      const parceriaExistente = await query(
        `SELECT DISTINCT ac1."parceriaId"
         FROM "AtletaCompeticao" ac1
         INNER JOIN "AtletaCompeticao" ac2 ON ac1."parceriaId" = ac2."parceriaId"
         WHERE ac1."competicaoId" = $1
           AND ac2."competicaoId" = $1
           AND ac1."atletaId" = $2
           AND ac2."atletaId" = $3
           AND ac1."parceriaId" IS NOT NULL
           AND ac2."parceriaId" IS NOT NULL
         LIMIT 1`,
        [competicaoId, idsOrdenados[0], idsOrdenados[1]]
      );

      if (parceriaExistente.rows.length > 0 && parceriaExistente.rows[0].parceriaId) {
        console.log('[GERAR JOGOS] Parceria já existe:', {
          parceriaId: parceriaExistente.rows[0].parceriaId,
          atleta1: idsOrdenados[0],
          atleta2: idsOrdenados[1],
        });
        return parceriaExistente.rows[0].parceriaId;
      }

      // Criar nova parceria (usar UUID)
      const novaParceriaId = randomUUID();
      console.log('[GERAR JOGOS] Criando nova parceria:', {
        parceriaId: novaParceriaId,
        atleta1: idsOrdenados[0],
        atleta2: idsOrdenados[1],
      });

      // Buscar registros existentes para ambos os atletas que ainda não têm parceriaId
      // ou atualizar um registro existente que já tem essa parceria
      // Para round-robin, vamos atualizar qualquer registro do atleta que não tenha parceriaId ainda
      
      // Atleta 1: Buscar registro sem parceriaId OU criar novo se necessário
      const atleta1Check = await query(
        `SELECT id, "parceriaId" FROM "AtletaCompeticao" 
         WHERE "competicaoId" = $1 AND "atletaId" = $2
         ORDER BY CASE WHEN "parceriaId" IS NULL THEN 0 ELSE 1 END, "createdAt" ASC
         LIMIT 1`,
        [competicaoId, idsOrdenados[0]]
      );

      if (atleta1Check.rows.length === 0) {
        console.error('[GERAR JOGOS] Atleta 1 não encontrado na competição:', {
          atletaId: idsOrdenados[0],
          competicaoId,
        });
        throw new Error(`Atleta ${idsOrdenados[0]} não encontrado na competição ${competicaoId}`);
      }

      // Se o registro não tem parceriaId, atualizar. Se já tem, criar um novo registro
      const atleta1Registro = atleta1Check.rows[0];
      if (!atleta1Registro.parceriaId) {
        // Atualizar registro existente
        const result1 = await query(
          `UPDATE "AtletaCompeticao" 
           SET "parceriaId" = $1, "parceiroAtletaId" = $2, "updatedAt" = NOW()
           WHERE id = $3
           RETURNING id, "parceriaId", "parceiroAtletaId"`,
          [novaParceriaId, idsOrdenados[1], atleta1Registro.id]
        );
        
        console.log('[GERAR JOGOS] ✅ Atualizado registro atleta 1:', {
          registroId: result1.rows[0].id,
          atletaId: idsOrdenados[0],
          parceriaId: novaParceriaId,
          parceiroAtletaId: idsOrdenados[1],
        });
      } else {
        // Criar novo registro para esta parceria específica
        await query(
          `INSERT INTO "AtletaCompeticao" (
            id, "competicaoId", "atletaId", "parceriaId", "parceiroAtletaId", pontos, "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW(), NOW()
          )`,
          [competicaoId, idsOrdenados[0], novaParceriaId, idsOrdenados[1]]
        );
        console.log('[GERAR JOGOS] ✅ Criado novo registro para atleta 1:', {
          atletaId: idsOrdenados[0],
          parceriaId: novaParceriaId,
          parceiroAtletaId: idsOrdenados[1],
        });
      }

      // Atleta 2: Mesma lógica
      const atleta2Check = await query(
        `SELECT id, "parceriaId" FROM "AtletaCompeticao" 
         WHERE "competicaoId" = $1 AND "atletaId" = $2
         ORDER BY CASE WHEN "parceriaId" IS NULL THEN 0 ELSE 1 END, "createdAt" ASC
         LIMIT 1`,
        [competicaoId, idsOrdenados[1]]
      );

      if (atleta2Check.rows.length === 0) {
        console.error('[GERAR JOGOS] Atleta 2 não encontrado na competição:', {
          atletaId: idsOrdenados[1],
          competicaoId,
        });
        throw new Error(`Atleta ${idsOrdenados[1]} não encontrado na competição ${competicaoId}`);
      }

      const atleta2Registro = atleta2Check.rows[0];
      if (!atleta2Registro.parceriaId) {
        // Atualizar registro existente
        const result2 = await query(
          `UPDATE "AtletaCompeticao" 
           SET "parceriaId" = $1, "parceiroAtletaId" = $2, "updatedAt" = NOW()
           WHERE id = $3
           RETURNING id, "parceriaId", "parceiroAtletaId"`,
          [novaParceriaId, idsOrdenados[0], atleta2Registro.id]
        );
        
        console.log('[GERAR JOGOS] ✅ Atualizado registro atleta 2:', {
          registroId: result2.rows[0].id,
          atletaId: idsOrdenados[1],
          parceriaId: novaParceriaId,
          parceiroAtletaId: idsOrdenados[0],
        });
      } else {
        // Criar novo registro para esta parceria específica
        await query(
          `INSERT INTO "AtletaCompeticao" (
            id, "competicaoId", "atletaId", "parceriaId", "parceiroAtletaId", pontos, "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW(), NOW()
          )`,
          [competicaoId, idsOrdenados[1], novaParceriaId, idsOrdenados[0]]
        );
        console.log('[GERAR JOGOS] ✅ Criado novo registro para atleta 2:', {
          atletaId: idsOrdenados[1],
          parceriaId: novaParceriaId,
          parceiroAtletaId: idsOrdenados[0],
        });
      }

      // Verificar se a parceria foi criada corretamente
      const verificacao = await query(
        `SELECT COUNT(*) as total FROM "AtletaCompeticao"
         WHERE "parceriaId" = $1 AND "competicaoId" = $2`,
        [novaParceriaId, competicaoId]
      );
      
      const totalRegistros = parseInt(verificacao.rows[0].total);
      if (totalRegistros !== 2) {
        console.error('[GERAR JOGOS] ⚠️ Parceria criada mas com número incorreto de registros:', {
          parceriaId: novaParceriaId,
          totalRegistros,
          esperado: 2,
        });
        throw new Error(`Falha ao criar parceria: ${totalRegistros} registros encontrados ao invés de 2`);
      } else {
        console.log('[GERAR JOGOS] ✅ Parceria criada com sucesso:', {
          parceriaId: novaParceriaId,
          totalRegistros,
        });
      }

      return novaParceriaId;
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

        if (usarRoundRobin && 'participante1Atletas' in jogo) {
          // Formato round-robin: criar/obter parcerias dinamicamente
          const jogoRoundRobin = jogo as any;
          
          if (!jogoRoundRobin.participante1Atletas || jogoRoundRobin.participante1Atletas.length !== 2) {
            throw new Error(`Participante 1 não tem 2 atletas: ${JSON.stringify(jogoRoundRobin.participante1Atletas)}`);
          }
          
          if (!jogoRoundRobin.participante2Atletas || jogoRoundRobin.participante2Atletas.length !== 2) {
            throw new Error(`Participante 2 não tem 2 atletas: ${JSON.stringify(jogoRoundRobin.participante2Atletas)}`);
          }

          parceria1Id = await obterOuCriarParceria(
            jogoRoundRobin.participante1Atletas[0],
            jogoRoundRobin.participante1Atletas[1]
          );
          parceria2Id = await obterOuCriarParceria(
            jogoRoundRobin.participante2Atletas[0],
            jogoRoundRobin.participante2Atletas[1]
          );
        } else {
          // Fallback (não deve acontecer, mas por segurança)
          parceria1Id = jogo.participante1.parceriaId || null;
          parceria2Id = jogo.participante2.parceriaId || null;
        }

        // Sempre null para atleta1Id e atleta2Id (jogos são sempre de duplas)
        const atleta1Id: string | null = null;
        const atleta2Id: string | null = null;

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

        // Verificar se as parcerias ainda existem após criar o jogo
        const verificarParceria1 = await query(
          `SELECT COUNT(*) as total FROM "AtletaCompeticao" WHERE "parceriaId" = $1 AND "competicaoId" = $2`,
          [parceria1Id, competicaoId]
        );
        const verificarParceria2 = await query(
          `SELECT COUNT(*) as total FROM "AtletaCompeticao" WHERE "parceriaId" = $1 AND "competicaoId" = $2`,
          [parceria2Id, competicaoId]
        );

        console.log(`[GERAR JOGOS] ✅ Jogo ${index + 1} criado:`, {
          jogoId: result.rows[0].id,
          parceria1Id,
          parceria1Registros: parseInt(verificarParceria1.rows[0].total),
          parceria2Id,
          parceria2Registros: parseInt(verificarParceria2.rows[0].total),
        });

        jogosCriados.push({
          id: result.rows[0].id,
          rodada: jogo.rodada,
          numeroJogo: jogo.numeroJogo,
          participante1: jogo.participante1,
          participante2: jogo.participante2,
        });
      } catch (jogoError: any) {
        console.error(`[GERAR JOGOS] Erro ao processar jogo ${jogo.numeroJogo} da rodada ${jogo.rodada}:`, jogoError);
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

