// lib/cardService.ts - Serviço para geração de cards de partida
import { query } from './db';

export interface PartidaParaCard {
  id: string;
  data: Date;
  local: string;
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
 * Salva a URL do card gerado no banco de dados
 */
export async function salvarCardUrl(partidaId: string, cardUrl: string): Promise<void> {
  await query(
    `UPDATE "Partida" SET "cardUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [cardUrl, partidaId]
  );
  console.log('[cardService] URL do card salva no banco:', cardUrl.substring(0, 50) + '...');
}

