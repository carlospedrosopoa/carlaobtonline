// lib/partidaService.ts - Serviços de partida
import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function criarPartida(dados: {
  data: string;
  local: string;
  atleta1Id: string;
  atleta2Id: string;
  atleta3Id?: string | null;
  atleta4Id?: string | null;
  gamesTime1?: number | null;
  gamesTime2?: number | null;
  tiebreakTime1?: number | null;
  tiebreakTime2?: number | null;
}) {
  // Valida que os atletas existem
  const atletasIds = [dados.atleta1Id, dados.atleta2Id, dados.atleta3Id, dados.atleta4Id].filter(Boolean) as string[];
  
  for (const id of atletasIds) {
    const result = await query('SELECT id FROM "Atleta" WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new Error(`Atleta com id ${id} não encontrado`);
    }
  }

  const partidaId = uuidv4();
  await query(
    `INSERT INTO "Partida" (id, data, local, "atleta1Id", "atleta2Id", "atleta3Id", "atleta4Id", "gamesTime1", "gamesTime2", "tiebreakTime1", "tiebreakTime2", "createdAt") 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
    [
      partidaId,
      new Date(dados.data),
      dados.local,
      dados.atleta1Id,
      dados.atleta2Id,
      dados.atleta3Id || null,
      dados.atleta4Id || null,
      dados.gamesTime1 || null,
      dados.gamesTime2 || null,
      dados.tiebreakTime1 || null,
      dados.tiebreakTime2 || null,
    ]
  );
  
  const result = await query(
    `SELECT p.*, 
     a1.nome as "atleta1Nome", a1.id as "atleta1Id", 
     a2.nome as "atleta2Nome", a2.id as "atleta2Id",
     a3.nome as "atleta3Nome", a3.id as "atleta3Id", 
     a4.nome as "atleta4Nome", a4.id as "atleta4Id"
     FROM "Partida" p
     LEFT JOIN "Atleta" a1 ON p."atleta1Id" = a1.id
     LEFT JOIN "Atleta" a2 ON p."atleta2Id" = a2.id
     LEFT JOIN "Atleta" a3 ON p."atleta3Id" = a3.id
     LEFT JOIN "Atleta" a4 ON p."atleta4Id" = a4.id
     WHERE p.id = $1`,
    [partidaId]
  );
  
  const partida = result.rows[0];
  
  return {
    ...partida,
    atleta1: partida.atleta1Nome ? { id: partida.atleta1Id, nome: partida.atleta1Nome } : null,
    atleta2: partida.atleta2Nome ? { id: partida.atleta2Id, nome: partida.atleta2Nome } : null,
    atleta3: partida.atleta3Nome ? { id: partida.atleta3Id, nome: partida.atleta3Nome } : null,
    atleta4: partida.atleta4Nome ? { id: partida.atleta4Id, nome: partida.atleta4Nome } : null,
  };
}

export async function listarPartidas() {
  const result = await query(
    `SELECT p.*, 
     a1.nome as "atleta1Nome", a1.id as "atleta1Id", 
     a2.nome as "atleta2Nome", a2.id as "atleta2Id",
     a3.nome as "atleta3Nome", a3.id as "atleta3Id", 
     a4.nome as "atleta4Nome", a4.id as "atleta4Id"
     FROM "Partida" p
     LEFT JOIN "Atleta" a1 ON p."atleta1Id" = a1.id
     LEFT JOIN "Atleta" a2 ON p."atleta2Id" = a2.id
     LEFT JOIN "Atleta" a3 ON p."atleta3Id" = a3.id
     LEFT JOIN "Atleta" a4 ON p."atleta4Id" = a4.id
     ORDER BY p."createdAt" DESC`,
    []
  );
  
  const partidas = result.rows.map((row: any) => ({
    ...row,
    atleta1: row.atleta1Nome ? { id: row.atleta1Id, nome: row.atleta1Nome } : null,
    atleta2: row.atleta2Nome ? { id: row.atleta2Id, nome: row.atleta2Nome } : null,
    atleta3: row.atleta3Nome ? { id: row.atleta3Id, nome: row.atleta3Nome } : null,
    atleta4: row.atleta4Nome ? { id: row.atleta4Id, nome: row.atleta4Nome } : null,
  }));

  return partidas;
}

export async function atualizarPlacar(partidaId: string, placar: {
  gamesTime1: number | null;
  gamesTime2: number | null;
  tiebreakTime1?: number | null;
  tiebreakTime2?: number | null;
}) {
  await query(
    `UPDATE "Partida" 
     SET "gamesTime1" = $1, "gamesTime2" = $2, "tiebreakTime1" = $3, "tiebreakTime2" = $4
     WHERE id = $5`,
    [
      placar.gamesTime1,
      placar.gamesTime2,
      placar.tiebreakTime1 || null,
      placar.tiebreakTime2 || null,
      partidaId,
    ]
  );
  
  const result = await query('SELECT * FROM "Partida" WHERE id = $1', [partidaId]);
  return result.rows[0];
}

