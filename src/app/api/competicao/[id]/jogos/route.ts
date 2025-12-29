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
      // As duplas são formadas dinamicamente - buscar atletas diretamente pelos IDs salvos no jogo
      
      // Debug: log dos IDs salvos no jogo
      console.log('[JOGOS] Buscando participantes do jogo:', {
        jogoId: row.id,
        rodada: row.rodada,
        numeroJogo: row.numeroJogo,
        atleta1ParceriaId: row.atleta1ParceriaId,
        atleta2ParceriaId: row.atleta2ParceriaId,
        atleta1Id: row.atleta1Id,
        atleta2Id: row.atleta2Id,
      });
      
      // Buscar dupla 1 - usar IDs diretamente do jogo (atleta1Id e atleta2Id armazenam os IDs dos atletas da primeira dupla)
      if (row.atleta1Id && row.atleta2Id) {
        // Buscar atletas diretamente pelos IDs
        const atleta1Result = await query(
          `SELECT id, nome FROM "Atleta" WHERE id = $1`,
          [row.atleta1Id]
        );
        const atleta2Result = await query(
          `SELECT id, nome FROM "Atleta" WHERE id = $1`,
          [row.atleta2Id]
        );
        
        if (atleta1Result.rows.length > 0 && atleta2Result.rows.length > 0) {
          const atleta1 = atleta1Result.rows[0];
          const atleta2 = atleta2Result.rows[0];
          
          jogo.participante1 = {
            parceriaId: row.atleta1ParceriaId,
            nome: `${atleta1.nome} & ${atleta2.nome}`,
            dupla: {
              atleta1: { id: atleta1.id, nome: atleta1.nome },
              atleta2: { id: atleta2.id, nome: atleta2.nome },
            },
          };
        }
      } else if (row.atleta1ParceriaId) {
        // Fallback: se ainda houver parceriaId mas não IDs diretos, tentar buscar na tabela (para jogos antigos)
        const dupla1Result = await query(
          `SELECT 
            ac."atletaId", 
            ac."parceiroAtletaId",
            a_atleta.id as "atleta_id", 
            a_atleta.nome as "atleta_nome",
            a_parceiro.id as "parceiro_id", 
            a_parceiro.nome as "parceiro_nome"
          FROM "AtletaCompeticao" ac
          LEFT JOIN "Atleta" a_atleta ON ac."atletaId" = a_atleta.id
          LEFT JOIN "Atleta" a_parceiro ON ac."parceiroAtletaId" = a_parceiro.id
          WHERE ac."parceriaId" = $1 
            AND ac."competicaoId" = $2
          ORDER BY ac."createdAt" ASC`,
          [row.atleta1ParceriaId, competicaoId]
        );
        
        if (dupla1Result.rows.length > 0) {
          // Coletar todos os atletas únicos dessa parceria
          const atletasDaDupla = new Map<string, { id: string; nome: string }>();
          
          dupla1Result.rows.forEach((r: any) => {
            if (r.atleta_id && r.atleta_nome) {
              atletasDaDupla.set(r.atleta_id, { id: r.atleta_id, nome: r.atleta_nome });
            }
            if (r.parceiro_id && r.parceiro_nome) {
              atletasDaDupla.set(r.parceiro_id, { id: r.parceiro_id, nome: r.parceiro_nome });
            }
            // Se não encontrou pelo JOIN, buscar diretamente
            if (r.atletaId && !atletasDaDupla.has(r.atletaId)) {
              // Vai buscar depois
            }
            if (r.parceiroAtletaId && !atletasDaDupla.has(r.parceiroAtletaId)) {
              // Vai buscar depois
            }
          });
          
          // Buscar atletas que não foram encontrados no JOIN
          for (const row of dupla1Result.rows) {
            if (row.atletaId && !atletasDaDupla.has(row.atletaId)) {
              const atletaResult = await query(`SELECT id, nome FROM "Atleta" WHERE id = $1`, [row.atletaId]);
              if (atletaResult.rows.length > 0) {
                atletasDaDupla.set(row.atletaId, {
                  id: atletaResult.rows[0].id,
                  nome: atletaResult.rows[0].nome,
                });
              }
            }
            if (row.parceiroAtletaId && !atletasDaDupla.has(row.parceiroAtletaId)) {
              const parceiroResult = await query(`SELECT id, nome FROM "Atleta" WHERE id = $1`, [row.parceiroAtletaId]);
              if (parceiroResult.rows.length > 0) {
                atletasDaDupla.set(row.parceiroAtletaId, {
                  id: parceiroResult.rows[0].id,
                  nome: parceiroResult.rows[0].nome,
                });
              }
            }
          }
          
          const atletasArray = Array.from(atletasDaDupla.values());
          console.log('[JOGOS] Dupla 1 encontrada:', {
            parceriaId: row.atleta1ParceriaId,
            quantidade: atletasArray.length,
            atletas: atletasArray.map(a => ({ id: a.id, nome: a.nome })),
            registrosEncontrados: dupla1Result.rows.length,
          });
          
          if (atletasArray.length === 2) {
            jogo.participante1 = {
              parceriaId: row.atleta1ParceriaId,
              nome: `${atletasArray[0].nome} & ${atletasArray[1].nome}`,
              dupla: {
                atleta1: { id: atletasArray[0].id, nome: atletasArray[0].nome },
                atleta2: { id: atletasArray[1].id, nome: atletasArray[1].nome },
              },
            };
          } else {
            console.log('[JOGOS] Dupla 1 - quantidade incorreta de atletas:', {
              parceriaId: row.atleta1ParceriaId,
              quantidade: atletasArray.length,
              atletas: atletasArray,
              registrosRaw: dupla1Result.rows,
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
        // Buscar registros da parceria - pegar ambos os atletas
        const dupla2Result = await query(
          `SELECT 
            ac."atletaId", 
            ac."parceiroAtletaId",
            a_atleta.id as "atleta_id", 
            a_atleta.nome as "atleta_nome",
            a_parceiro.id as "parceiro_id", 
            a_parceiro.nome as "parceiro_nome"
          FROM "AtletaCompeticao" ac
          LEFT JOIN "Atleta" a_atleta ON ac."atletaId" = a_atleta.id
          LEFT JOIN "Atleta" a_parceiro ON ac."parceiroAtletaId" = a_parceiro.id
          WHERE ac."parceriaId" = $1 
            AND ac."competicaoId" = $2
          ORDER BY ac."createdAt" ASC`,
          [row.atleta2ParceriaId, competicaoId]
        );
        
        if (dupla2Result.rows.length > 0) {
          // Coletar todos os atletas únicos dessa parceria
          const atletasDaDupla = new Map<string, { id: string; nome: string }>();
          
          dupla2Result.rows.forEach((r: any) => {
            if (r.atleta_id && r.atleta_nome) {
              atletasDaDupla.set(r.atleta_id, { id: r.atleta_id, nome: r.atleta_nome });
            }
            if (r.parceiro_id && r.parceiro_nome) {
              atletasDaDupla.set(r.parceiro_id, { id: r.parceiro_id, nome: r.parceiro_nome });
            }
          });
          
          // Buscar atletas que não foram encontrados no JOIN
          for (const row2 of dupla2Result.rows) {
            if (row2.atletaId && !atletasDaDupla.has(row2.atletaId)) {
              const atletaResult = await query(`SELECT id, nome FROM "Atleta" WHERE id = $1`, [row2.atletaId]);
              if (atletaResult.rows.length > 0) {
                atletasDaDupla.set(row2.atletaId, {
                  id: atletaResult.rows[0].id,
                  nome: atletaResult.rows[0].nome,
                });
              }
            }
            if (row2.parceiroAtletaId && !atletasDaDupla.has(row2.parceiroAtletaId)) {
              const parceiroResult = await query(`SELECT id, nome FROM "Atleta" WHERE id = $1`, [row2.parceiroAtletaId]);
              if (parceiroResult.rows.length > 0) {
                atletasDaDupla.set(row2.parceiroAtletaId, {
                  id: parceiroResult.rows[0].id,
                  nome: parceiroResult.rows[0].nome,
                });
              }
            }
          }
          
          const atletasArray = Array.from(atletasDaDupla.values());
          console.log('[JOGOS] Dupla 2 encontrada:', {
            parceriaId: row.atleta2ParceriaId,
            quantidade: atletasArray.length,
            atletas: atletasArray.map(a => ({ id: a.id, nome: a.nome })),
            registrosEncontrados: dupla2Result.rows.length,
          });
          
          if (atletasArray.length === 2) {
            jogo.participante2 = {
              parceriaId: row.atleta2ParceriaId,
              nome: `${atletasArray[0].nome} & ${atletasArray[1].nome}`,
              dupla: {
                atleta1: { id: atletasArray[0].id, nome: atletasArray[0].nome },
                atleta2: { id: atletasArray[1].id, nome: atletasArray[1].nome },
              },
            };
          } else {
            console.log('[JOGOS] Dupla 2 - quantidade incorreta de atletas:', {
              parceriaId: row.atleta2ParceriaId,
              quantidade: atletasArray.length,
              atletas: atletasArray,
              registrosRaw: dupla2Result.rows,
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
