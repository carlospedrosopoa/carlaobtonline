// app/api/competicao/[id]/jogos/route.ts - Listar e excluir jogos da competição
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';

// GET /api/competicao/[id]/jogos - Listar jogos da competição
export async function GET(
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

    const { id: competicaoId } = await params;

    // Verificar se competição existe
    const competicaoCheck = await query(
      `SELECT "pointId", formato FROM "Competicao" WHERE id = $1`,
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

    // Buscar jogos
    const jogosResult = await query(
      `SELECT 
        j.id, j."competicaoId", j.rodada, j."numeroJogo",
        j."atleta1Id", j."atleta2Id", j."atleta1ParceriaId", j."atleta2ParceriaId",
        j."vencedorId", j."pontosAtleta1", j."pontosAtleta2",
        j."gamesAtleta1", j."gamesAtleta2", j."tiebreakAtleta1", j."tiebreakAtleta2",
        j."dataHora", j."quadraId", j.status, j.observacoes,
        j."createdAt", j."updatedAt",
        q.id as "quadra_id", q.nome as "quadra_nome"
      FROM "JogoCompeticao" j
      LEFT JOIN "Quadra" q ON j."quadraId" = q.id
      WHERE j."competicaoId" = $1
      ORDER BY 
        CASE j.rodada
          WHEN 'RODADA_1' THEN 1
          WHEN 'RODADA_2' THEN 2
          WHEN 'RODADA_3' THEN 3
          WHEN 'RODADA_4' THEN 4
          WHEN 'RODADA_5' THEN 5
          WHEN 'RODADA_6' THEN 6
          WHEN 'RODADA_7' THEN 7
          WHEN 'QUARTAS_FINAL' THEN 8
          WHEN 'SEMIFINAL' THEN 9
          WHEN 'FINAL' THEN 10
          ELSE 99
        END,
        j."numeroJogo" ASC`,
      [competicaoId]
    );

    const jogos = await Promise.all(jogosResult.rows.map(async (row) => {
      const jogo: any = {
        id: row.id,
        competicaoId: row.competicaoId,
        rodada: row.rodada,
        numeroJogo: row.numeroJogo,
        atleta1Id: row.atleta1Id || null,
        atleta2Id: row.atleta2Id || null,
        atleta1ParceriaId: row.atleta1ParceriaId || null,
        atleta2ParceriaId: row.atleta2ParceriaId || null,
        vencedorId: row.vencedorId || null,
        pontosAtleta1: row.pontosAtleta1 || null,
        pontosAtleta2: row.pontosAtleta2 || null,
        gamesAtleta1: row.gamesAtleta1 || null,
        gamesAtleta2: row.gamesAtleta2 || null,
        tiebreakAtleta1: row.tiebreakAtleta1 || null,
        tiebreakAtleta2: row.tiebreakAtleta2 || null,
        dataHora: row.dataHora ? new Date(row.dataHora).toISOString() : null,
        quadraId: row.quadraId || null,
        status: row.status,
        observacoes: row.observacoes || null,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        quadra: row.quadra_id ? {
          id: row.quadra_id,
          nome: row.quadra_nome,
        } : null,
      };

      // Buscar informações dos participantes
      // SEMPRE buscar como duplas, pois todos os jogos são de duplas (round-robin)
      
      // Buscar dupla 1
      if (row.atleta1ParceriaId) {
        // Buscar todos os registros dessa parceria
        const dupla1Result = await query(
          `SELECT ac."atletaId", ac."parceiroAtletaId",
           a1.id as "a1_id", a1.nome as "a1_nome",
           a2.id as "a2_id", a2.nome as "a2_nome"
          FROM "AtletaCompeticao" ac
          LEFT JOIN "Atleta" a1 ON ac."atletaId" = a1.id
          LEFT JOIN "Atleta" a2 ON ac."parceiroAtletaId" = a2.id
          WHERE ac."parceriaId" = $1 
            AND ac."competicaoId" = $2
            AND ac."parceriaId" IS NOT NULL
          ORDER BY ac."createdAt" ASC
          LIMIT 2`,
          [row.atleta1ParceriaId, competicaoId]
        );
        
        if (dupla1Result.rows.length >= 1) {
          const primeiro = dupla1Result.rows[0];
          let nomeAtleta1 = primeiro.a1_nome;
          let nomeAtleta2 = primeiro.a2_nome;
          let idAtleta1 = primeiro.a1_id;
          let idAtleta2 = primeiro.a2_id;
          
          // Se não encontrou o parceiro no primeiro registro, buscar no segundo
          if (!nomeAtleta2 && dupla1Result.rows.length > 1) {
            const segundo = dupla1Result.rows[1];
            nomeAtleta2 = segundo.a1_nome;
            idAtleta2 = segundo.a1_id;
          }
          
          // Se ainda não encontrou, buscar pelo parceiroAtletaId
          if (!nomeAtleta2 && primeiro.parceiroAtletaId) {
            const parceiroResult = await query(
              `SELECT id, nome FROM "Atleta" WHERE id = $1`,
              [primeiro.parceiroAtletaId]
            );
            if (parceiroResult.rows.length > 0) {
              nomeAtleta2 = parceiroResult.rows[0].nome;
              idAtleta2 = parceiroResult.rows[0].id;
            }
          }
          
          if (nomeAtleta1 && nomeAtleta2) {
            jogo.participante1 = {
              parceriaId: row.atleta1ParceriaId,
              nome: `${nomeAtleta1} & ${nomeAtleta2}`,
              dupla: {
                atleta1: { id: idAtleta1, nome: nomeAtleta1 },
                atleta2: { id: idAtleta2, nome: nomeAtleta2 },
              },
            };
          } else {
            console.log('[JOGOS] Dupla 1 - nomes faltando:', {
              parceriaId: row.atleta1ParceriaId,
              nomeAtleta1,
              nomeAtleta2,
              primeiro,
            });
          }
        } else {
          console.log('[JOGOS] Dupla 1 não encontrada:', {
            parceriaId: row.atleta1ParceriaId,
            competicaoId,
            jogoId: row.id,
            rodada: row.rodada,
          });
        }
      }

      // Buscar dupla 2
      if (row.atleta2ParceriaId) {
        // Buscar todos os registros dessa parceria
        const dupla2Result = await query(
          `SELECT ac."atletaId", ac."parceiroAtletaId",
           a1.id as "a1_id", a1.nome as "a1_nome",
           a2.id as "a2_id", a2.nome as "a2_nome"
          FROM "AtletaCompeticao" ac
          LEFT JOIN "Atleta" a1 ON ac."atletaId" = a1.id
          LEFT JOIN "Atleta" a2 ON ac."parceiroAtletaId" = a2.id
          WHERE ac."parceriaId" = $1 
            AND ac."competicaoId" = $2
            AND ac."parceriaId" IS NOT NULL
          ORDER BY ac."createdAt" ASC
          LIMIT 2`,
          [row.atleta2ParceriaId, competicaoId]
        );
        
        if (dupla2Result.rows.length >= 1) {
          const primeiro = dupla2Result.rows[0];
          let nomeAtleta1 = primeiro.a1_nome;
          let nomeAtleta2 = primeiro.a2_nome;
          let idAtleta1 = primeiro.a1_id;
          let idAtleta2 = primeiro.a2_id;
          
          // Se não encontrou o parceiro no primeiro registro, buscar no segundo
          if (!nomeAtleta2 && dupla2Result.rows.length > 1) {
            const segundo = dupla2Result.rows[1];
            nomeAtleta2 = segundo.a1_nome;
            idAtleta2 = segundo.a1_id;
          }
          
          // Se ainda não encontrou, buscar pelo parceiroAtletaId
          if (!nomeAtleta2 && primeiro.parceiroAtletaId) {
            const parceiroResult = await query(
              `SELECT id, nome FROM "Atleta" WHERE id = $1`,
              [primeiro.parceiroAtletaId]
            );
            if (parceiroResult.rows.length > 0) {
              nomeAtleta2 = parceiroResult.rows[0].nome;
              idAtleta2 = parceiroResult.rows[0].id;
            }
          }
          
          if (nomeAtleta1 && nomeAtleta2) {
            jogo.participante2 = {
              parceriaId: row.atleta2ParceriaId,
              nome: `${nomeAtleta1} & ${nomeAtleta2}`,
              dupla: {
                atleta1: { id: idAtleta1, nome: nomeAtleta1 },
                atleta2: { id: idAtleta2, nome: nomeAtleta2 },
              },
            };
          } else {
            console.log('[JOGOS] Dupla 2 - nomes faltando:', {
              parceriaId: row.atleta2ParceriaId,
              nomeAtleta1,
              nomeAtleta2,
              primeiro,
            });
          }
        } else {
          console.log('[JOGOS] Dupla 2 não encontrada:', {
            parceriaId: row.atleta2ParceriaId,
            competicaoId,
            jogoId: row.id,
            rodada: row.rodada,
          });
        }
      }
      
      // Fallback: se não encontrou por parceria, tentar buscar por atletaId (caso algum jogo antigo)
      if (!jogo.participante1 && row.atleta1Id) {
        const atleta1Result = await query(
          `SELECT id, nome FROM "Atleta" WHERE id = $1`,
          [row.atleta1Id]
        );
        if (atleta1Result.rows.length > 0) {
          jogo.participante1 = {
            atletaId: atleta1Result.rows[0].id,
            nome: atleta1Result.rows[0].nome,
          };
        }
      }

      if (!jogo.participante2 && row.atleta2Id) {
        const atleta2Result = await query(
          `SELECT id, nome FROM "Atleta" WHERE id = $1`,
          [row.atleta2Id]
        );
        if (atleta2Result.rows.length > 0) {
          jogo.participante2 = {
            atletaId: atleta2Result.rows[0].id,
            nome: atleta2Result.rows[0].nome,
          };
        }
      }

      return jogo;
    }));

    const response = NextResponse.json(jogos);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar jogos:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar jogos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/competicao/[id]/jogos - Excluir todos os jogos da competição
export async function DELETE(
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
      `SELECT "pointId", status FROM "Competicao" WHERE id = $1`,
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

    // Verificar se existem jogos
    const jogosCheck = await query(
      `SELECT COUNT(*) as total FROM "JogoCompeticao" WHERE "competicaoId" = $1`,
      [competicaoId]
    );

    const totalJogos = parseInt(jogosCheck.rows[0].total);
    
    if (totalJogos === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não há jogos para excluir' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Excluir todos os jogos
    await query(
      `DELETE FROM "JogoCompeticao" WHERE "competicaoId" = $1`,
      [competicaoId]
    );

    // Atualizar status da competição para CRIADA se estava EM_ANDAMENTO
    if (competicao.status === 'EM_ANDAMENTO') {
      await query(
        `UPDATE "Competicao" SET status = 'CRIADA', "updatedAt" = NOW() WHERE id = $1`,
        [competicaoId]
      );
    }

    const response = NextResponse.json({
      mensagem: `${totalJogos} jogo(s) excluído(s) com sucesso`,
      jogosExcluidos: totalJogos,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao excluir jogos:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao excluir jogos', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
