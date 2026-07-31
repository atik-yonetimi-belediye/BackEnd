const pool = require("../../config/db");
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
  const { konteyner_id, durum, sebep, diger_aciklama } = data;

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
    INSERT INTO toplama_kayitlari
      (konteyner_id, sofor_id, durum, sebep, diger_aciklama)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING
      id,
      konteyner_id,
      sofor_id,
      durum,
      sebep,
      diger_aciklama,
      tarih_saat,
      created_at,
      updated_at
    `,
    [
      konteyner_id,
      soforId,
      durum,
      durum === "atlanildi" ? sebep : null,
      durum === "atlanildi" ? diger_aciklama || null : null,
    ]
  );

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

module.exports = {
  getMe,
  getAvailableKonteynerlerForSofor,
  createToplamaKaydi,
  getMyToplamaKayitlari,
};
