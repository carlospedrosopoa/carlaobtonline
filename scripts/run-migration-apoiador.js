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
    const migrationPath = path.join(__dirname, '..', 'migrations', 'executadas', 'create_apoiador.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executando migração create_apoiador.sql...');
    
    // Executar a migração
    await pool.query(sql);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('\n📊 Verificando se a tabela foi criada...');
    
    // Verificar se a tabela existe
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'Apoiador'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Tabela "Apoiador" criada com sucesso!');
    } else {
      console.log('⚠️  Tabela "Apoiador" não encontrada após a migração.');
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
  console.log('⚠️ DATABASE_URL não definida. Tentando carregar de .env.local...');
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.local' });
  } catch (e) {
    console.log('⚠️ Não foi possível carregar dotenv');
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está definida nas variáveis de ambiente.');
  process.exit(1);
}

runMigration();
