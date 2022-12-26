const path = require('path').resolve();
const { readFileSync, readdirSync } = require('fs');
const { Client } = require('pg');

const conn = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: process.env.DB_PORT ?? '5432',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
conn.connect();

function logSuccess(text) {
  console.log(`\x1b[32m${text}\x1b[0m`);
}
function logInfo(text) {
  console.log(`\x1b[33m${text}\x1b[0m`);
}
function logError(text) {
  console.log(`\x1b[31m${text}\x1b[0m`);
}

async function migrate() {
  try {
    await conn.query(
      'CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, batch INT NOT NULL)'
    );

    const migrated = (await conn.query('SELECT name, batch FROM migrations'))
      .rows;

    let batch = 0;
    if (migrated.length > 0) {
      batch = migrated.reduce((a, b) => (a.batch > b.batch ? a : b)).batch;
    }
    batch++;
    // logInfo(`Migrating batch number ${batch}`);

    const migrationNames = readdirSync(`${path}/migrations`);

    for (const migrationName of migrationNames) {
      if (migrated.some((e) => e.name === migrationName)) {
        logInfo(`${migrationName} already migrated`);
        continue;
      }
      const sql = readFileSync(
        `${path}/migrations/${migrationName}/up.sql`,
        'utf8'
      );
      logInfo(`Migrating ${migrationName}`);

      await conn.query(sql);
      await conn.query('INSERT INTO migrations (name, batch) VALUES ($1,$2)', [
        migrationName,
        batch,
      ]);
      logSuccess(`Migrated`);
    }
    logSuccess('Finished migrating');
  } catch (err) {
    logError(err.message ?? err);
  }

  await conn.end();
  process.exit();
}

async function rollback(refresh = false) {
  try {
    const migrated = (await conn.query('SELECT name, batch FROM migrations'))
      .rows;

    if (!migrated || migrated.length == 0) {
      logInfo('No migrations to revert');
      if (refresh) return 0;
      process.exit();
    }

    let batch = migrated.reduce((a, b) => (a.batch > b.batch ? a : b)).batch;
    logInfo(`Reverting batch number ${batch}`);

    const rollingMigrations = migrated
      .filter((e) => e.batch == batch)
      .sort((a, b) => b.id - a.id);

    for (const migration of rollingMigrations) {
      const sql = readFileSync(
        `${path}/migrations/${migration.name}/down.sql`,
        'utf8'
      );

      logInfo(`Rolling back ${migration.name}`);

      await conn.query(sql);
      await conn.query('DELETE FROM migrations WHERE name = ($1)', [
        migration.name,
      ]);
      logSuccess('Completed');
    }
    logSuccess('Finished reverting');

    if (refresh) return batch;
  } catch (err) {
    logError(err.message ?? err);
  }
  await conn.end();
  process.exit();
}

async function refresh() {
  let batch = await rollback(true);
  while (batch > 1) batch = await rollback(true);
  await migrate();
}

async function fresh() {
  try {
    logInfo('Dropping all tables');
    const tables = (
      await conn.query(
        `SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND 
        table_schema NOT IN ('pg_catalog', 'information_schema')`
      )
    ).rows;
    for (const table of tables) {
      const tableName = table.table_name;
      logInfo(`Dropping table ${tableName}`);
      await conn.query(`ALTER TABLE ${tableName} DISABLE TRIGGER ALL`);
      await conn.query(`DROP TABLE ${tableName}`);
      logSuccess('Completed');
    }
    logSuccess('Finished dropping tables');
    await migrate();
  } catch (err) {
    logError(err.message ?? err);
  }
  await conn.end();
  process.exit();
}

async function seed() {
  try {
    const seeders = ['init'];

    for (const seederName of seeders) {
      const sql = readFileSync(`${path}/seeders/${seederName}.sql`, 'utf8');
      logInfo(`Seeding ${seederName}`);

      const sqlArray = sql.split(';').filter((x) => x.length > 0);

      for (const sqlInsert of sqlArray) {
        await conn.query(sqlInsert);
      }
      logInfo('Completed');
    }
    logSuccess('Seeding completed');
  } catch (err) {
    logError(err.message ?? err);
  }

  await conn.end();
  process.exit();
}

module.exports = {
  migrate,
  rollback,
  refresh,
  fresh,
  seed,
};
