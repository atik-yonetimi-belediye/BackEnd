const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePhone } = require("../../src/utils/phone");

test("telefon numaralarını tek bir 0XXXXXXXXXX biçimine dönüştürür", () => {
  assert.equal(normalizePhone("+90 505 222 33 44"), "05052223344");
  assert.equal(normalizePhone("90 (505) 222-33-44"), "05052223344");
  assert.equal(normalizePhone("5052223344"), "05052223344");
  assert.equal(normalizePhone("05052223344"), "05052223344");
});

test("boş değerleri değiştirmez", () => {
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), undefined);
  assert.equal(normalizePhone(""), "");
});
