const { Pool } = require("pg");
require("dotenv").config({ quiet: true });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("error", (err) => {
  console.error("PostgreSQL bağlantı hatası:", err);
});

module.exports = pool;
