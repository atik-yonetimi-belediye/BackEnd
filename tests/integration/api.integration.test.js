const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const request = require("supertest");

// Yerel Docker kurulumu ve CI ayni test komutunu kullanabilsin. Ortamdan
// verilen degerler her zaman onceliklidir; gelistirme kokundeki .env yalnizca
// eksik degerleri tamamlar.
require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env"),
  quiet: true,
});

process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "5433";
process.env.DB_NAME = process.env.DB_NAME || "belediye_atik";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "integration-test-secret-at-least-thirty-two";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ||
  "http://localhost:5180,http://127.0.0.1:5180";
process.env.TRUST_PROXY_HOPS = "1";

const app = require("../../src/app");
const pool = require("../../src/config/db");
const runMigrations = require("../../src/scripts/migrateDatabase");
const { sikayetUploadDir } = require("../../src/utils/uploadFiles");

const adminAgent = request.agent(app);
const cavusAgent = request.agent(app);
const soforAgent = request.agent(app);
const sirketAgent = request.agent(app);

let adminCsrf;
let cavusCsrf;
let soforCsrf;
let sirketCsrf;
let testComplaintId;
let testRecyclingId;
let uploadedPhotoPath;
let externalCavusId;
let externalVehicleId;
let externalContainerId;
let testCollectionId;
let adminPersonnelCavusId;
let adminPersonnelSoforId;
let adminPersonnelVehicleId;
let adminVehicleTestIds = { mahalle: [], cavus: [], sofor: null, arac: null };
let containerTaskTestId;
let seededDriverOriginalState;

function readCsrfCookie(response) {
  const cookie = response.headers["set-cookie"]?.find((value) =>
    value.startsWith("csrf_token=")
  );
  assert.ok(cookie, "CSRF cookie login yanıtında bulunmalıdır.");
  return decodeURIComponent(cookie.split(";")[0].slice("csrf_token=".length));
}

test.before(async () => {
  await runMigrations();
  const seededDriver = await pool.query(
    "SELECT id, cavus_id, arac_id, aktif_mi FROM soforler WHERE telefon = $1",
    ["05053334455"]
  );
  assert.equal(seededDriver.rowCount, 1, "Entegrasyon şoför hesabı bulunmalıdır.");
  seededDriverOriginalState = seededDriver.rows[0];
  const compatibleVehicle = await pool.query(
    `SELECT a.id
       FROM araclar a
      WHERE a.cavus_id = $1 AND a.arac_turu = 'kati_atik' AND a.aktif_mi = true
      ORDER BY a.id LIMIT 1`,
    [seededDriverOriginalState.cavus_id]
  );
  assert.equal(compatibleVehicle.rowCount, 1, "Entegrasyon şoförü için aktif katı atık aracı bulunmalıdır.");
  await pool.query(
    "UPDATE soforler SET aktif_mi = true, arac_id = $1 WHERE id = $2",
    [compatibleVehicle.rows[0].id, seededDriverOriginalState.id]
  );
});

test.after(async () => {
  if (containerTaskTestId) await pool.query("DELETE FROM konteyner_gorevleri WHERE id = $1", [containerTaskTestId]);
  if (seededDriverOriginalState) {
    await pool.query(
      "UPDATE soforler SET cavus_id = $1, arac_id = $2, aktif_mi = $3 WHERE id = $4",
      [seededDriverOriginalState.cavus_id, seededDriverOriginalState.arac_id,
        seededDriverOriginalState.aktif_mi, seededDriverOriginalState.id]
    );
  }
  if (adminVehicleTestIds.sofor) await pool.query("DELETE FROM soforler WHERE id = $1", [adminVehicleTestIds.sofor]);
  if (adminVehicleTestIds.arac) await pool.query("DELETE FROM araclar WHERE id = $1", [adminVehicleTestIds.arac]);
  for (const id of adminVehicleTestIds.cavus) await pool.query("DELETE FROM cavuslar WHERE id = $1", [id]);
  for (const id of adminVehicleTestIds.mahalle) await pool.query("DELETE FROM mahalleler WHERE id = $1", [id]);
  if (adminPersonnelSoforId) {
    await pool.query("DELETE FROM soforler WHERE id = $1", [adminPersonnelSoforId]);
  }
  if (adminPersonnelVehicleId) {
    await pool.query("DELETE FROM araclar WHERE id = $1", [adminPersonnelVehicleId]);
  }
  if (adminPersonnelCavusId) {
    await pool.query("DELETE FROM cavuslar WHERE id = $1", [adminPersonnelCavusId]);
  }
  if (testComplaintId) {
    await pool.query(
      "DELETE FROM sikayet_fotograflari WHERE sikayet_id = $1",
      [testComplaintId]
    );
    await pool.query("DELETE FROM sikayetler WHERE id = $1", [testComplaintId]);
  }
  if (testRecyclingId) {
    await pool.query("DELETE FROM geri_donusum_talepleri WHERE id = $1", [
      testRecyclingId,
    ]);
  }
  if (testCollectionId) {
    await pool.query("DELETE FROM toplama_kayitlari WHERE id = $1", [testCollectionId]);
  }
  if (uploadedPhotoPath) {
    await fs.rm(uploadedPhotoPath, { force: true });
  }
  if (externalContainerId) {
    await pool.query("DELETE FROM konteynerler WHERE id = $1", [
      externalContainerId,
    ]);
  }
  if (externalVehicleId) {
    await pool.query("DELETE FROM araclar WHERE id = $1", [externalVehicleId]);
  }
  if (externalCavusId) {
    await pool.query("DELETE FROM cavuslar WHERE id = $1", [externalCavusId]);
  }
  await pool.end();
});

test("yönetici aktif aracı şoförüyle başka aktif çavuşa aktarır ve güvenli siler", async () => {
  const adminLogin = await adminAgent
    .post("/api/auth/login")
    .send({ identifier: "denizk", sifre: "admin123" })
    .expect(200);
  adminCsrf = readCsrfCookie(adminLogin);
  const mahalle = await pool.query(
    "INSERT INTO mahalleler (ad) VALUES ($1), ($2) RETURNING id",
    [`Araç Test A ${Date.now()}`, `Araç Test B ${Date.now()}`]
  );
  adminVehicleTestIds.mahalle = mahalle.rows.map((item) => item.id);
  const cavus = await pool.query(
    `INSERT INTO cavuslar (ad_soyad, telefon, sifre, mahalle_id, aktif_mi)
     VALUES ('Araç Test Çavuş A', '05050000981', 'test-hash', $1, true),
            ('Araç Test Çavuş B', '05050000982', 'test-hash', $2, true)
     RETURNING id`,
    adminVehicleTestIds.mahalle
  );
  adminVehicleTestIds.cavus = cavus.rows.map((item) => item.id);

  const created = await adminAgent
    .post("/api/admin/araclar")
    .set("X-CSRF-Token", adminCsrf)
    .send({ plaka: "46 INT 981", arac_turu: "kati_atik", cavus_id: adminVehicleTestIds.cavus[0] })
    .expect(201);
  adminVehicleTestIds.arac = created.body.data.id;
  assert.equal(created.body.data.cavus_id, adminVehicleTestIds.cavus[0]);

  const driver = await adminAgent
    .post("/api/admin/soforler")
    .set("X-CSRF-Token", adminCsrf)
    .send({ ad: "Araç", soyad: "Şoförü", telefon: "05050000983", sifre: "GucluTest123", cavus_id: adminVehicleTestIds.cavus[0], arac_id: adminVehicleTestIds.arac })
    .expect(201);
  adminVehicleTestIds.sofor = driver.body.data.id;

  const transferred = await adminAgent
    .patch(`/api/admin/araclar/${adminVehicleTestIds.arac}`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ cavus_id: adminVehicleTestIds.cavus[1] })
    .expect(200);
  assert.equal(transferred.body.data.cavus_id, adminVehicleTestIds.cavus[1]);
  assert.equal(transferred.body.data.sofor_id, adminVehicleTestIds.sofor);
  assert.equal(transferred.body.data.tasinan_sofor_sayisi, 1);
  const movedDriver = await pool.query("SELECT cavus_id FROM soforler WHERE id = $1", [adminVehicleTestIds.sofor]);
  assert.equal(movedDriver.rows[0].cavus_id, adminVehicleTestIds.cavus[1]);

  await adminAgent
    .delete(`/api/admin/araclar/${adminVehicleTestIds.arac}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(409);
  const passive = await adminAgent
    .patch(`/api/admin/araclar/${adminVehicleTestIds.arac}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ aktif_mi: false })
    .expect(200);
  assert.equal(passive.body.data.aktif_mi, false);
  assert.equal(passive.body.data.sofor_id, null);

  await adminAgent
    .delete(`/api/admin/araclar/${adminVehicleTestIds.arac}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);
  adminVehicleTestIds.arac = null;
  await pool.query("DELETE FROM soforler WHERE id = $1", [adminVehicleTestIds.sofor]);
  adminVehicleTestIds.sofor = null;
});

test("sağlık, CORS ve bilinmeyen route davranışları doğrudur", async () => {
  const health = await request(app).get("/health").set("X-Request-ID", "integration-request-0001").expect(200);
  assert.equal(health.body.success, true);
  assert.equal(health.headers["x-request-id"], "integration-request-0001");
  const proxiedHealth = await request(app).get("/api/health").expect(200);
  assert.equal(proxiedHealth.body.status, "ok");

  await request(app)
    .get("/api/public/stats")
    .set("X-Forwarded-For", "203.0.113.10")
    .expect(200);

  const forbiddenCors = await request(app)
    .get("/health")
    .set("Origin", "https://attacker.example")
    .expect(403);
  assert.equal(forbiddenCors.body.success, false);

  const lanCors = await request(app)
    .options("/api/auth/login")
    .set("Origin", "http://192.168.1.108:5180")
    .set("Access-Control-Request-Method", "POST")
    .expect(204);
  assert.equal(
    lanCors.headers["access-control-allow-origin"],
    "http://192.168.1.108:5180"
  );

  await request(app).get("/bilinmeyen-route").expect(404);
});

test("genel endpoint gerçek veri ve sayfalama metası döndürür", async () => {
  const stats = await request(app).get("/api/public/stats").expect(200);
  assert.equal(stats.body.success, true);
  assert.equal(typeof stats.body.data.aktif_konteyner, "number");

  const containers = await request(app)
    .get("/api/konteynerler?limit=1&page=1")
    .expect(200);
  assert.equal(Array.isArray(containers.body.data), true);
  assert.equal(containers.body.data.length <= 1, true);
  assert.equal(containers.body.meta.pagination.limit, 1);
  assert.ok(
    containers.headers.ratelimit || containers.headers["ratelimit-policy"]
  );

  await request(app).get("/api/konteynerler?limit=201").expect(400);
});

test("tüm kullanıcı rolleri giriş yapabilir ve rol sınırı uygulanır", async () => {
  const admin = await adminAgent
    .post("/api/auth/login")
    .send({ identifier: "denizk", sifre: "admin123" })
    .expect(200);
  adminCsrf = readCsrfCookie(admin);
  assert.equal(admin.body.data.token, undefined);
  assert.equal(admin.body.data.user.role, "admin");

  const cavus = await cavusAgent
    .post("/api/auth/login")
    .send({ identifier: "+90 505 222 33 44", sifre: "cavus123" })
    .expect(200);
  cavusCsrf = readCsrfCookie(cavus);

  const sofor = await soforAgent
    .post("/api/auth/login")
    .send({ identifier: "05053334455", sifre: "sofor123" })
    .expect(200);
  soforCsrf = readCsrfCookie(sofor);
  assert.equal(sofor.body.data.user.role, "sofor");

  const sirket = await sirketAgent
    .post("/api/auth/login")
    .send({
      identifier: "03441112233",
      sifre: "sirket123",
    })
    .expect(200);
  sirketCsrf = readCsrfCookie(sirket);
  assert.equal(sirket.body.data.user.role, "sirket");

  await cavusAgent.get("/api/admin/dashboard").expect(403);
  const session = await adminAgent.get("/api/auth/session").expect(200);
  assert.equal(session.body.data.user.role, "admin");
});

test("yönetici şoför yetkisini kapatıp varsayılana döndürebilir", async () => {
  const driverId = seededDriverOriginalState.id;
  const catalog = await adminAgent
    .get(`/api/admin/personel/sofor/${driverId}/yetkiler`)
    .expect(200);
  assert.ok(catalog.body.data.some((item) => item.code === "own_history.view"));
  const initialVersion = Number(catalog.body.data[0].permission_version);

  const changedCatalog = await adminAgent
    .put(`/api/admin/personel/sofor/${driverId}/yetkiler`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ permissions: [{ code: "own_history.view", allowed: false }] })
    .expect(200);
  assert.ok(Number(changedCatalog.body.data[0].permission_version) > initialVersion);
  await soforAgent.get("/api/sofor/toplama-kayitlari").expect(403);

  await adminAgent
    .delete(`/api/admin/personel/sofor/${driverId}/yetkiler`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);
  await soforAgent.get("/api/sofor/toplama-kayitlari").expect(200);
});

test("konteyner detayı sağlık, şikâyet, saha kaydı ve işlem geçmişi döndürür", async () => {
  const list = await adminAgent.get("/api/admin/konteynerler?limit=1").expect(200);
  const container = list.body.data[0];
  assert.ok(["yesil", "sari", "kirmizi"].includes(container.saglik_durumu));
  const detail = await adminAgent.get(`/api/admin/konteynerler/${container.id}/detay`).expect(200);
  assert.ok(Array.isArray(detail.body.data.sikayetler));
  assert.ok(Array.isArray(detail.body.data.toplama_kayitlari));
  assert.ok(Array.isArray(detail.body.data.islem_gecmisi));
});

test("yönetici pasif konteyner oluşturur, QR üretir ve bağlantısız kaydı güvenli siler", async () => {
  const district = await pool.query("SELECT id FROM mahalleler ORDER BY id LIMIT 1");
  const code = `KNT-IT-${Date.now()}`;
  const created = await adminAgent.post("/api/admin/konteynerler").set("X-CSRF-Token", adminCsrf).send({
    konteyner_kodu: code, tur: "kati_atik", mahalle_id: district.rows[0].id,
    latitude: 0.1234567, longitude: 0.1234567, aktif_mi: false,
  }).expect(201);
  const id = created.body.data.id;
  const qr = await adminAgent.get(`/api/admin/konteynerler/${id}/qr`).query({ target: `http://localhost:5180/admin/harita?konteyner=${id}` }).expect(200);
  assert.match(qr.body.data.svg, /<svg/);
  await adminAgent.delete(`/api/admin/konteynerler/${id}`).set("X-CSRF-Token", adminCsrf).expect(200);
});

test("konteyner görevi güvenli atanır, çift atama engellenir ve şoför başlatabilir", async () => {
  const fixture = await pool.query(
    `SELECT s.id AS sofor_id, s.cavus_id, k.id AS konteyner_id
       FROM soforler s
       JOIN araclar a ON a.id = s.arac_id AND a.aktif_mi = true
       JOIN konteynerler k ON k.cavus_id = s.cavus_id AND k.tur = a.arac_turu AND k.aktif_mi = true
      WHERE s.telefon = '05053334455' AND s.aktif_mi = true
      ORDER BY k.id LIMIT 1`
  );
  assert.equal(fixture.rowCount, 1, "Görev testi için uyumlu şoför ve konteyner bulunmalıdır.");
  const target = fixture.rows[0];

  const eligible = await adminAgent
    .get(`/api/admin/konteynerler/${target.konteyner_id}/uygun-soforler`)
    .expect(200);
  const eligibleDriver = eligible.body.data.soforler.find((item) => item.id === target.sofor_id);
  assert.equal(eligibleDriver.uygun_mi, true);

  const concurrentRequests = ["yuksek", "normal"].map((oncelik) => adminAgent
    .post(`/api/admin/konteynerler/${target.konteyner_id}/gorevler`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ cavus_id: target.cavus_id, sofor_id: target.sofor_id, oncelik, yonetici_notu: "Eş zamanlı entegrasyon görevi" }));
  const concurrentResults = await Promise.all(concurrentRequests);
  assert.deepEqual(concurrentResults.map((item) => item.status).sort(), [201, 409], "Eş zamanlı iki atamadan yalnızca biri başarılı olmalıdır.");
  const created = concurrentResults.find((item) => item.status === 201);
  containerTaskTestId = created.body.data.id;
  assert.equal(created.body.data.durum, "atandi");
  assert.equal(created.body.data.sofor_id, target.sofor_id);

  const myTasks = await soforAgent.get("/api/sofor/gorevler").expect(200);
  assert.ok(myTasks.body.data.some((item) => item.id === containerTaskTestId));
  const started = await soforAgent
    .patch(`/api/sofor/gorevler/${containerTaskTestId}/baslat`)
    .set("X-CSRF-Token", soforCsrf)
    .expect(200);
  assert.equal(started.body.data.durum, "devam_ediyor");

  const cancelled = await adminAgent
    .patch(`/api/admin/konteyner-gorevleri/${containerTaskTestId}/iptal`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ iptal_nedeni: "Entegrasyon testi tamamlandı." })
    .expect(200);
  assert.equal(cancelled.body.data.durum, "iptal_edildi");
});

test("yönetici personel yaşam döngüsünü ve güvenli silme kurallarını yönetir", async () => {
  await cavusAgent
    .post("/api/admin/cavuslar")
    .set("X-CSRF-Token", cavusCsrf)
    .send({})
    .expect(403);

  const mahalle = await pool.query(`
    SELECT m.id
    FROM mahalleler m
    LEFT JOIN cavuslar c ON c.mahalle_id = m.id
    WHERE c.id IS NULL
    ORDER BY m.id
    LIMIT 1
  `);
  assert.equal(mahalle.rowCount, 1, "Test için boş mahalle bulunmalıdır.");

  const createdCavus = await adminAgent
    .post("/api/admin/cavuslar")
    .set("X-CSRF-Token", adminCsrf)
    .send({
      ad_soyad: "Entegrasyon Personel",
      telefon: "05050000131",
      sifre: "GucluTest123",
      mahalle_id: mahalle.rows[0].id,
    })
    .expect(201);
  adminPersonnelCavusId = createdCavus.body.data.id;
  assert.equal(createdCavus.body.data.mahalle_id, mahalle.rows[0].id);
  assert.equal("sifre" in createdCavus.body.data, false);

  await adminAgent
    .post("/api/admin/cavuslar")
    .set("X-CSRF-Token", adminCsrf)
    .send({
      ad_soyad: "Telefon Çakışması",
      telefon: "05050000131",
      sifre: "GucluTest123",
      mahalle_id: mahalle.rows[0].id,
    })
    .expect(409);

  const vehicle = await pool.query(
    `INSERT INTO araclar (plaka, arac_turu, cavus_id, aktif_mi)
     VALUES ('46 INT 131', 'kati_atik', $1, true) RETURNING id`,
    [adminPersonnelCavusId]
  );
  adminPersonnelVehicleId = vehicle.rows[0].id;

  const createdSofor = await adminAgent
    .post("/api/admin/soforler")
    .set("X-CSRF-Token", adminCsrf)
    .send({
      ad: "Test",
      soyad: "Şoförü",
      telefon: "05050000132",
      sifre: "GucluTest123",
      cavus_id: adminPersonnelCavusId,
      arac_id: adminPersonnelVehicleId,
    })
    .expect(201);
  adminPersonnelSoforId = createdSofor.body.data.id;
  assert.equal(createdSofor.body.data.cavus_id, adminPersonnelCavusId);
  assert.equal(createdSofor.body.data.arac_id, adminPersonnelVehicleId);

  const filtered = await adminAgent
    .get("/api/admin/soforler?search=Test&aktif_mi=true")
    .expect(200);
  assert.ok(filtered.body.data.some((item) => item.id === adminPersonnelSoforId));

  const updatedSofor = await adminAgent
    .patch(`/api/admin/soforler/${adminPersonnelSoforId}`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ ad: "Güncellenen" })
    .expect(200);
  assert.equal(updatedSofor.body.data.ad, "Güncellenen");

  const resetPassword = await adminAgent
    .patch(`/api/admin/soforler/${adminPersonnelSoforId}/sifre`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ sifre: "YeniGuclu123" })
    .expect(200);
  assert.equal("sifre" in resetPassword.body.data, false);

  await adminAgent
    .delete(`/api/admin/soforler/${adminPersonnelSoforId}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(409);

  const passiveSofor = await adminAgent
    .patch(`/api/admin/soforler/${adminPersonnelSoforId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ aktif_mi: false })
    .expect(200);
  assert.equal(passiveSofor.body.data.aktif_mi, false);
  assert.equal(passiveSofor.body.data.arac_id, null);

  await adminAgent
    .delete(`/api/admin/soforler/${adminPersonnelSoforId}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);
  adminPersonnelSoforId = undefined;

  await adminAgent
    .patch(`/api/admin/cavuslar/${adminPersonnelCavusId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ aktif_mi: false })
    .expect(200);
  await adminAgent
    .delete(`/api/admin/cavuslar/${adminPersonnelCavusId}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(409);

  await pool.query("DELETE FROM araclar WHERE id = $1", [adminPersonnelVehicleId]);
  adminPersonnelVehicleId = undefined;
  await adminAgent
    .delete(`/api/admin/cavuslar/${adminPersonnelCavusId}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);
  adminPersonnelCavusId = undefined;
});

test("rol bazlı tüm okuma endpointleri geçerli SQL ve tutarlı yanıt üretir", async () => {
  const publicEndpoints = [
    "/api/mahalleler?limit=2",
    "/api/konteynerler?limit=2",
    "/api/public/stats",
  ];
  const adminEndpoints = [
    "/api/admin/dashboard",
    "/api/admin/cavuslar?limit=2",
    "/api/admin/soforler?limit=2",
    "/api/admin/sirketler?limit=2",
    "/api/admin/konteynerler?limit=2",
    "/api/admin/araclar?limit=2",
    "/api/admin/toplama-kayitlari?limit=2",
    "/api/sikayetler?limit=2",
    "/api/recycling-requests?limit=2",
  ];
  const cavusEndpoints = [
    "/api/cavus/me",
    "/api/cavus/konteynerler?limit=2",
    "/api/cavus/araclar?limit=2",
    "/api/cavus/soforler?limit=2",
    "/api/cavus/toplama-kayitlari?limit=2",
  ];
  const soforEndpoints = [
    "/api/sofor/me",
    "/api/sofor/konteynerler?limit=2",
    "/api/sofor/toplama-kayitlari?limit=2",
  ];
  const sirketEndpoints = [
    "/api/sirket/me",
    "/api/sirket/geri-donusum-talepleri?limit=2",
  ];

  for (const endpoint of publicEndpoints) {
    await request(app).get(endpoint).expect(200);
  }
  for (const endpoint of adminEndpoints) {
    await adminAgent.get(endpoint).expect(200);
  }
  for (const endpoint of cavusEndpoints) {
    await cavusAgent.get(endpoint).expect(200);
  }
  for (const endpoint of soforEndpoints) {
    await soforAgent.get(endpoint).expect(200);
  }
  for (const endpoint of sirketEndpoints) {
    await sirketAgent.get(endpoint).expect(200);
  }
});

test("metrik, frontend hata ve saha telemetrisi gözlemlenebilirlik verisi üretir", async () => {
  const metrics = await request(app).get("/metrics").expect(200);
  assert.match(metrics.text, /atik_http_request_duration_seconds/);

  await request(app)
    .post("/api/client-errors")
    .send({ kind: "window-error", message: "Entegrasyon gözlemlenebilirlik kontrolü", path: "/test" })
    .expect(202);

  await soforAgent
    .post("/api/telemetry")
    .set("X-CSRF-Token", soforCsrf)
    .send({ event: "collection_success", duration_ms: 1250 })
    .expect(202);

  const updatedMetrics = await request(app).get("/metrics").expect(200);
  assert.match(updatedMetrics.text, /atik_frontend_errors_total\{kind="window-error"\} 1/);
  assert.match(updatedMetrics.text, /atik_pilot_events_total\{event="collection_success",role="sofor"\} 1/);
});

test("aynı idempotency anahtarı çift toplama kaydı oluşturmaz", async () => {
  const available = await soforAgent.get("/api/sofor/konteynerler?limit=1").expect(200);
  assert.ok(available.body.data.length > 0, "Şoför için uygun konteyner bulunmalıdır.");
  const payload = { konteyner_id: available.body.data[0].id, durum: "toplandi" };
  const key = "integration-idempotency-00000001";

  const first = await soforAgent
    .post("/api/sofor/toplama-kayitlari")
    .set("X-CSRF-Token", soforCsrf)
    .set("Idempotency-Key", key)
    .send(payload)
    .expect(201);
  const second = await soforAgent
    .post("/api/sofor/toplama-kayitlari")
    .set("X-CSRF-Token", soforCsrf)
    .set("Idempotency-Key", key)
    .send(payload)
    .expect(201);

  testCollectionId = first.body.data.id;
  assert.equal(second.body.data.id, testCollectionId);
  const count = await pool.query(
    "SELECT COUNT(*)::int AS count FROM toplama_kayitlari WHERE idempotency_key = $1",
    [key]
  );
  assert.equal(count.rows[0].count, 1);
});

test("şoför ve çavuş başka sorumluluk bölgesindeki kayıtlara erişemez", async () => {
  const fixture = await pool.query(`
    WITH selected_mahalle AS (
      SELECT m.id
      FROM mahalleler m
      WHERE NOT EXISTS (
        SELECT 1 FROM cavuslar c WHERE c.mahalle_id = m.id
      )
      ORDER BY m.id
      LIMIT 1
    ),
    source_hash AS (
      SELECT sifre FROM cavuslar ORDER BY id LIMIT 1
    ),
    new_cavus AS (
      INSERT INTO cavuslar (ad_soyad, telefon, sifre, mahalle_id)
      SELECT 'Entegrasyon Bölge Testi', '05050000099', sh.sifre, sm.id
      FROM selected_mahalle sm CROSS JOIN source_hash sh
      RETURNING id, mahalle_id
    ),
    new_vehicle AS (
      INSERT INTO araclar (plaka, arac_turu, cavus_id)
      SELECT '46 TST 99', a.arac_turu, nc.id
      FROM new_cavus nc
      CROSS JOIN LATERAL (
        SELECT arac_turu FROM araclar ORDER BY id LIMIT 1
      ) a
      RETURNING id, cavus_id, arac_turu
    ),
    new_container AS (
      INSERT INTO konteynerler (
        konteyner_kodu, tur, mahalle_id, cavus_id, latitude, longitude
      )
      SELECT
        'KNT-INTEGRATION-EXTERNAL',
        nv.arac_turu,
        nc.mahalle_id,
        nc.id,
        37.58,
        36.91
      FROM new_cavus nc CROSS JOIN new_vehicle nv
      RETURNING id, cavus_id
    )
    SELECT
      nc.id AS cavus_id,
      nv.id AS vehicle_id,
      nk.id AS container_id
    FROM new_cavus nc
    CROSS JOIN new_vehicle nv
    CROSS JOIN new_container nk
  `);

  externalCavusId = fixture.rows[0].cavus_id;
  externalVehicleId = fixture.rows[0].vehicle_id;
  externalContainerId = fixture.rows[0].container_id;

  const available = await soforAgent
    .get("/api/sofor/konteynerler?limit=200")
    .expect(200);
  assert.equal(
    available.body.data.some((item) => item.id === externalContainerId),
    false
  );

  await soforAgent
    .post("/api/sofor/toplama-kayitlari")
    .set("X-CSRF-Token", soforCsrf)
    .send({ konteyner_id: externalContainerId, durum: "toplandi" })
    .expect(403);

  const ownDriver = await pool.query(
    "SELECT id FROM soforler WHERE cavus_id <> $1 ORDER BY id LIMIT 1",
    [externalCavusId]
  );
  await cavusAgent
    .patch(`/api/cavus/soforler/${ownDriver.rows[0].id}/arac`)
    .set("X-CSRF-Token", cavusCsrf)
    .send({ arac_id: externalVehicleId })
    .expect(400);
});

test("cookie oturumunda yazma işlemleri CSRF başlığı olmadan reddedilir", async () => {
  const complaint = await pool.query(
    "SELECT id, durum FROM sikayetler WHERE aktif_mi = true ORDER BY id LIMIT 1"
  );
  await adminAgent
    .patch(`/api/sikayetler/${complaint.rows[0].id}/durum`)
    .send({ durum: complaint.rows[0].durum })
    .expect(403);
});

test("şirket talebi içerik bütünlüğünü ve durum yaşam döngüsünü korur", async () => {
  const recyclingContainer = await pool.query(
    "SELECT id FROM konteynerler WHERE aktif_mi = true AND tur = 'geri_donusum' ORDER BY id LIMIT 1"
  );
  const solidWasteContainer = await pool.query(
    "SELECT id FROM konteynerler WHERE aktif_mi = true AND tur = 'kati_atik' ORDER BY id LIMIT 1"
  );

  const created = await sirketAgent
    .post("/api/sirket/geri-donusum-talepleri")
    .set("X-CSRF-Token", sirketCsrf)
    .send({
      talep_basligi: "Entegrasyon geri dönüşüm talebi",
      talep_aciklamasi: "Test tamamlandığında temizlenecek kayıt.",
      tahmini_miktar: 25,
      adres: "Test adresi",
      konteyner_id: recyclingContainer.rows[0].id,
    })
    .expect(201);
  testRecyclingId = created.body.data.id;
  assert.equal(created.body.data.konteyner_id, recyclingContainer.rows[0].id);

  await sirketAgent
    .put(`/api/sirket/geri-donusum-talepleri/${testRecyclingId}`)
    .set("X-CSRF-Token", sirketCsrf)
    .send({ konteyner_id: solidWasteContainer.rows[0].id })
    .expect(400);

  const clearedContainer = await sirketAgent
    .put(`/api/sirket/geri-donusum-talepleri/${testRecyclingId}`)
    .set("X-CSRF-Token", sirketCsrf)
    .send({ konteyner_id: null })
    .expect(200);
  assert.equal(clearedContainer.body.data.konteyner_id, null);

  await sirketAgent
    .put(`/api/sirket/geri-donusum-talepleri/${testRecyclingId}`)
    .set("X-CSRF-Token", sirketCsrf)
    .send({ talep_basligi: null, talep_aciklamasi: null })
    .expect(400);

  await sirketAgent
    .put(`/api/sirket/geri-donusum-talepleri/${testRecyclingId}`)
    .set("X-CSRF-Token", sirketCsrf)
    .send({
      talep_basligi: null,
      talep_aciklamasi: "Başlıksız ama açıklaması bulunan geçerli talep.",
    })
    .expect(200);

  await adminAgent
    .patch(`/api/recycling-requests/${testRecyclingId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "onaylandi" })
    .expect(200);
  await adminAgent
    .patch(`/api/recycling-requests/${testRecyclingId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "tamamlandi" })
    .expect(200);
  await adminAgent
    .patch(`/api/recycling-requests/${testRecyclingId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "bekliyor" })
    .expect(409);
});

test("başarısız girişler kullanıcı varlığını açığa çıkarmaz", async () => {
  const missing = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "olmayan-kullanici", sifre: "yanlis" })
    .expect(401);
  const wrongPassword = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "denizk", sifre: "yanlis" })
    .expect(401);

  assert.equal(missing.body.message, wrongPassword.body.message);
});

test("rol gönderimi reddedilir ve eski rol bazlı giriş endpointleri kapalıdır", async () => {
  await request(app)
    .post("/api/auth/login")
    .send({ identifier: "denizk", sifre: "admin123", role: "admin" })
    .expect(400);

  await request(app)
    .post("/api/auth/admin/login")
    .send({ identifier: "denizk", sifre: "admin123" })
    .expect(404);
});

test("pasif ve onaysız hesaplar genel hata ile girişten engellenir", async () => {
  const admin = await pool.query(
    "SELECT id, aktif_mi FROM yoneticiler WHERE kullanici_adi = 'denizk'"
  );
  const sirket = await pool.query(
    "SELECT id, onay_durumu FROM sirketler WHERE telefon = '03441112233'"
  );

  try {
    await pool.query("UPDATE yoneticiler SET aktif_mi = false WHERE id = $1", [
      admin.rows[0].id,
    ]);
    await request(app)
      .post("/api/auth/login")
      .send({ identifier: "denizk", sifre: "admin123" })
      .expect(401);

    await pool.query(
      "UPDATE sirketler SET onay_durumu = 'bekliyor' WHERE id = $1",
      [sirket.rows[0].id]
    );
    await request(app)
      .post("/api/auth/login")
      .send({ identifier: "03441112233", sifre: "sirket123" })
      .expect(401);
  } finally {
    await pool.query("UPDATE yoneticiler SET aktif_mi = $1 WHERE id = $2", [
      admin.rows[0].aktif_mi,
      admin.rows[0].id,
    ]);
    await pool.query(
      "UPDATE sirketler SET onay_durumu = $1 WHERE id = $2",
      [sirket.rows[0].onay_durumu, sirket.rows[0].id]
    );
  }
});

test("sahte görsel reddedilir ve geçici dosya bırakılmaz", async () => {
  const containerResult = await pool.query(
    "SELECT id, tur FROM konteynerler WHERE aktif_mi = true ORDER BY id LIMIT 1"
  );
  const container = containerResult.rows[0];
  const before = new Set(await fs.readdir(sikayetUploadDir));

  await request(app)
    .post("/api/sikayetler")
    .field("vatandas_ad_soyad", "Entegrasyon Testi")
    .field("vatandas_telefon", "05059998877")
    .field("konteyner_id", String(container.id))
    .field("sikayet_turu", container.tur)
    .field("sikayet_kategorisi", "diger")
    .field("sikayet_metni", "Geçersiz dosya imzası kontrolü.")
    .attach("fotograflar", Buffer.from("not-an-image"), "sahte.png")
    .expect(400);

  assert.deepEqual(new Set(await fs.readdir(sikayetUploadDir)), before);
});

test("şikâyet görseli kaydedilir, durum akışı korunur ve arşivlemede silinir", async () => {
  const containerResult = await pool.query(
    "SELECT id, tur FROM konteynerler WHERE aktif_mi = true ORDER BY id LIMIT 1"
  );
  const container = containerResult.rows[0];
  const pngSignature = Buffer.from("89504e470d0a1a0a00000000", "hex");

  const created = await request(app)
    .post("/api/sikayetler")
    .field("vatandas_ad_soyad", "Entegrasyon Testi")
    .field("vatandas_telefon", "+90 505 999 88 77")
    .field("konteyner_id", String(container.id))
    .field("sikayet_turu", container.tur)
    .field("sikayet_kategorisi", "diger")
    .field("sikayet_metni", "Dosya yaşam döngüsü entegrasyon testi.")
    .attach("fotograflar", pngSignature, "kanıt.png")
    .expect(201);

  testComplaintId = created.body.data.id;
  const photoUrl = created.body.data.fotograflar[0].foto_url;
  uploadedPhotoPath = path.join(sikayetUploadDir, path.basename(photoUrl));
  await fs.access(uploadedPhotoPath);

  await adminAgent
    .patch(`/api/sikayetler/${testComplaintId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "cozuldu" })
    .expect(409);

  await adminAgent
    .patch(`/api/sikayetler/${testComplaintId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "inceleniyor" })
    .expect(200);

  await adminAgent
    .patch(`/api/sikayetler/${testComplaintId}/durum`)
    .set("X-CSRF-Token", adminCsrf)
    .send({ durum: "cozuldu" })
    .expect(200);

  await adminAgent
    .delete(`/api/sikayetler/${testComplaintId}`)
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);

  await assert.rejects(fs.access(uploadedPhotoPath));
  const archived = await pool.query(
    "SELECT aktif_mi FROM sikayetler WHERE id = $1",
    [testComplaintId]
  );
  assert.equal(archived.rows[0].aktif_mi, false);
});

test("merkezî telefon kaydı rol tabloları arası çakışmayı engeller", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      client.query("UPDATE soforler SET telefon = (SELECT telefon FROM cavuslar ORDER BY id LIMIT 1) WHERE id = (SELECT id FROM soforler ORDER BY id LIMIT 1)"),
      (error) => error.code === "23505"
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("yönetici yazma işlemleri değiştirilemez audit kaydı üretir", async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  const audit = await pool.query("SELECT id, request_id FROM audit_logs WHERE actor_role = 'admin' ORDER BY id DESC LIMIT 1");
  assert.ok(audit.rowCount > 0);
  assert.ok(audit.rows[0].request_id);

  const passwordAudit = await pool.query(
    "SELECT request_data FROM audit_logs WHERE entity_path LIKE '/api/admin/%/sifre' ORDER BY id DESC LIMIT 1"
  );
  assert.equal(passwordAudit.rowCount, 1);
  assert.deepEqual(passwordAudit.rows[0].request_data, {});

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(client.query("UPDATE audit_logs SET action = 'PUT' WHERE id = $1", [audit.rows[0].id]));
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("çıkış endpoint'i oturum cookie'lerini temizler", async () => {
  const response = await adminAgent
    .post("/api/auth/logout")
    .set("X-CSRF-Token", adminCsrf)
    .expect(200);

  const clearedCookies = response.headers["set-cookie"] || [];
  assert.ok(
    clearedCookies.some(
      (cookie) => cookie.startsWith("auth_token=") && cookie.includes("Expires=")
    )
  );
  await adminAgent.get("/api/auth/session").expect(401);
});

test("kimlik doğrulama endpointleri sıkı istek sınırı uygular", async () => {
  let limitedResponse;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "rate-limit-test", sifre: "yanlis" });
    if (response.status === 429) {
      limitedResponse = response;
      break;
    }
    assert.equal(response.status, 401);
  }

  assert.ok(limitedResponse, "Auth rate limiter 20 denemede devreye girmelidir.");
  assert.ok(
    limitedResponse.headers.ratelimit ||
      limitedResponse.headers["ratelimit-policy"]
  );
});
