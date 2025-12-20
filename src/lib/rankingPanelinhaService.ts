// lib/rankingPanelinhaService.ts - Serviços para gerenciar ranking das panelinhas
import { query } from './db';

export interface RankingPanelinha {
  id: string;
  panelinhaId: string;
  atletaId: string;
  pontuacao: number;
  vitorias: number;
  derrotas: number;
  derrotasTieBreak: number;
  partidasJogadas: number;
  saldoGames: number;
  gamesFeitos: number;
  gamesSofridos: number;
  posicao: number | null;
  ultimaAtualizacao: Date;
  atleta?: {
    id: string;
    nome: string;
    fotoUrl?: string;
  };
}

/**
 * Calcula e atualiza o ranking de um atleta em uma panelinha após uma partida
 */
export async function atualizarRankingAposPartida(
  panelinhaId: string,
  partidaId: string
): Promise<void> {
  // Buscar a partida
  const partidaResult = await query(
    `SELECT 
      "atleta1Id", "atleta2Id", "atleta3Id", "atleta4Id",
      "gamesTime1", "gamesTime2", "tiebreakTime1", "tiebreakTime2"
    FROM "Partida"
    WHERE id = $1`,
    [partidaId]
  );

  if (partidaResult.rows.length === 0) {
    throw new Error('Partida não encontrada');
  }

  const partida = partidaResult.rows[0];
  
  // Verificar se teve tie break
  const teveTieBreak = partida.tiebreakTime1 !== null || partida.tiebreakTime2 !== null;
  
  // Determinar vencedor (time com mais games, ou time 1 se empate)
  const gamesTime1 = partida.gamesTime1 || 0;
  const gamesTime2 = partida.gamesTime2 || 0;
  const time1Venceu = gamesTime1 > gamesTime2;
  
  // Atletas do time 1
  const atletasTime1 = [partida.atleta1Id, partida.atleta3Id].filter(Boolean) as string[];
  // Atletas do time 2
  const atletasTime2 = [partida.atleta2Id, partida.atleta4Id].filter(Boolean) as string[];
  
  // Atualizar ranking para cada atleta
  for (const atletaId of atletasTime1) {
    await atualizarRankingAtleta(
      panelinhaId,
      atletaId,
      time1Venceu,
      teveTieBreak,
      gamesTime1,
      gamesTime2
    );
  }
  
  for (const atletaId of atletasTime2) {
    await atualizarRankingAtleta(
      panelinhaId,
      atletaId,
      !time1Venceu,
      teveTieBreak,
      gamesTime2,
      gamesTime1
    );
  }
  
  // Recalcular posições de todos os atletas da panelinha
  await recalcularPosicoesRanking(panelinhaId);
}

/**
 * Atualiza o ranking de um atleta específico após uma partida
 */
async function atualizarRankingAtleta(
  panelinhaId: string,
  atletaId: string,
  venceu: boolean,
  teveTieBreak: boolean,
  gamesFeitos: number,
  gamesSofridos: number
): Promise<void> {
  // Calcular pontos
  let pontosGanhos = 0;
  let vitoriasIncremento = 0;
  let derrotasIncremento = 0;
  let derrotasTieBreakIncremento = 0;
  
  if (venceu) {
    pontosGanhos = 3;
    vitoriasIncremento = 1;
  } else {
    if (teveTieBreak) {
      pontosGanhos = 1;
      derrotasTieBreakIncremento = 1;
    } else {
      pontosGanhos = 0;
    }
    derrotasIncremento = 1;
  }
  
  // Verificar se já existe ranking para este atleta nesta panelinha
  const rankingExistente = await query(
    `SELECT id FROM "RankingPanelinha" 
     WHERE "panelinhaId" = $1 AND "atletaId" = $2`,
    [panelinhaId, atletaId]
  );
  
  if (rankingExistente.rows.length === 0) {
    // Criar novo ranking
    await query(
      `INSERT INTO "RankingPanelinha" (
        id, "panelinhaId", "atletaId", "pontuacao", "vitorias", "derrotas", 
        "derrotasTieBreak", "partidasJogadas", "saldoGames", "gamesFeitos", 
        "gamesSofridos", "ultimaAtualizacao"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 1, $7, $8, $9, NOW()
      )`,
      [
        panelinhaId,
        atletaId,
        pontosGanhos,
        vitoriasIncremento,
        derrotasIncremento,
        derrotasTieBreakIncremento,
        gamesFeitos - gamesSofridos, // saldoGames
        gamesFeitos,
        gamesSofridos,
      ]
    );
  } else {
    // Atualizar ranking existente
    await query(
      `UPDATE "RankingPanelinha"
       SET 
         "pontuacao" = "pontuacao" + $1,
         "vitorias" = "vitorias" + $2,
         "derrotas" = "derrotas" + $3,
         "derrotasTieBreak" = "derrotasTieBreak" + $4,
         "partidasJogadas" = "partidasJogadas" + 1,
         "gamesFeitos" = "gamesFeitos" + $5,
         "gamesSofridos" = "gamesSofridos" + $6,
         "saldoGames" = "gamesFeitos" + $5 - ("gamesSofridos" + $6),
         "ultimaAtualizacao" = NOW()
       WHERE "panelinhaId" = $7 AND "atletaId" = $8`,
      [
        pontosGanhos,
        vitoriasIncremento,
        derrotasIncremento,
        derrotasTieBreakIncremento,
        gamesFeitos,
        gamesSofridos,
        panelinhaId,
        atletaId,
      ]
    );
  }
}

/**
 * Recalcula o ranking completo de uma panelinha do zero
 * Útil quando o placar de uma partida é atualizado
 */
export async function recalcularRankingCompleto(panelinhaId: string): Promise<void> {
  // Buscar todos os membros da panelinha
  const membrosResult = await query(
    `SELECT "atletaId" FROM "PanelinhaAtleta" WHERE "panelinhaId" = $1`,
    [panelinhaId]
  );

  // Zerar ou criar rankings para todos os membros
  for (const row of membrosResult.rows) {
    const rankingExistente = await query(
      `SELECT id FROM "RankingPanelinha" 
       WHERE "panelinhaId" = $1 AND "atletaId" = $2`,
      [panelinhaId, row.atletaId]
    );

    if (rankingExistente.rows.length === 0) {
      // Criar ranking zerado
      await query(
        `INSERT INTO "RankingPanelinha" (
          id, "panelinhaId", "atletaId", "pontuacao", "vitorias", "derrotas", 
          "derrotasTieBreak", "partidasJogadas", "saldoGames", "gamesFeitos", 
          "gamesSofridos", "ultimaAtualizacao"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, 0, 0, 0, 0, 0, 0, 0, 0, NOW()
        )`,
        [panelinhaId, row.atletaId]
      );
    } else {
      // Zerar ranking existente
      await query(
        `UPDATE "RankingPanelinha"
         SET 
           "pontuacao" = 0,
           "vitorias" = 0,
           "derrotas" = 0,
           "derrotasTieBreak" = 0,
           "partidasJogadas" = 0,
           "saldoGames" = 0,
           "gamesFeitos" = 0,
           "gamesSofridos" = 0,
           "ultimaAtualizacao" = NOW()
         WHERE "panelinhaId" = $1 AND "atletaId" = $2`,
        [panelinhaId, row.atletaId]
      );
    }
  }

  // Buscar todas as partidas da panelinha que têm placar
  const partidasResult = await query(
    `SELECT pp."partidaId"
     FROM "PartidaPanelinha" pp
     INNER JOIN "Partida" p ON pp."partidaId" = p.id
     WHERE pp."panelinhaId" = $1
       AND p."gamesTime1" IS NOT NULL
       AND p."gamesTime2" IS NOT NULL`,
    [panelinhaId]
  );

  // Processar cada partida (agora que os rankings estão zerados, podemos incrementar)
  for (const row of partidasResult.rows) {
    await atualizarRankingAposPartida(panelinhaId, row.partidaId);
  }
}

/**
 * Recalcula as posições de todos os atletas no ranking da panelinha
 */
export async function recalcularPosicoesRanking(panelinhaId: string): Promise<void> {
  // Buscar todos os rankings ordenados por pontuação e saldo
  const rankings = await query(
    `SELECT id, "atletaId", "pontuacao", "saldoGames", "gamesFeitos"
     FROM "RankingPanelinha"
     WHERE "panelinhaId" = $1
     ORDER BY "pontuacao" DESC, "saldoGames" DESC, "gamesFeitos" DESC`,
    [panelinhaId]
  );
  
  // Atualizar posições
  for (let i = 0; i < rankings.rows.length; i++) {
    await query(
      `UPDATE "RankingPanelinha"
       SET "posicao" = $1, "ultimaAtualizacao" = NOW()
       WHERE id = $2`,
      [i + 1, rankings.rows[i].id]
    );
  }
}

/**
 * Busca o ranking completo de uma panelinha
 */
export async function buscarRankingPanelinha(panelinhaId: string): Promise<RankingPanelinha[]> {
  const result = await query(
    `SELECT 
      r.id,
      r."panelinhaId",
      r."atletaId",
      r."pontuacao",
      r."vitorias",
      r."derrotas",
      r."derrotasTieBreak",
      r."partidasJogadas",
      r."saldoGames",
      r."gamesFeitos",
      r."gamesSofridos",
      r."posicao",
      r."ultimaAtualizacao",
      a.nome as "atletaNome",
      a."fotoUrl" as "atletaFotoUrl"
    FROM "RankingPanelinha" r
    INNER JOIN "Atleta" a ON r."atletaId" = a.id
    WHERE r."panelinhaId" = $1
    ORDER BY r."posicao" ASC NULLS LAST, r."pontuacao" DESC, r."saldoGames" DESC`,
    [panelinhaId]
  );
  
  return result.rows.map((row: any) => ({
    id: row.id,
    panelinhaId: row.panelinhaId,
    atletaId: row.atletaId,
    pontuacao: row.pontuacao,
    vitorias: row.vitorias,
    derrotas: row.derrotas,
    derrotasTieBreak: row.derrotasTieBreak,
    partidasJogadas: row.partidasJogadas,
    saldoGames: row.saldoGames,
    gamesFeitos: row.gamesFeitos,
    gamesSofridos: row.gamesSofridos,
    posicao: row.posicao,
    ultimaAtualizacao: row.ultimaAtualizacao,
    atleta: {
      id: row.atletaId,
      nome: row.atletaNome,
      fotoUrl: row.atletaFotoUrl,
    },
  }));
}

/**
 * Busca o ranking de um atleta específico em uma panelinha
 */
export async function buscarRankingAtleta(
  panelinhaId: string,
  atletaId: string
): Promise<RankingPanelinha | null> {
  const result = await query(
    `SELECT 
      r.*,
      a.nome as "atletaNome",
      a."fotoUrl" as "atletaFotoUrl"
    FROM "RankingPanelinha" r
    INNER JOIN "Atleta" a ON r."atletaId" = a.id
    WHERE r."panelinhaId" = $1 AND r."atletaId" = $2`,
    [panelinhaId, atletaId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    panelinhaId: row.panelinhaId,
    atletaId: row.atletaId,
    pontuacao: row.pontuacao,
    vitorias: row.vitorias,
    derrotas: row.derrotas,
    derrotasTieBreak: row.derrotasTieBreak,
    partidasJogadas: row.partidasJogadas,
    saldoGames: row.saldoGames,
    gamesFeitos: row.gamesFeitos,
    gamesSofridos: row.gamesSofridos,
    posicao: row.posicao,
    ultimaAtualizacao: row.ultimaAtualizacao,
    atleta: {
      id: row.atletaId,
      nome: row.atletaNome,
      fotoUrl: row.atletaFotoUrl,
    },
  };
}

