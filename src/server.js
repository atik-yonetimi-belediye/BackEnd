require("dotenv").config({ quiet: true });

const runMigrations = require("./scripts/migrateDatabase");
const pool = require("./config/db");
const { connectRedis, closeRedis } = require("./config/redis");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

const unsafeSecrets = new Set([
  "development-only-change-this-secret",
  "generate-a-long-random-secret-for-each-environment",
]);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET en az 32 karakter olmalıdır.");
}
if (
  process.env.NODE_ENV === "production" &&
  unsafeSecrets.has(process.env.JWT_SECRET)
) {
  throw new Error("Üretim ortamında örnek JWT_SECRET kullanılamaz.");
}

async function startServer() {
  await connectRedis();
  const app = require("./app");
  await runMigrations();
  const server = app.listen(PORT, () => {
    logger.info("server_started", { port: Number(PORT) });
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server_shutdown_started", { signal });
    const forceTimer = setTimeout(() => process.exit(1), 15000);
    forceTimer.unref();
    server.close(async (error) => {
      try {
        if (error) logger.error("http_server_close_error", { error });
        await Promise.allSettled([pool.end(), closeRedis()]);
        clearTimeout(forceTimer);
        logger.info("server_shutdown_complete", { signal });
        process.exit(error ? 1 : 0);
      } catch (closeError) {
        logger.error("server_shutdown_failed", { error: closeError });
        process.exit(1);
      }
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  logger.error("server_start_failed", { error });
  process.exit(1);
});
