const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "unit-test-secret-at-least-thirty-two-characters";
process.env.JWT_EXPIRES_IN = "1h";

const { generateToken, verifyToken } = require("../../src/utils/jwt");

test("JWT beklenen issuer, audience ve algoritma ile doğrulanır", () => {
  const token = generateToken({ id: 7, role: "admin" });
  const decoded = verifyToken(token);

  assert.equal(decoded.id, 7);
  assert.equal(decoded.role, "admin");
  assert.equal(decoded.iss, "atik-yonetimi-api");
  assert.equal(decoded.aud, "atik-yonetimi-clients");
});
