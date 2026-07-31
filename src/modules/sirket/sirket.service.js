const pool = require("../../config/db");
const AppError = require("../../utils/AppError");
const {
  getPagination,
  toPaginatedResult,
} = require("../../utils/pagination");

async function getMe(sirketId) {
  const result = await pool.query(
    `
    SELECT
      id,
      ad,
      adres,
      mail,
      telefon,
      onay_durumu,
      aktif_mi,
      created_at,
      updated_at
    FROM sirketler
    WHERE id = $1
    `,
    [sirketId]
  );

  return result.rows[0];
}

async function createGeriDonusumTalebi(sirketId, data) {
  const {
    konteyner_id,
    talep_basligi,
    talep_aciklamasi,
    tahmini_miktar,
    adres,
  } = data;

  const sirketResult = await pool.query(
    `
    SELECT id, ad, telefon, aktif_mi, onay_durumu
    FROM sirketler
    WHERE id = $1
    `,
    [sirketId]
  );

  if (sirketResult.rows.length === 0) {
    const error = new Error("Şirket bulunamadı.");
    error.statusCode = 404;
    throw error;
  }

  const sirket = sirketResult.rows[0];

  if (!sirket.aktif_mi) {
    const error = new Error("Şirket hesabı pasif durumda.");
    error.statusCode = 403;
    throw error;
  }

  if (sirket.onay_durumu !== "onaylandi") {
    const error = new Error("Şirket hesabı onaylı değil.");
    error.statusCode = 403;
    throw error;
  }

  if (konteyner_id) {
    const konteynerResult = await pool.query(
      `
      SELECT id, tur, aktif_mi
      FROM konteynerler
      WHERE id = $1
      `,
      [konteyner_id]
    );

    if (konteynerResult.rows.length === 0) {
      const error = new Error("Konteyner bulunamadı.");
      error.statusCode = 404;
      throw error;
    }

    const konteyner = konteynerResult.rows[0];

    if (!konteyner.aktif_mi) {
      const error = new Error("Pasif konteyner için talep oluşturulamaz.");
      error.statusCode = 400;
      throw error;
    }

    if (konteyner.tur !== "geri_donusum") {
      const error = new Error(
        "Geri dönüşüm talebi sadece geri dönüşüm konteyneri için oluşturulabilir."
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const result = await pool.query(
    `
    INSERT INTO geri_donusum_talepleri
      (
        sirket_id,
        konteyner_id,
        gonderen_tipi,
        gonderen_ad,
        gonderen_telefon,
        atik_turu,
        talep_basligi,
        talep_aciklamasi,
        tahmini_miktar,
        adres,
        durum
      )
    VALUES
      ($1, $2, 'sirket', $3, $4, 'geri_donusum', $5, $6, $7, $8, 'bekliyor')
    RETURNING
      id,
      sirket_id,
      konteyner_id,
      gonderen_tipi,
      gonderen_ad,
      gonderen_telefon,
      atik_turu,
      talep_basligi,
      talep_aciklamasi,
      tahmini_miktar,
      adres,
      tarih_saat,
      durum,
      yonetici_notu,
      created_at,
      updated_at
    `,
    [
      sirketId,
      konteyner_id || null,
      sirket.ad,
      sirket.telefon,
      talep_basligi || null,
      talep_aciklamasi || null,
      tahmini_miktar ?? null,
      adres || null,
    ]
  );

  return result.rows[0];
}

async function getMyGeriDonusumTalepleri(sirketId, pagination = {}) {
  const { page, limit, offset } = getPagination(pagination);
  const result = await pool.query(
    `
    SELECT
      gdt.id,
      gdt.sirket_id,
      gdt.konteyner_id,
      k.konteyner_kodu,
      m.ad AS mahalle_ad,
      gdt.gonderen_tipi,
      gdt.gonderen_ad,
      gdt.gonderen_telefon,
      gdt.atik_turu,
      gdt.talep_basligi,
      gdt.talep_aciklamasi,
      gdt.tahmini_miktar,
      gdt.adres,
      gdt.tarih_saat,
      gdt.durum,
      gdt.yonetici_notu,
      gdt.created_at,
      gdt.updated_at,
      COUNT(*) OVER() AS total_count
    FROM geri_donusum_talepleri gdt
    LEFT JOIN konteynerler k ON k.id = gdt.konteyner_id
    LEFT JOIN mahalleler m ON m.id = k.mahalle_id
    WHERE gdt.sirket_id = $1
    ORDER BY gdt.tarih_saat DESC
    LIMIT $2 OFFSET $3
    `,
    [sirketId, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function updateGeriDonusumTalebi(sirketId, talepId, data) {
  const allowedFields = [
    "talep_basligi",
    "talep_aciklamasi",
    "tahmini_miktar",
    "adres",
  ];
  const entries = allowedFields
    .filter((field) => Object.prototype.hasOwnProperty.call(data, field))
    .map((field) => [field, data[field]]);

  if (entries.length === 0) return undefined;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `
      SELECT talep_basligi, talep_aciklamasi
      FROM geri_donusum_talepleri
      WHERE id = $1 AND sirket_id = $2 AND durum = 'bekliyor'
      FOR UPDATE
      `,
      [talepId, sirketId]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const current = currentResult.rows[0];
    const nextTitle = Object.prototype.hasOwnProperty.call(
      data,
      "talep_basligi"
    )
      ? data.talep_basligi
      : current.talep_basligi;
    const nextDescription = Object.prototype.hasOwnProperty.call(
      data,
      "talep_aciklamasi"
    )
      ? data.talep_aciklamasi
      : current.talep_aciklamasi;

    if (!nextTitle && !nextDescription) {
      throw new AppError(
        "Talep başlığı veya açıklamasından en az biri korunmalıdır.",
        400
      );
    }

    const values = entries.map(([, value]) => value);
    const setClause = entries
      .map(([field], index) => `${field} = $${index + 1}`)
      .join(", ");

    values.push(talepId, sirketId);
    const result = await client.query(
      `
      UPDATE geri_donusum_talepleri
      SET ${setClause}
      WHERE id = $${values.length - 1}
        AND sirket_id = $${values.length}
        AND durum = 'bekliyor'
      RETURNING *
      `,
      values
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelGeriDonusumTalebi(sirketId, talepId) {
  const result = await pool.query(
    `
    UPDATE geri_donusum_talepleri
    SET durum = 'iptal_edildi',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND sirket_id = $2 AND durum = 'bekliyor'
    RETURNING *
    `,
    [talepId, sirketId]
  );
  return result.rows[0];
}

module.exports = {
  getMe,
  createGeriDonusumTalebi,
  getMyGeriDonusumTalepleri,
  updateGeriDonusumTalebi,
  cancelGeriDonusumTalebi,
};
