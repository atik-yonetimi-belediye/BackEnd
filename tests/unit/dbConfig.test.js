const test = require("node:test");
const assert = require("node:assert/strict");

test("PostgreSQL havuzu güvenli bağlantı ve sorgu zaman aşımlarına sahiptir", () => {
  const pool = require("../../src/config/db");
  assert.ok(pool.options.max > 0);
  assert.ok(pool.options.connectionTimeoutMillis > 0);
  assert.ok(pool.options.idleTimeoutMillis > 0);
  assert.ok(pool.options.statement_timeout > 0);
  assert.ok(pool.options.query_timeout >= pool.options.statement_timeout);
});
