const fs = require("fs/promises");
const path = require("path");
const pool = require("../config/db");

const migrationsDir = path.join(__dirname, "..", "..", "migrations");

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const alreadyApplied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [filename]
    );

    if (alreadyApplied.rowCount > 0) continue;

    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [filename]
      );
      await client.query("COMMIT");
      console.log(`Migration uygulandı: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  runMigrations()
    .then(async () => {
      console.log("Migration işlemi tamamlandı.");
      await pool.end();
    })
    .catch(async (error) => {
      console.error("Migration işlemi başarısız:", error);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = runMigrations;
