const test = require("node:test");
const assert = require("node:assert/strict");
const { canTransition } = require("../../src/utils/stateTransitions");

test("şikâyet yaşam döngüsünde yalnızca izinli geçişlere izin verir", () => {
  assert.equal(canTransition("sikayet", "bekliyor", "inceleniyor"), true);
  assert.equal(canTransition("sikayet", "bekliyor", "cozuldu"), false);
  assert.equal(canTransition("sikayet", "cozuldu", "inceleniyor"), true);
});

test("geri dönüşüm talebi tamamlandıktan sonra tekrar açılamaz", () => {
  assert.equal(canTransition("talep", "onaylandi", "tamamlandi"), true);
  assert.equal(canTransition("talep", "tamamlandi", "bekliyor"), false);
});

test("şirket pasife alınabilir ve tekrar onaylanabilir", () => {
  assert.equal(canTransition("sirket", "onaylandi", "pasif"), true);
  assert.equal(canTransition("sirket", "pasif", "onaylandi"), true);
  assert.equal(canTransition("sirket", "onaylandi", "reddedildi"), false);
});
