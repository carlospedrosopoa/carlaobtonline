// lib/db.ts - Conexão PostgreSQL usando pg
import { Pool } from "pg";

// Singleton para reutilizar conexões (importante para serverless)
const globalForPool = globalThis as unknown as { pool?: Pool };

export const pool: Pool =
  globalForPool.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 1, // Serverless precisa de no máximo 1 conexão
    // Configurar timezone para UTC para garantir consistência
    // Isso garante que todas as datas sejam tratadas em UTC
    options: '-c timezone=UTC',
  });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;

// Helper para queries
// Garante que todas as queries sejam executadas com timezone UTC
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    // Usar pool.query que gerencia conexões automaticamente
    // O timezone UTC já está configurado no Pool via options
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log("Executed query", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

// Helper para normalizar dataHora para ISO string UTC
// Garante consistência entre localhost e produção
export function normalizarDataHora(dataHora: any): string {
  if (!dataHora) return dataHora;
  
  // Se já é string ISO com Z, retornar como está
  if (typeof dataHora === 'string' && dataHora.endsWith('Z')) {
    return dataHora;
  }
  
  // Converter para Date e depois para ISO string UTC
  const data = dataHora instanceof Date ? dataHora : new Date(dataHora);
  return data.toISOString();
}

// Helper para transações
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}



