const test = require("node:test");
const assert = require("node:assert/strict");
const schemas = require("../../src/middlewares/validationSchemas");

test("şirket kaydı verilerini normalize eder", () => {
  const result = schemas.auth.sirketRegister.parse({
    ad: "  Örnek Geri Dönüşüm  ",
    adres: "",
    mail: "  BILGI@EXAMPLE.COM ",
    telefon: "+90 505 222 33 44",
    sifre: "gucluSifre123",
  });

  assert.equal(result.ad, "Örnek Geri Dönüşüm");
  assert.equal(result.adres, undefined);
  assert.equal(result.mail, "bilgi@example.com");
  assert.equal(result.telefon, "05052223344");
});

test("zayıf parola, geçersiz telefon ve sınır dışı sayfalama reddedilir", () => {
  assert.equal(
    schemas.auth.sirketRegister.safeParse({
      ad: "Örnek",
      mail: "test@example.com",
      telefon: "123",
      sifre: "1234567",
    }).success,
    false
  );
  assert.equal(
    schemas.mahalle.listQuery.safeParse({ page: 0, limit: 201 }).success,
    false
  );
});

test("toplama kaydı alanları duruma göre birlikte doğrulanır", () => {
  assert.equal(
    schemas.sofor.createToplamaKaydi.safeParse({
      konteyner_id: 1,
      durum: "atlanildi",
    }).success,
    false
  );
  assert.equal(
    schemas.sofor.createToplamaKaydi.safeParse({
      konteyner_id: 1,
      durum: "toplandi",
      sebep: "Konteyner boş",
    }).success,
    false
  );
  assert.equal(
    schemas.sofor.createToplamaKaydi.safeParse({
      konteyner_id: 1,
      durum: "atlanildi",
      sebep: "Diğer",
      diger_aciklama: "Yol çalışması var.",
    }).success,
    true
  );
});

test("tarih aralığı ve pozitif tahmini miktar kuralları uygulanır", () => {
  assert.equal(
    schemas.admin.toplamaListQuery.safeParse({
      date_from: "2026-07-30",
      date_to: "2026-07-01",
    }).success,
    false
  );
  assert.equal(
    schemas.sirket.createTalep.safeParse({
      talep_basligi: "Kâğıt toplama",
      tahmini_miktar: -2,
    }).success,
    false
  );
});
