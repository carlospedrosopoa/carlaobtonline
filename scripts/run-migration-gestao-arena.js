// scripts/run-migration-gestao-arena.js - Script para executar migração de gestão da arena
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
    const migrationPath = path.join(__dirname, '..', 'MIGRACAO_GESTAO_ARENA.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executando migração de gestão da arena...');
    
    // Executar a migração
    await pool.query(sql);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('\n📊 Verificando se as tabelas foram criadas...');
    
    // Verificar se as tabelas principais foram criadas
    const tabelas = [
      'CardCliente',
      'Produto',
      'ItemCard',
      'FormaPagamento',
      'PagamentoCard',
      'Fornecedor',
      'CategoriaSaida',
      'CentroCusto',
      'EntradaCaixa',
      'SaidaCaixa'
    ];
    
    for (const tabela of tabelas) {
      const checkResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [tabela]);
      
      if (checkResult.rows.length > 0) {
        console.log(`✅ Tabela "${tabela}" criada com sucesso!`);
      } else {
        console.log(`⚠️  Tabela "${tabela}" não encontrada após a migração.`);
      }
    }
    
    // Verificar função de próximo número de card
    const functionCheck = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'proximo_numero_card'
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log('✅ Função "proximo_numero_card" criada com sucesso!');
    } else {
      console.log('⚠️  Função "proximo_numero_card" não encontrada.');
    }
    
    console.log('\n🎉 Migração de gestão da arena concluída!');
    
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

