// scripts/run-migration-pagamento-item.js - Executar migration de PagamentoItem
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'MIGRACAO_PAGAMENTO_ITEM.sql'),
      'utf8'
    );
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration executada com sucesso');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

