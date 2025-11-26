// scripts/run-migration-card-url.js - Script para executar a migração do cardUrl
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') }); // Carrega .env.local

async function runMigrationCardUrl() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Conectando ao banco de dados para migração de cardUrl...');
    
    const migrationPath = path.join(__dirname, '..', 'MIGRACAO_CARD_URL.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executando migração de cardUrl...');
    
    await pool.query(sql);
    
    console.log('✅ Migração de cardUrl executada com sucesso!');
    
    // Verificar se a coluna cardUrl existe
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Partida' 
      AND column_name = 'cardUrl'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Coluna "cardUrl" adicionada à tabela "Partida"!');
    } else {
      console.log('⚠️  Coluna "cardUrl" não encontrada após a migração.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar migração de cardUrl:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está definida nas variáveis de ambiente.');
  console.error('   Certifique-se de ter um arquivo .env.local com DATABASE_URL configurada.');
  process.exit(1);
}

runMigrationCardUrl();

