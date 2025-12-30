// lib/cardService.ts - Serviço para geração de cards de partida
import { query } from './db';

export interface PartidaParaCard {
  id: string;
  data: Date;
  local: string;
  pointId: string | null; // ID da arena (Point) onde a partida foi realizada
  gamesTime1: number | null;
  gamesTime2: number | null;
  tiebreakTime1: number | null;
  tiebreakTime2: number | null;
  templateUrl: string | null; // URL do template usado para esta partida
  atleta1: {
    id: string;
    nome: string;
    fotoUrl: string | null;
  } | null;
  atleta2: {
    id: string;
    nome: string;
    fotoUrl: string | null;
  } | null;
  atleta3: {
    id: string;
    nome: string;
    fotoUrl: string | null;
  } | null;
  atleta4: {
    id: string;
    nome: string;
    fotoUrl: string | null;
  } | null;
}

/**
 * Busca dados completos da partida para geração de card
 */
export async function buscarPartidaParaCard(partidaId: string): Promise<PartidaParaCard | null> {
  const result = await query(
    `SELECT 
      p.id,
      p.data,
      p.local,
      p."pointId",
      p."gamesTime1",
      p."gamesTime2",
      p."tiebreakTime1",
      p."tiebreakTime2",
      p."templateUrl",
      a1.id as "atleta1Id",
      a1.nome as "atleta1Nome",
      a1."fotoUrl" as "atleta1FotoUrl",
      a2.id as "atleta2Id",
      a2.nome as "atleta2Nome",
      a2."fotoUrl" as "atleta2FotoUrl",
      a3.id as "atleta3Id",
      a3.nome as "atleta3Nome",
      a3."fotoUrl" as "atleta3FotoUrl",
      a4.id as "atleta4Id",
      a4.nome as "atleta4Nome",
      a4."fotoUrl" as "atleta4FotoUrl"
    FROM "Partida" p
    LEFT JOIN "Atleta" a1 ON p."atleta1Id" = a1.id
    LEFT JOIN "Atleta" a2 ON p."atleta2Id" = a2.id
    LEFT JOIN "Atleta" a3 ON p."atleta3Id" = a3.id
    LEFT JOIN "Atleta" a4 ON p."atleta4Id" = a4.id
    WHERE p.id = $1`,
    [partidaId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    data: row.data,
    local: row.local,
    pointId: row.pointId || null,
    gamesTime1: row.gamesTime1,
    gamesTime2: row.gamesTime2,
    tiebreakTime1: row.tiebreakTime1,
    tiebreakTime2: row.tiebreakTime2,
    templateUrl: row.templateUrl || null,
    atleta1: row.atleta1Id ? {
      id: row.atleta1Id,
      nome: row.atleta1Nome,
      fotoUrl: row.atleta1FotoUrl,
    } : null,
    atleta2: row.atleta2Id ? {
      id: row.atleta2Id,
      nome: row.atleta2Nome,
      fotoUrl: row.atleta2FotoUrl,
    } : null,
    atleta3: row.atleta3Id ? {
      id: row.atleta3Id,
      nome: row.atleta3Nome,
      fotoUrl: row.atleta3FotoUrl,
    } : null,
    atleta4: row.atleta4Id ? {
      id: row.atleta4Id,
      nome: row.atleta4Nome,
      fotoUrl: row.atleta4FotoUrl,
    } : null,
  };
}

/**
 * Salva a URL do template usado para gerar o card da partida
 */
export async function salvarTemplatePartida(partidaId: string, templateUrl: string): Promise<void> {
  await query(
    `UPDATE "Partida" SET "templateUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [templateUrl, partidaId]
  );
}

/**
 * Obtém o template padrão atual (da variável de ambiente ou null)
 */
export function obterTemplatePadrao(): string | null {
  const templateUrl = process.env.CARD_DEFAULT_TEMPLATE_URL || null;
  console.log('[cardService] Template padrão obtido:', templateUrl ? templateUrl.substring(0, 50) + '...' : 'null');
  console.log('[cardService] CARD_DEFAULT_TEMPLATE_URL definida?', !!process.env.CARD_DEFAULT_TEMPLATE_URL);
  return templateUrl;
}

/**
 * Busca o template de card da arena pelo pointId
 */
export async function obterTemplateArenaPorPointId(pointId: string | null): Promise<string | null> {
  if (!pointId) {
    return null;
  }

  try {
    const result = await query(
      `SELECT "cardTemplateUrl" FROM "Point" 
       WHERE id = $1
       AND "cardTemplateUrl" IS NOT NULL
       AND ativo = true
       LIMIT 1`,
      [pointId]
    );

    if (result.rows.length > 0 && result.rows[0].cardTemplateUrl) {
      const templateUrl = result.rows[0].cardTemplateUrl;
      console.log('[cardService] Template da arena encontrado:', templateUrl.substring(0, 50) + '...');
      return templateUrl;
    }

    console.log('[cardService] Nenhum template de arena encontrado para pointId:', pointId);
    return null;
  } catch (error: any) {
    console.error('[cardService] Erro ao buscar template da arena:', error.message);
    return null;
  }
}

/**
 * Salva a URL do card gerado no banco de dados
 */
export async function salvarCardUrl(partidaId: string, cardUrl: string): Promise<void> {
  await query(
    `UPDATE "Partida" SET "cardUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [cardUrl, partidaId]
  );
  console.log('[cardService] URL do card salva no banco:', cardUrl.substring(0, 50) + '...');
}

// ========== CARDS DE COMPETIÇÃO ==========

export interface CompeticaoParaCard {
  id: string;
  nome: string;
  cardDivulgacaoUrl: string | null; // URL do template de divulgação
  logoArenaUrl: string | null; // URL do logo da arena (Point)
  atletas: Array<{
    id: string;
    nome: string;
    fotoUrl: string | null;
  }>;
}

/**
 * Busca dados completos da competição para geração de card
 */
export async function buscarCompeticaoParaCard(competicaoId: string): Promise<CompeticaoParaCard | null> {
  const result = await query(
    `SELECT 
      c.id,
      c.nome,
      c."cardDivulgacaoUrl",
      c."pointId",
      p."logoUrl" as "point_logoUrl"
    FROM "Competicao" c
    LEFT JOIN "Point" p ON c."pointId" = p.id
    WHERE c.id = $1`,
    [competicaoId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Buscar atletas participantes (apenas individuais, sem parceriaId)
  const atletasResult = await query(
    `SELECT DISTINCT ON (ac."atletaId")
      ac."atletaId",
      a.nome as "atleta_nome",
      a."fotoUrl" as "atleta_fotoUrl"
    FROM "AtletaCompeticao" ac
    LEFT JOIN "Atleta" a ON ac."atletaId" = a.id
    WHERE ac."competicaoId" = $1
      AND ac."parceriaId" IS NULL
    ORDER BY ac."atletaId", ac."createdAt" ASC
    LIMIT 8`,
    [competicaoId]
  );

  const atletas = atletasResult.rows.map((atletaRow) => ({
    id: atletaRow.atletaId,
    nome: atletaRow.atleta_nome,
    fotoUrl: atletaRow.atleta_fotoUrl,
  }));

  return {
    id: row.id,
    nome: row.nome,
    cardDivulgacaoUrl: row.cardDivulgacaoUrl || null,
    logoArenaUrl: row.point_logoUrl || null,
    atletas,
  };
}

/**
 * Salva a URL do card gerado no banco de dados da competição
 */
export async function salvarCardUrlCompeticao(competicaoId: string, cardUrl: string): Promise<void> {
  // Nota: Pode ser necessário adicionar campo cardUrl na tabela Competicao se ainda não existir
  await query(
    `UPDATE "Competicao" SET "cardUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [cardUrl, competicaoId]
  ).catch(async (error: any) => {
    // Se o campo não existir, tentar adicionar (apenas em desenvolvimento)
    if (error.message?.includes('cardUrl') || error.code === '42703') {
      console.warn('[cardService] Campo cardUrl não existe na tabela Competicao, ignorando...');
    } else {
      throw error;
    }
  });
  console.log('[cardService] URL do card da competição salva no banco:', cardUrl.substring(0, 50) + '...');
}

