// scripts/run-migration-template.js - Executar migration de template de card
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
    console.log('🔄 Executando migration: Adicionar campo templateUrl na tabela Partida...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '..', 'MIGRACAO_CARD_TEMPLATE.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);
    
    console.log('✅ Migration executada com sucesso!');
    console.log('\n📊 Verificando se a coluna foi adicionada...');
    
    // Verificar se a coluna existe
    const checkResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Partida'
      AND column_name = 'templateUrl'
    `);
    
    if (checkResult.rows.length > 0) {
      const col = checkResult.rows[0];
      console.log(`✅ Coluna "templateUrl" adicionada à tabela "Partida"!`);
      console.log(`   Tipo: ${col.data_type}, Nullable: ${col.is_nullable}`);
    } else {
      console.log('⚠️  Coluna "templateUrl" não encontrada após a migração.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
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

