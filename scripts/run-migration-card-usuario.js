// scripts/run-migration-card-usuario.js - Script para vincular CardCliente a Usuário
require('dotenv').config({ path: '.env.local' });
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
    const migrationPath = path.join(__dirname, '..', 'MIGRACAO_CARD_CLIENTE_USUARIO.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executando migração: Vincular CardCliente a Usuário...');
    
    // Executar a migração
    await pool.query(sql);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('\n📊 Verificando se a coluna foi adicionada...');
    
    // Verificar se a coluna existe
    const checkResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CardCliente'
      AND column_name = 'usuarioId'
    `);
    
    if (checkResult.rows.length > 0) {
      const col = checkResult.rows[0];
      console.log(`✅ Coluna "usuarioId" adicionada à tabela "CardCliente"!`);
      console.log(`   Tipo: ${col.data_type}, Nullable: ${col.is_nullable}`);
    } else {
      console.log('⚠️  Coluna "usuarioId" não encontrada após a migração.');
    }
    
    // Verificar índice
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'CardCliente' 
      AND indexname = 'idx_card_cliente_usuario'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('✅ Índice "idx_card_cliente_usuario" criado com sucesso!');
    } else {
      console.log('⚠️  Índice "idx_card_cliente_usuario" não encontrado.');
    }
    
    console.log('\n🎉 Migração concluída!');
    
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

