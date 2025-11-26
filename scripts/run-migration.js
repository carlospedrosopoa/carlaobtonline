// scripts/run-migration.js - Script para executar migrações SQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    
    // Ler o arquivo de migração
    const migrationPath = path.join(__dirname, '..', 'MIGRACAO_ATLETA_ARENAS.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executando migração...');
    
    // Executar a migração
    await pool.query(sql);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('\n📊 Verificando se a tabela foi criada...');
    
    // Verificar se a tabela existe
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'AtletaPoint'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Tabela "AtletaPoint" criada com sucesso!');
    } else {
      console.log('⚠️  Tabela "AtletaPoint" não encontrada após a migração.');
    }
    
    // Verificar se a coluna pointIdPrincipal existe
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Atleta' 
      AND column_name = 'pointIdPrincipal'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Coluna "pointIdPrincipal" adicionada à tabela "Atleta"!');
    } else {
      console.log('⚠️  Coluna "pointIdPrincipal" não encontrada.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Verificar se DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está definida nas variáveis de ambiente.');
  console.error('   Certifique-se de ter um arquivo .env.local com DATABASE_URL configurada.');
  process.exit(1);
}

runMigration();

