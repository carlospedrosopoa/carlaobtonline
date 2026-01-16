
const { query } = require('./src/lib/db');

async function investigarAgendamento() {
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
        a."nomeAvulso" ILIKE '%Jenara%' OR
        atl.nome ILIKE '%Jenara%' OR
        u.name ILIKE '%Jenara%'
      ORDER BY a."dataHora" DESC
      LIMIT 10;
    `;
    
    const result = await query(sql);
    
    if (result.rows.length === 0) {
      console.log('Nenhum agendamento encontrado para Jenara.');
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
    }
    
    // Se tiver recorrenciaId, vamos checar a tabela Recorrencia
    const agendamentoComRecorrencia = result.rows.find(r => r.recorrenciaId);
    if (agendamentoComRecorrencia) {
      console.log('\nVerificando tabela Recorrencia para ID:', agendamentoComRecorrencia.recorrenciaId);
      const recSql = `SELECT * FROM "Recorrencia" WHERE id = $1`;
      const recResult = await query(recSql, [agendamentoComRecorrencia.recorrenciaId]);
      console.log(recResult.rows[0]);
    }

  } catch (error) {
    console.error('Erro na investigação:', error);
  }
}

investigarAgendamento();
