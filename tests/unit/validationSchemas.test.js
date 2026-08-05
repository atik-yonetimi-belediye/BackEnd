const test = require("node:test");
const assert = require("node:assert/strict");
const schemas = require("../../src/middlewares/validationSchemas");

test("tekil giriş yalnızca kullanıcı bilgisi ve şifre kabul eder", () => {
  assert.equal(
    schemas.auth.login.safeParse({
      identifier: "+90 505 222 33 44",
      sifre: "cavus123",
    }).success,
    true
  );
  assert.equal(
    schemas.auth.login.safeParse({
      identifier: "denizk",
      sifre: "admin123",
      role: "admin",
    }).success,
    false
  );
});

test("şirket kaydı verilerini normalize eder", () => {
  const result = schemas.auth.sirketRegister.parse({
    ad: "  Örnek Geri Dönüşüm  ",
    adres: "",
    mail: "  BILGI@EXAMPLE.COM ",
    telefon: "+90 543 222 33 44",
    sifre: "gucluSifre123",
  });

  assert.equal(result.ad, "Örnek Geri Dönüşüm");
  assert.equal(result.adres, undefined);
  assert.equal(result.mail, "bilgi@example.com");
  assert.equal(result.telefon, "05432223344");
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

  assert.equal(
    schemas.sirket.updateTalep.safeParse({ konteyner_id: 12 }).success,
    true
  );
  assert.equal(
    schemas.sirket.updateTalep.safeParse({ konteyner_id: null }).success,
    true
  );
  assert.equal(
    schemas.sirket.updateTalep.safeParse({ konteyner_id: -1 }).success,
    false
  );
});

test("yönetici personel oluşturma ve güncelleme alanları sıkı doğrulanır", () => {
  assert.equal(
    schemas.admin.createCavus.safeParse({
      ad_soyad: "Ayşe Yılmaz",
      telefon: "0543 111 22 33",
      sifre: "GucluSifre123",
      mahalle_id: 2,
    }).success,
    true
  );
  assert.equal(
    schemas.admin.createSofor.safeParse({
      ad: "Mehmet",
      soyad: "Kaya",
      telefon: "0543 111 22 34",
      sifre: "GucluSifre123",
      cavus_id: 2,
      arac_id: 3,
    }).success,
    true
  );
  assert.equal(schemas.admin.updateCavus.safeParse({}).success, false);
  assert.equal(schemas.admin.updateSofor.safeParse({ arac_id: null }).success, true);
  assert.equal(
    schemas.admin.resetPersonelPassword.safeParse({ sifre: "kisa" }).success,
    false
  );
});

test("yönetici araç oluşturma, aktarma ve filtre alanları doğrulanır", () => {
  assert.equal(schemas.admin.createArac.safeParse({
    plaka: "46 ABC 123",
    arac_turu: "kati_atik",
    cavus_id: 2,
  }).success, true);
  assert.equal(schemas.admin.createArac.parse({
    plaka: "  geçersiz format  ",
    arac_turu: "kati_atik",
    cavus_id: 2,
  }).plaka, "GEÇERSİZFORMAT");
  assert.equal(schemas.admin.updateAracAtama.safeParse({ cavus_id: 3, sofor_id: null }).success, true);
  assert.equal(schemas.admin.updateAracAtama.safeParse({ cavus_id: 3, sofor_id: 0 }).success, false);
  assert.equal(schemas.admin.aracListQuery.safeParse({ atama_durumu: "bosta" }).success, true);
});

test("konteyner görev atama ve durum alanları güvenli doğrulanır", () => {
  assert.equal(schemas.admin.createKonteynerGorevi.safeParse({
    cavus_id: 1,
    sofor_id: 2,
    oncelik: "acil",
    hedef_tarih: "2026-08-02T15:30:00+03:00",
  }).success, true);
  assert.equal(schemas.admin.createKonteynerGorevi.safeParse({
    cavus_id: 1,
    sofor_id: 2,
    oncelik: "bilinmeyen",
  }).success, false);
  assert.equal(schemas.admin.updateKonteynerCavus.safeParse({
    cavus_id: 3,
    acik_gorevi_iptal_et: true,
    farkli_mahalle_onayi: true,
  }).success, true);
  assert.equal(schemas.sofor.gorevListQuery.safeParse({ durum: "devam_ediyor" }).success, true);
});

test("toplu görev, yetki ve isteğe bağlı konum kanıtı birlikte doğrulanır", () => {
  const bulk = schemas.admin.bulkKonteynerGorevi.safeParse({
    konteyner_ids: [1, 2, 2], cavus_id: 1, sofor_id: 2,
  });
  assert.equal(bulk.success, true);
  assert.deepEqual(bulk.data.konteyner_ids, [1, 2]);
  assert.equal(schemas.admin.bulkKonteynerGorevi.safeParse({ konteyner_ids: [], cavus_id: 1, sofor_id: 2 }).success, false);
  assert.equal(schemas.admin.updatePersonelYetkileri.safeParse({ permissions: [{ code: "task.assign", allowed: false }] }).success, true);
  assert.equal(schemas.sofor.createToplamaKaydi.safeParse({ konteyner_id: 1, durum: "toplandi", latitude: 37.5 }).success, false);
  assert.equal(schemas.sofor.createToplamaKaydi.safeParse({ konteyner_id: 1, durum: "toplandi", latitude: 37.5, longitude: 36.9, konum_dogruluk_metre: 8 }).success, true);
});
