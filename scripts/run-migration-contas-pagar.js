require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    const migrationPath = path.join(__dirname, '..', 'MIGRACAO_CONTAS_PAGAR.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);

    const tabelas = ['ContaPagar', 'ContaPagarParcela', 'ContaPagarLiquidacao', 'ContaBancaria', 'MovimentacaoContaBancaria', 'TransferenciaFinanceira'];
    for (const tabela of tabelas) {
      const check = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tabela]
      );
      if (check.rows.length > 0) {
        console.log(`✅ ${tabela}`);
      } else {
        console.log(`⚠️ ${tabela} não encontrada`);
      }
    }
  } catch (error) {
    console.error('❌ Erro na migração de contas a pagar:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

runMigration();
