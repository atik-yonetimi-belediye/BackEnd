const fs = require("fs/promises");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
const pool = require("../config/db");
const logger = require("../utils/logger");

const migrationsDir = path.join(__dirname, "..", "..", "migrations");

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["atik-yonetimi-schema-migrations"]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const files = (await fs.readdir(migrationsDir)).filter((filename) => filename.endsWith(".sql")).sort();
    for (const filename of files) {
      const alreadyApplied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
      if (alreadyApplied.rowCount > 0) continue;
      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        logger.info("migration_applied", { filename });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["atik-yonetimi-schema-migrations"]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      logger.info("migrations_complete");
      await pool.end();
    })
    .catch(async (error) => {
      logger.error("migrations_failed", { error });
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = runMigrations;
