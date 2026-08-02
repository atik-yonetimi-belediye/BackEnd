const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCorsOriginValidator,
  isDevelopmentLanOrigin,
  isPrivateIpv4,
} = require("../../src/config/corsOrigins");

test("yalnızca özel IPv4 ağları LAN adresi olarak kabul edilir", () => {
  assert.equal(isPrivateIpv4("192.168.1.108"), true);
  assert.equal(isPrivateIpv4("10.0.0.8"), true);
  assert.equal(isPrivateIpv4("172.16.5.4"), true);
  assert.equal(isPrivateIpv4("172.31.255.254"), true);
  assert.equal(isPrivateIpv4("172.32.0.1"), false);
  assert.equal(isPrivateIpv4("203.0.113.10"), false);
});

test("geliştirmede uygulama portundaki özel ağ originine izin verilir", () => {
  assert.equal(
    isDevelopmentLanOrigin("http://192.168.1.108:5180", "development"),
    true
  );
  assert.equal(
    isDevelopmentLanOrigin("http://192.168.1.108:5001", "development"),
    false
  );
  assert.equal(
    isDevelopmentLanOrigin("https://192.168.1.108:5180", "development"),
    false
  );
});

test("üretimde LAN istisnası kapalı, açık beyaz liste ise geçerlidir", () => {
  const validate = createCorsOriginValidator(
    new Set(["https://atik.example"]),
    "production"
  );

  assert.equal(validate("https://atik.example"), true);
  assert.equal(validate("http://192.168.1.108:5180"), false);
  assert.equal(validate("https://attacker.example"), false);
  assert.equal(validate(undefined), true);
});
