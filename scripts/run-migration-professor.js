// scripts/run-migration-professor.js
// Script para executar a migration do módulo de professores
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Verificar se DATABASE_URL está definida
  if (!process.env.DATABASE_URL) {
    console.error('❌ Erro: DATABASE_URL não está definida nas variáveis de ambiente.');
    console.error('   Certifique-se de ter um arquivo .env.local com DATABASE_URL configurada.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') 
      ? false 
      : { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('🔌 Conectando ao banco de dados...');
    console.log('📦 Executando migration do módulo de professores...\n');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/create_modulo_professor.sql'),
      'utf8'
    );
    
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration executada com sucesso!');
    console.log('\n📊 Verificando tabelas criadas...');
    
    // Verificar se as tabelas foram criadas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Professor', 'Aula', 'AlunoAula', 'AlunoProfessor', 'AvaliacaoAluno')
      ORDER BY table_name
    `);
    
    console.log('\n✅ Tabelas criadas:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Verificar enums
    const enumsResult = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('TipoAula', 'NivelAula', 'StatusAula', 'StatusInscricao')
      ORDER BY typname
    `);
    
    console.log('\n✅ Enums criados:');
    enumsResult.rows.forEach(row => {
      console.log(`   - ${row.typname}`);
    });
    
    // Verificar role PROFESSOR
    const roleResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
      AND enumlabel = 'PROFESSOR'
    `);
    
    if (roleResult.rows.length > 0) {
      console.log('\n✅ Role PROFESSOR adicionado ao enum Role');
    } else {
      console.log('\n⚠️  Role PROFESSOR não encontrado (pode já existir ou ter erro)');
    }
    
    console.log('\n🎉 Módulo de professores criado com sucesso!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro ao executar migration:', error.message);
    console.error('\nStack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Falha na execução:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };

// Executar se chamado diretamente
if (require.main === module) {
  runMigration();
}

