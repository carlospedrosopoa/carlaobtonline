
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente manualmente do .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove aspas
      process.env[key] = value;
    }
  });
}

async function investigarAgendamento() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não encontrada.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('Buscando agendamentos de Jenara Dalpiaz...');
    
    // Buscar em Agendamento onde nomeAvulso é Jenara ou atleta/usuário tem esse nome
    const sql = `
      SELECT 
        a.id, 
        a."dataHora", 
        a."recorrenciaId", 
        a.status,
        a."nomeAvulso",
        atl.nome as "nomeAtleta",
        u.name as "nomeUsuario"
      FROM "Agendamento" a
      LEFT JOIN "Atleta" atl ON a."atletaId" = atl.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      WHERE 
        (a."nomeAvulso" ILIKE '%Jenara%' OR
        atl.nome ILIKE '%Jenara%' OR
        u.name ILIKE '%Jenara%')
        AND a."dataHora" >= NOW() - INTERVAL '7 days'
      ORDER BY a."dataHora" ASC
      LIMIT 10;
    `;
    
    const result = await pool.query(sql);
    
    if (result.rows.length === 0) {
      console.log('Nenhum agendamento encontrado para Jenara nos últimos/próximos dias.');
    } else {
      console.log('Agendamentos encontrados:');
      result.rows.forEach(row => {
        console.log('--------------------------------------------------');
        console.log(`ID: ${row.id}`);
        console.log(`Data/Hora: ${new Date(row.dataHora).toLocaleString()}`);
        console.log(`Recorrência ID: ${row.recorrenciaId}`);
        console.log(`Status: ${row.status}`);
        console.log(`Nome (Avulso/Atleta/User): ${row.nomeAvulso || row.nomeAtleta || row.nomeUsuario}`);
      });
      
      // Se encontrar algum sem recorrenciaId, mas que deveria ter, vamos investigar se existe algum padrão
      // Vou pegar o recorrenciaId do primeiro que tiver, para ver se os outros deveriam ter o mesmo
      const agendamentoComRecorrencia = result.rows.find(r => r.recorrenciaId);
      if (agendamentoComRecorrencia) {
        console.log('\nVerificando tabela Recorrencia para ID:', agendamentoComRecorrencia.recorrenciaId);
        const recSql = `SELECT * FROM "Recorrencia" WHERE id = $1`;
        const recResult = await pool.query(recSql, [agendamentoComRecorrencia.recorrenciaId]);
        console.log(recResult.rows[0]);
      }
    }

  } catch (error) {
    console.error('Erro na investigação:', error);
  } finally {
    await pool.end();
  }
}

investigarAgendamento();
