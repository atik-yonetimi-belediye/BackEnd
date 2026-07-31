const test = require("node:test");
const assert = require("node:assert/strict");
const { detectImageType } = require("../../src/utils/uploadFiles");

test("yalnızca desteklenen gerçek dosya imzalarını tanır", () => {
  assert.equal(
    detectImageType(Buffer.from("ffd8ff000000000000000000", "hex")),
    "image/jpeg"
  );
  assert.equal(
    detectImageType(Buffer.from("89504e470d0a1a0a00000000", "hex")),
    "image/png"
  );
  assert.equal(
    detectImageType(Buffer.from("524946460000000057454250", "hex")),
    "image/webp"
  );
  assert.equal(detectImageType(Buffer.from("not-an-image")), null);
});
