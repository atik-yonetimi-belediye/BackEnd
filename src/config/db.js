const { Pool } = require("pg");
const logger = require("../utils/logger");
require("dotenv").config({ quiet: true });

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} pozitif tam sayı olmalıdır.`);
  return value;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: readPositiveInteger("DB_POOL_MAX", 10),
  min: Number(process.env.DB_POOL_MIN || 0),
  connectionTimeoutMillis: readPositiveInteger("DB_CONNECT_TIMEOUT_MS", 5000),
  idleTimeoutMillis: readPositiveInteger("DB_IDLE_TIMEOUT_MS", 30000),
  statement_timeout: readPositiveInteger("DB_STATEMENT_TIMEOUT_MS", 15000),
  query_timeout: readPositiveInteger("DB_QUERY_TIMEOUT_MS", 20000),
  application_name: "atik-yonetimi-api",
});

pool.on("error", (err) => {
  logger.error("postgres_pool_error", { error: err });
});

module.exports = pool;
