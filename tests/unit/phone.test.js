const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePhone } = require("../../src/utils/phone");

test("543 ile veya başında 0 ile girilen telefonu tek biçime dönüştürür", () => {
  assert.equal(normalizePhone("+90 543 222 33 44"), "05432223344");
  assert.equal(normalizePhone("90 (543) 222-33-44"), "05432223344");
  assert.equal(normalizePhone("5432223344"), "05432223344");
  assert.equal(normalizePhone("05432223344"), "05432223344");
});

test("boş değerleri değiştirmez", () => {
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), undefined);
  assert.equal(normalizePhone(""), "");
});
