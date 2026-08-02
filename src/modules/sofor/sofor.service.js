const pool = require("../../config/db");
const { recordActivity } = require("../../services/activity.service");
const {
  getPagination,
  toPaginatedResult,
} = require("../../utils/pagination");

async function getMe(soforId) {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.ad,
      s.soyad,
      s.telefon,
      s.arac_id,
      a.plaka,
      a.arac_turu,
      s.cavus_id,
      c.ad_soyad AS cavus_ad_soyad,
      s.aktif_mi,
      s.created_at,
      s.updated_at
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    LEFT JOIN cavuslar c ON c.id = s.cavus_id
    WHERE s.id = $1
    `,
    [soforId]
  );

  return result.rows[0];
}

async function getAvailableKonteynerlerForSofor(soforId, pagination = {}) {
  const { page, limit, offset } = getPagination(pagination);
  const soforResult = await pool.query(
    `
    SELECT
      s.id,
      s.arac_id,
      s.cavus_id,
      a.arac_turu
    FROM soforler s
    JOIN araclar a ON a.id = s.arac_id
    WHERE s.id = $1
      AND s.aktif_mi = true
      AND a.aktif_mi = true
    `,
    [soforId]
  );

  if (soforResult.rows.length === 0) {
    const error = new Error("Şoför veya aktif aracı bulunamadı.");
    error.statusCode = 404;
    throw error;
  }

  const { arac_turu: aracTuru, cavus_id: cavusId } = soforResult.rows[0];

  const result = await pool.query(
    `
    SELECT
      k.id,
      k.konteyner_kodu,
      k.tur,
      k.mahalle_id,
      m.ad AS mahalle_ad,
      m.ilce,
      m.il,
      k.cavus_id,
      c.ad_soyad AS cavus_ad_soyad,
      k.latitude,
      k.longitude,
      k.aktif_mi,
      k.created_at,
      k.updated_at,
      COUNT(*) OVER() AS total_count
    FROM konteynerler k
    JOIN mahalleler m ON m.id = k.mahalle_id
    LEFT JOIN cavuslar c ON c.id = k.cavus_id
    WHERE k.tur = $1
      AND k.cavus_id = $2
      AND k.aktif_mi = true
    ORDER BY k.id ASC
    LIMIT $3 OFFSET $4
    `,
    [aracTuru, cavusId, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function createToplamaKaydi(soforId, data) {
  const { konteyner_id, durum, sebep, diger_aciklama, idempotency_key,
    latitude, longitude, konum_dogruluk_metre, kanit_fotografi_url } = data;

  const checkResult = await pool.query(
    `
    SELECT
      k.id AS konteyner_id,
      k.tur AS konteyner_tur,
      k.aktif_mi AS konteyner_aktif_mi,
      k.cavus_id AS konteyner_cavus_id,
      s.id AS sofor_id,
      s.aktif_mi AS sofor_aktif_mi,
      s.cavus_id AS sofor_cavus_id,
      a.id AS arac_id,
      a.arac_turu,
      a.aktif_mi AS arac_aktif_mi
    FROM konteynerler k
    JOIN soforler s ON s.id = $1
    JOIN araclar a ON a.id = s.arac_id
    WHERE k.id = $2
    `,
    [soforId, konteyner_id]
  );

  if (checkResult.rows.length === 0) {
    const error = new Error("Konteyner veya şoför bilgisi bulunamadı.");
    error.statusCode = 404;
    throw error;
  }

  const check = checkResult.rows[0];

  if (!check.sofor_aktif_mi) {
    const error = new Error("Şoför hesabı pasif durumda.");
    error.statusCode = 403;
    throw error;
  }

  if (!check.arac_aktif_mi) {
    const error = new Error("Şoförün aracı pasif durumda.");
    error.statusCode = 403;
    throw error;
  }

  if (!check.konteyner_aktif_mi) {
    const error = new Error("Konteyner pasif durumda.");
    error.statusCode = 400;
    throw error;
  }

  if (check.konteyner_cavus_id !== check.sofor_cavus_id) {
    const error = new Error("Konteyner şoförün sorumluluk bölgesinde değil.");
    error.statusCode = 403;
    throw error;
  }

  if (check.konteyner_tur !== check.arac_turu) {
    const error = new Error(
      "Bu konteyner, şoförün araç türüne uygun değil."
    );
    error.statusCode = 403;
    throw error;
  }

  const result = await pool.query(
    `
    WITH saved AS (
    INSERT INTO toplama_kayitlari
      (konteyner_id, sofor_id, durum, sebep, diger_aciklama, idempotency_key,
       latitude, longitude, konum_dogruluk_metre, kanit_fotografi_url)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (sofor_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
    RETURNING
      id,
      konteyner_id,
      sofor_id,
      durum,
      sebep,
      diger_aciklama,
      latitude,
      longitude,
      konum_dogruluk_metre,
      kanit_fotografi_url,
      tarih_saat,
      created_at,
      updated_at
    ), task_update AS (
      UPDATE konteyner_gorevleri
         SET durum = CASE WHEN $3 = 'toplandi' THEN 'tamamlandi' ELSE 'atlandi' END,
             tamamlanma_tarihi = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE konteyner_id = $1 AND sofor_id = $2
         AND durum IN ('atandi', 'devam_ediyor')
       RETURNING id
    )
    SELECT * FROM saved
    `,
    [
      konteyner_id,
      soforId,
      durum,
      durum === "atlanildi" ? sebep : null,
      durum === "atlanildi" ? diger_aciklama || null : null,
      idempotency_key || null,
      latitude ?? null,
      longitude ?? null,
      konum_dogruluk_metre ?? null,
      kanit_fotografi_url || null,
    ]
  );
  const driver = await pool.query("SELECT CONCAT(ad, ' ', soyad) AS ad_soyad FROM soforler WHERE id=$1", [soforId]);
  await recordActivity(pool, {
    actorRole: "sofor", actorId: soforId, actorName: driver.rows[0]?.ad_soyad,
    entityType: "toplama", entityId: result.rows[0].id,
    action: durum === "toplandi" ? "collection.completed" : "collection.skipped",
    summary: durum === "toplandi" ? "Konteyner toplandı." : "Konteyner atlandı.",
    metadata: { related_entity_type: "konteyner", related_entity_id: Number(konteyner_id), photo: Boolean(kanit_fotografi_url), location: latitude != null },
  });
  return result.rows[0];
}

async function getMyToplamaKayitlari(soforId, pagination = {}) {
  const { page, limit, offset } = getPagination(pagination);
  const result = await pool.query(
    `
    SELECT
      tk.id,
      tk.konteyner_id,
      k.konteyner_kodu,
      k.tur AS konteyner_tur,
      m.ad AS mahalle_ad,
      tk.sofor_id,
      tk.durum,
      tk.sebep,
      tk.diger_aciklama,
      tk.latitude,
      tk.longitude,
      tk.konum_dogruluk_metre,
      tk.kanit_fotografi_url,
      tk.tarih_saat,
      tk.created_at,
      tk.updated_at,
      COUNT(*) OVER() AS total_count
    FROM toplama_kayitlari tk
    LEFT JOIN konteynerler k ON k.id = tk.konteyner_id
    LEFT JOIN mahalleler m ON m.id = k.mahalle_id
    WHERE tk.sofor_id = $1
    ORDER BY tk.tarih_saat DESC
    LIMIT $2 OFFSET $3
    `,
    [soforId, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function getMyTasks(soforId, filters = {}) {
  const { page, limit, offset } = getPagination(filters);
  const values = [soforId];
  const conditions = ["g.sofor_id = $1"];
  if (filters.durum) {
    values.push(filters.durum);
    conditions.push(`g.durum = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT g.id, g.konteyner_id, k.konteyner_kodu, k.tur,
            k.latitude, k.longitude, m.ad AS mahalle_ad,
            g.cavus_id, c.ad_soyad AS cavus_ad_soyad,
            g.arac_id, a.plaka, g.oncelik, g.durum, g.hedef_tarih,
            g.yonetici_notu, g.baslama_tarihi, g.tamamlanma_tarihi,
            (g.hedef_tarih IS NOT NULL AND g.hedef_tarih < CURRENT_TIMESTAMP
             AND g.durum IN ('atandi', 'devam_ediyor')) AS gecikti_mi,
            g.created_at, g.updated_at, COUNT(*) OVER() AS total_count
       FROM konteyner_gorevleri g
       JOIN konteynerler k ON k.id = g.konteyner_id
       JOIN mahalleler m ON m.id = k.mahalle_id
       JOIN cavuslar c ON c.id = g.cavus_id
       JOIN araclar a ON a.id = g.arac_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY CASE g.oncelik WHEN 'acil' THEN 1 WHEN 'yuksek' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
               g.hedef_tarih NULLS LAST, g.created_at ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  return toPaginatedResult(result.rows, page, limit);
}

async function startTask(soforId, taskId) {
  const result = await pool.query(
    `UPDATE konteyner_gorevleri
        SET durum = 'devam_ediyor', baslama_tarihi = COALESCE(baslama_tarihi, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND sofor_id = $2 AND durum = 'atandi'
      RETURNING id, konteyner_id, durum, baslama_tarihi, updated_at`,
    [taskId, soforId]
  );
  if (result.rowCount === 0) {
    const error = new Error("Başlatılabilir görev bulunamadı.");
    error.statusCode = 404;
    throw error;
  }
  const driver = await pool.query("SELECT CONCAT(ad, ' ', soyad) AS ad_soyad FROM soforler WHERE id=$1", [soforId]);
  await recordActivity(pool, {
    actorRole: "sofor", actorId: soforId, actorName: driver.rows[0]?.ad_soyad,
    entityType: "gorev", entityId: Number(taskId), action: "task.started", summary: "Şoför görevi başlattı.",
    metadata: { related_entity_type: "konteyner", related_entity_id: result.rows[0].konteyner_id },
  });
  return result.rows[0];
}

module.exports = {
  getMe,
  getAvailableKonteynerlerForSofor,
  createToplamaKaydi,
  getMyToplamaKayitlari,
  getMyTasks,
  startTask,
};
