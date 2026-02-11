const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', 'executadas', 'add_atleta_face_descriptor_vector.sql'),
      'utf8'
    );
    await pool.query(sql);

    const migrateSql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', 'executadas', 'migrate_atleta_faceEmbedding_to_vector.sql'),
      'utf8'
    );
    await pool.query(migrateSql);

    const check = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'Atleta'
        AND column_name IN ('faceDescriptor', 'faceDescriptorModelVersion')
      ORDER BY column_name
    `);
    console.log(check.rows);
    process.exit(0);
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

runMigration();

