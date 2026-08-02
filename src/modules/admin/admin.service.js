const pool = require("../../config/db");
const bcrypt = require("bcrypt");
const AppError = require("../../utils/AppError");
const { normalizePhone } = require("../../utils/phone");
const { canTransition } = require("../../utils/stateTransitions");
const { healthExpression } = require("./containerManagement.service");
const {
  getPagination,
  toPaginatedResult,
} = require("../../utils/pagination");

async function getDashboard() {
  const [
    konteynerResult,
    aracResult,
    cavusResult,
    soforResult,
    sirketResult,
    sikayetResult,
    geriDonusumTalepResult,
    bugunkuToplamaResult,
    recentActivityResult,
  ] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS toplam_konteyner,
        COUNT(*) FILTER (WHERE aktif_mi = true) AS aktif_konteyner,
        COUNT(*) FILTER (WHERE aktif_mi = false) AS pasif_konteyner,
        COUNT(*) FILTER (WHERE tur = 'kati_atik') AS kati_atik_konteyner,
        COUNT(*) FILTER (WHERE tur = 'geri_donusum') AS geri_donusum_konteyner
      FROM konteynerler
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_arac,
        COUNT(*) FILTER (WHERE aktif_mi = true) AS aktif_arac,
        COUNT(*) FILTER (WHERE aktif_mi = false) AS pasif_arac,
        COUNT(*) FILTER (WHERE arac_turu = 'kati_atik') AS kati_atik_arac,
        COUNT(*) FILTER (WHERE arac_turu = 'geri_donusum') AS geri_donusum_arac
      FROM araclar
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_cavus,
        COUNT(*) FILTER (WHERE aktif_mi = true) AS aktif_cavus,
        COUNT(*) FILTER (WHERE aktif_mi = false) AS pasif_cavus
      FROM cavuslar
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_sofor,
        COUNT(*) FILTER (WHERE aktif_mi = true) AS aktif_sofor,
        COUNT(*) FILTER (WHERE aktif_mi = false) AS pasif_sofor
      FROM soforler
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_sirket,
        COUNT(*) FILTER (WHERE aktif_mi = true) AS aktif_sirket,
        COUNT(*) FILTER (WHERE aktif_mi = false) AS pasif_sirket,
        COUNT(*) FILTER (WHERE onay_durumu = 'bekliyor') AS bekleyen_sirket,
        COUNT(*) FILTER (WHERE onay_durumu = 'onaylandi') AS onayli_sirket,
        COUNT(*) FILTER (WHERE onay_durumu = 'reddedildi') AS reddedilen_sirket
      FROM sirketler
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_sikayet,
        COUNT(*) FILTER (WHERE durum = 'bekliyor') AS bekleyen_sikayet,
        COUNT(*) FILTER (WHERE durum = 'inceleniyor') AS incelenen_sikayet,
        COUNT(*) FILTER (WHERE durum = 'cozuldu') AS cozulen_sikayet,
        COUNT(*) FILTER (WHERE durum = 'reddedildi') AS reddedilen_sikayet
      FROM sikayetler
      WHERE aktif_mi = true
    `),

    pool.query(`
      SELECT
        COUNT(*) AS toplam_talep,
        COUNT(*) FILTER (WHERE durum = 'bekliyor') AS bekleyen_talep,
        COUNT(*) FILTER (WHERE durum = 'onaylandi') AS onaylanan_talep,
        COUNT(*) FILTER (WHERE durum = 'reddedildi') AS reddedilen_talep,
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') AS tamamlanan_talep,
        COUNT(*) FILTER (WHERE durum = 'iptal_edildi') AS iptal_edilen_talep
      FROM geri_donusum_talepleri
    `),

    pool.query(`
      SELECT
        COUNT(*) AS bugunku_toplama_kaydi,
        COUNT(*) FILTER (WHERE durum = 'toplandi') AS bugun_toplanan,
        COUNT(*) FILTER (WHERE durum = 'atlanildi') AS bugun_atlanilan
      FROM toplama_kayitlari
      WHERE (tarih_saat AT TIME ZONE 'Europe/Istanbul')::date =
            (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
    `),

    pool.query(`
      SELECT *
      FROM (
        SELECT
          'collection'::text AS type,
          tk.id,
          tk.tarih_saat AS event_time,
          CONCAT(
            COALESCE(s.ad || ' ' || s.soyad, 'Bilinmeyen şoför'),
            ' — ',
            COALESCE(k.konteyner_kodu, 'Silinmiş konteyner'),
            ' kaydı: ',
            tk.durum
          ) AS description
        FROM toplama_kayitlari tk
        LEFT JOIN soforler s ON s.id = tk.sofor_id
        LEFT JOIN konteynerler k ON k.id = tk.konteyner_id

        UNION ALL

        SELECT
          'complaint'::text,
          s.id,
          s.tarih_saat,
          CONCAT(
            COALESCE(k.konteyner_kodu, 'Konteyner'),
            ' için yeni şikâyet: ',
            s.sikayet_kategorisi
          )
        FROM sikayetler s
        LEFT JOIN konteynerler k ON k.id = s.konteyner_id
        WHERE s.aktif_mi = true

        UNION ALL

        SELECT
          'recycling'::text,
          g.id,
          g.tarih_saat,
          CONCAT(
            COALESCE(g.talep_basligi, 'Geri dönüşüm talebi'),
            ' — ',
            g.durum
          )
        FROM geri_donusum_talepleri g
      ) activities
      ORDER BY event_time DESC
      LIMIT 10
    `),
  ]);

  return {
    konteynerler: konteynerResult.rows[0],
    araclar: aracResult.rows[0],
    cavuslar: cavusResult.rows[0],
    soforler: soforResult.rows[0],
    sirketler: sirketResult.rows[0],
    sikayetler: sikayetResult.rows[0],
    geri_donusum_talepleri: geriDonusumTalepResult.rows[0],
    bugunku_toplama: bugunkuToplamaResult.rows[0],
    recent_activities: recentActivityResult.rows,
  };
}

async function getAllCavuslar(filters = {}) {
  const { search, aktif_mi, mahalle_id } = filters;
  const { page, limit, offset } = getPagination(filters);
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(c.ad_soyad ILIKE $${values.length} OR c.telefon ILIKE $${values.length})`);
  }
  if (aktif_mi !== undefined) {
    values.push(aktif_mi);
    conditions.push(`c.aktif_mi = $${values.length}`);
  }
  if (mahalle_id) {
    values.push(mahalle_id);
    conditions.push(`c.mahalle_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(`
    SELECT
      c.id,
      c.ad_soyad,
      c.telefon,
      c.aktif_mi,
      c.mahalle_id,
      m.ad AS mahalle_ad,
      (SELECT COUNT(*)::int FROM soforler s WHERE s.cavus_id = c.id) AS sofor_sayisi,
      (SELECT COUNT(*)::int FROM araclar a WHERE a.cavus_id = c.id) AS arac_sayisi,
      (SELECT COUNT(*)::int FROM konteynerler k WHERE k.cavus_id = c.id) AS konteyner_sayisi,
      c.created_at,
      c.updated_at,
      COUNT(*) OVER() AS total_count
    FROM cavuslar c
    LEFT JOIN mahalleler m ON m.id = c.mahalle_id
    ${whereClause}
    ORDER BY c.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, limit, offset]);

  return toPaginatedResult(result.rows, page, limit);
}

async function getAllSoforler(filters = {}) {
  const { search, aktif_mi, cavus_id, arac_id } = filters;
  const { page, limit, offset } = getPagination(filters);
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(CONCAT(s.ad, ' ', s.soyad) ILIKE $${values.length} OR s.telefon ILIKE $${values.length})`);
  }
  if (aktif_mi !== undefined) {
    values.push(aktif_mi);
    conditions.push(`s.aktif_mi = $${values.length}`);
  }
  if (cavus_id) {
    values.push(cavus_id);
    conditions.push(`s.cavus_id = $${values.length}`);
  }
  if (arac_id) {
    values.push(arac_id);
    conditions.push(`s.arac_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(`
    SELECT
      s.id,
      s.ad,
      s.soyad,
      CONCAT(s.ad, ' ', s.soyad) AS ad_soyad,
      s.telefon,
      s.aktif_mi,
      s.arac_id,
      a.plaka,
      a.arac_turu,
      s.cavus_id,
      c.ad_soyad AS cavus_ad_soyad,
      m.ad AS mahalle_ad,
      (SELECT COUNT(*)::int FROM toplama_kayitlari tk WHERE tk.sofor_id = s.id) AS toplama_kaydi_sayisi,
      s.created_at,
      s.updated_at,
      COUNT(*) OVER() AS total_count
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    LEFT JOIN cavuslar c ON c.id = s.cavus_id
    LEFT JOIN mahalleler m ON m.id = c.mahalle_id
    ${whereClause}
    ORDER BY s.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, limit, offset]);

  return toPaginatedResult(result.rows, page, limit);
}

function mapPersonnelDatabaseError(error) {
  if (error instanceof AppError) return error;
  if (error.code !== "23505") return error;

  if (error.constraint?.includes("normalized_phone") || error.constraint?.includes("telefon")) {
    return new AppError("Bu telefon numarası başka bir hesapta kullanılıyor.", 409);
  }
  if (error.constraint === "unique_cavus_mahalle") {
    return new AppError("Bu mahalleye zaten başka bir çavuş atanmış.", 409);
  }
  if (error.constraint?.includes("araclar_plaka")) {
    return new AppError("Bu plaka başka bir araçta kullanılıyor.", 409);
  }
  if (error.constraint?.includes("soforler_arac_id")) {
    return new AppError("Bu araç başka bir şoföre atanmış.", 409);
  }
  return new AppError("Aynı benzersiz bilgilere sahip başka bir personel kaydı var.", 409);
}

async function withPersonnelTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapPersonnelDatabaseError(error);
  } finally {
    client.release();
  }
}

async function assertMahalleExists(client, mahalleId) {
  const result = await client.query("SELECT id FROM mahalleler WHERE id = $1", [mahalleId]);
  if (result.rowCount === 0) throw new AppError("Mahalle bulunamadı.", 400);
}

async function assertSoforAssignment(client, cavusId, aracId, soforId = 0) {
  const result = await client.query(
    `
    SELECT a.id
    FROM araclar a
    JOIN cavuslar c ON c.id = a.cavus_id
    WHERE a.id = $1
      AND a.cavus_id = $2
      AND a.aktif_mi = true
      AND c.aktif_mi = true
      AND NOT EXISTS (
        SELECT 1 FROM soforler s
        WHERE s.arac_id = a.id AND s.id <> $3
      )
    `,
    [aracId, cavusId, soforId]
  );
  if (result.rowCount === 0) {
    throw new AppError(
      "Araç aktif değil, seçilen çavuşa ait değil veya başka bir şoföre atanmış.",
      409
    );
  }
}

async function getCavusById(queryable, id) {
  const result = await queryable.query(
    `
    SELECT c.id, c.ad_soyad, c.telefon, c.mahalle_id, m.ad AS mahalle_ad,
           c.aktif_mi, c.created_at, c.updated_at,
           (SELECT COUNT(*)::int FROM soforler s WHERE s.cavus_id = c.id) AS sofor_sayisi,
           (SELECT COUNT(*)::int FROM araclar a WHERE a.cavus_id = c.id) AS arac_sayisi,
           (SELECT COUNT(*)::int FROM konteynerler k WHERE k.cavus_id = c.id) AS konteyner_sayisi
    FROM cavuslar c
    JOIN mahalleler m ON m.id = c.mahalle_id
    WHERE c.id = $1
    `,
    [id]
  );
  return result.rows[0];
}

async function getSoforById(queryable, id) {
  const result = await queryable.query(
    `
    SELECT s.id, s.ad, s.soyad, CONCAT(s.ad, ' ', s.soyad) AS ad_soyad,
           s.telefon, s.arac_id, a.plaka, a.arac_turu, s.cavus_id,
           c.ad_soyad AS cavus_ad_soyad, m.ad AS mahalle_ad,
           s.aktif_mi, s.created_at, s.updated_at,
           (SELECT COUNT(*)::int FROM toplama_kayitlari tk WHERE tk.sofor_id = s.id) AS toplama_kaydi_sayisi
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    LEFT JOIN cavuslar c ON c.id = s.cavus_id
    LEFT JOIN mahalleler m ON m.id = c.mahalle_id
    WHERE s.id = $1
    `,
    [id]
  );
  return result.rows[0];
}

async function createCavus(data) {
  const hashedPassword = await bcrypt.hash(data.sifre, 12);
  return withPersonnelTransaction(async (client) => {
    await assertMahalleExists(client, data.mahalle_id);
    const result = await client.query(
      `INSERT INTO cavuslar (ad_soyad, telefon, sifre, mahalle_id, aktif_mi)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.ad_soyad, normalizePhone(data.telefon), hashedPassword, data.mahalle_id, data.aktif_mi]
    );
    return getCavusById(client, result.rows[0].id);
  });
}

async function updateCavus(id, data) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM cavuslar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Çavuş bulunamadı.", 404);

    if (data.mahalle_id && data.mahalle_id !== current.rows[0].mahalle_id) {
      await assertMahalleExists(client, data.mahalle_id);
      const linked = await client.query(
        "SELECT COUNT(*)::int AS count FROM konteynerler WHERE cavus_id = $1 AND aktif_mi = true",
        [id]
      );
      if (linked.rows[0].count > 0) {
        throw new AppError(
          "Aktif konteynerleri bulunan çavuşun mahallesi değiştirilemez. Önce konteyner atamalarını düzenleyin.",
          409
        );
      }
    }

    const fields = [];
    const values = [];
    for (const field of ["ad_soyad", "telefon", "mahalle_id"]) {
      if (data[field] === undefined) continue;
      values.push(field === "telefon" ? normalizePhone(data[field]) : data[field]);
      fields.push(`${field} = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE cavuslar SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
    return getCavusById(client, id);
  });
}

async function updateCavusDurum(id, aktifMi) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT id FROM cavuslar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Çavuş bulunamadı.", 404);

    let etkilenenSoforSayisi = 0;
    if (!aktifMi) {
      const drivers = await client.query(
        "UPDATE soforler SET aktif_mi = false, arac_id = NULL WHERE cavus_id = $1 AND aktif_mi = true RETURNING id",
        [id]
      );
      etkilenenSoforSayisi = drivers.rowCount;
    }
    await client.query("UPDATE cavuslar SET aktif_mi = $1 WHERE id = $2", [aktifMi, id]);
    return { ...(await getCavusById(client, id)), etkilenen_sofor_sayisi: etkilenenSoforSayisi };
  });
}

async function resetCavusPassword(id, password) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await pool.query(
    "UPDATE cavuslar SET sifre = $1 WHERE id = $2 RETURNING id, updated_at",
    [hashedPassword, id]
  );
  if (result.rowCount === 0) throw new AppError("Çavuş bulunamadı.", 404);
  return result.rows[0];
}

async function deleteCavus(id) {
  return withPersonnelTransaction(async (client) => {
    const person = await getCavusById(client, id);
    if (!person) throw new AppError("Çavuş bulunamadı.", 404);
    if (person.aktif_mi) throw new AppError("Kalıcı silmeden önce çavuşu pasife alın.", 409);
    if (person.sofor_sayisi || person.arac_sayisi || person.konteyner_sayisi) {
      throw new AppError(
        `Çavuş kalıcı silinemez: ${person.sofor_sayisi} şoför, ${person.arac_sayisi} araç ve ${person.konteyner_sayisi} konteyner bağlantısı var.`,
        409
      );
    }
    await client.query("DELETE FROM cavuslar WHERE id = $1", [id]);
    return { id: Number(id) };
  });
}

async function createSofor(data) {
  const hashedPassword = await bcrypt.hash(data.sifre, 12);
  return withPersonnelTransaction(async (client) => {
    await assertSoforAssignment(client, data.cavus_id, data.arac_id);
    const result = await client.query(
      `INSERT INTO soforler (ad, soyad, telefon, sifre, arac_id, cavus_id, aktif_mi)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.ad, data.soyad, normalizePhone(data.telefon), hashedPassword, data.arac_id, data.cavus_id, data.aktif_mi]
    );
    return getSoforById(client, result.rows[0].id);
  });
}

async function updateSofor(id, data) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM soforler WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Şoför bulunamadı.", 404);
    const existing = current.rows[0];
    const finalCavusId = data.cavus_id ?? existing.cavus_id;
    const finalAracId = data.arac_id === undefined ? existing.arac_id : data.arac_id;
    if (finalAracId) {
      await assertSoforAssignment(client, finalCavusId, finalAracId, Number(id));
    } else if (existing.aktif_mi) {
      throw new AppError("Aktif şoför araçsız bırakılamaz. Önce şoförü pasife alın.", 409);
    }

    const fields = [];
    const values = [];
    for (const field of ["ad", "soyad", "telefon", "cavus_id", "arac_id"]) {
      if (data[field] === undefined) continue;
      values.push(field === "telefon" ? normalizePhone(data[field]) : data[field]);
      fields.push(`${field} = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE soforler SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
    return getSoforById(client, id);
  });
}

async function updateSoforDurum(id, aktifMi) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM soforler WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Şoför bulunamadı.", 404);
    if (aktifMi) {
      if (!current.rows[0].arac_id) {
        throw new AppError("Şoförü etkinleştirmeden önce bir araç atayın.", 409);
      }
      await assertSoforAssignment(client, current.rows[0].cavus_id, current.rows[0].arac_id, Number(id));
      await client.query("UPDATE soforler SET aktif_mi = true WHERE id = $1", [id]);
    } else {
      await client.query("UPDATE soforler SET aktif_mi = false, arac_id = NULL WHERE id = $1", [id]);
    }
    return getSoforById(client, id);
  });
}

async function resetSoforPassword(id, password) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await pool.query(
    "UPDATE soforler SET sifre = $1 WHERE id = $2 RETURNING id, updated_at",
    [hashedPassword, id]
  );
  if (result.rowCount === 0) throw new AppError("Şoför bulunamadı.", 404);
  return result.rows[0];
}

async function deleteSofor(id) {
  return withPersonnelTransaction(async (client) => {
    const person = await getSoforById(client, id);
    if (!person) throw new AppError("Şoför bulunamadı.", 404);
    if (person.aktif_mi) throw new AppError("Kalıcı silmeden önce şoförü pasife alın.", 409);
    if (person.toplama_kaydi_sayisi) {
      throw new AppError(
        `Şoförün ${person.toplama_kaydi_sayisi} geçmiş toplama kaydı bulunduğu için kalıcı silinemez.`,
        409
      );
    }
    await client.query("DELETE FROM soforler WHERE id = $1", [id]);
    return { id: Number(id) };
  });
}

async function getAllSirketler(filters = {}) {
  const { onay_durumu, aktif_mi } = filters;
  const { page, limit, offset } = getPagination(filters);

  const values = [];
  const conditions = [];

  if (onay_durumu) {
    values.push(onay_durumu);
    conditions.push(`s.onay_durumu = $${values.length}`);
  }

  if (aktif_mi !== undefined) {
    values.push(aktif_mi);
    conditions.push(`s.aktif_mi = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.ad,
      s.adres,
      s.mail,
      s.telefon,
      s.onay_durumu,
      s.aktif_mi,
      s.created_at,
      s.updated_at,
      COUNT(*) OVER() AS total_count
    FROM sirketler s
    ${whereClause}
    ORDER BY s.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function updateSirketOnayDurumu(id, data) {
  const { onay_durumu } = data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT onay_durumu FROM sirketler WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentStatus = currentResult.rows[0].onay_durumu;
    if (!canTransition("sirket", currentStatus, onay_durumu)) {
      throw new AppError(
        `${currentStatus} durumundan ${onay_durumu} durumuna geçilemez.`,
        409
      );
    }

    const result = await client.query(
      `
      UPDATE sirketler
      SET onay_durumu = $1,
          aktif_mi = CASE WHEN $1 = 'pasif' THEN false ELSE true END
      WHERE id = $2
      RETURNING
        id, ad, adres, mail, telefon, onay_durumu,
        aktif_mi, created_at, updated_at
      `,
      [onay_durumu, id]
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

async function getAllKonteynerler(filters = {}) {
  const { tur, mahalle_id, aktif_mi } = filters;
  const { page, limit, offset } = getPagination(filters);

  const values = [];
  const conditions = [];

  if (tur) {
    values.push(tur);
    conditions.push(`k.tur = $${values.length}`);
  }

  if (mahalle_id) {
    values.push(mahalle_id);
    conditions.push(`k.mahalle_id = $${values.length}`);
  }

  if (aktif_mi !== undefined) {
    values.push(aktif_mi);
    conditions.push(`k.aktif_mi = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      k.id,
      k.konteyner_kodu,
      k.tur,
      k.latitude,
      k.longitude,
      k.aktif_mi,
      k.adres,
      k.kapasite_litre,
      k.yerlesim_notu,
      k.kurulum_tarihi,
      k.mahalle_id,
      m.ad AS mahalle_ad,
      k.cavus_id,
      c.ad_soyad AS cavus_ad_soyad,
      c.aktif_mi AS cavus_aktif_mi,
      g.id AS aktif_gorev_id,
      g.sofor_id AS gorev_sofor_id,
      CONCAT(gs.ad, ' ', gs.soyad) AS gorev_sofor_ad_soyad,
      ga.plaka AS gorev_arac_plaka,
      g.oncelik AS gorev_oncelik,
      g.durum AS gorev_durum,
      g.hedef_tarih AS gorev_hedef_tarih,
      (g.hedef_tarih IS NOT NULL AND g.hedef_tarih < CURRENT_TIMESTAMP) AS gorev_gecikti_mi,
      (SELECT MAX(tk.tarih_saat) FROM toplama_kayitlari tk
        WHERE tk.konteyner_id = k.id AND tk.durum = 'toplandi') AS son_toplanma_tarihi,
      (SELECT COUNT(*)::int FROM sikayetler sk
        WHERE sk.konteyner_id = k.id AND sk.aktif_mi = true AND sk.durum IN ('bekliyor','inceleniyor')) AS acik_sikayet_sayisi,
      ${healthExpression("k")} AS saglik_durumu,
      k.created_at,
      k.updated_at,
      COUNT(*) OVER() AS total_count
    FROM konteynerler k
    LEFT JOIN mahalleler m ON m.id = k.mahalle_id
    LEFT JOIN cavuslar c ON c.id = k.cavus_id
    LEFT JOIN LATERAL (
      SELECT kg.* FROM konteyner_gorevleri kg
      WHERE kg.konteyner_id = k.id AND kg.durum IN ('atandi', 'devam_ediyor')
      ORDER BY kg.created_at DESC LIMIT 1
    ) g ON true
    LEFT JOIN soforler gs ON gs.id = g.sofor_id
    LEFT JOIN araclar ga ON ga.id = g.arac_id
    ${whereClause}
    ORDER BY k.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function getAllAraclar(filters = {}) {
  const { search, arac_turu, cavus_id, aktif_mi, atama_durumu } = filters;
  const { page, limit, offset } = getPagination(filters);

  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(a.plaka ILIKE $${values.length} OR c.ad_soyad ILIKE $${values.length} OR CONCAT(s.ad, ' ', s.soyad) ILIKE $${values.length})`);
  }

  if (arac_turu) {
    values.push(arac_turu);
    conditions.push(`a.arac_turu = $${values.length}`);
  }

  if (cavus_id) {
    values.push(cavus_id);
    conditions.push(`a.cavus_id = $${values.length}`);
  }

  if (aktif_mi !== undefined) {
    values.push(aktif_mi);
    conditions.push(`a.aktif_mi = $${values.length}`);
  }

  if (atama_durumu === "atanmis") conditions.push("s.id IS NOT NULL");
  if (atama_durumu === "bosta") conditions.push("s.id IS NULL");

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      a.id,
      a.plaka,
      a.arac_turu,
      a.aktif_mi,
      a.cavus_id,
      c.ad_soyad AS cavus_ad_soyad,
      c.aktif_mi AS cavus_aktif_mi,
      m.ad AS mahalle_ad,
      s.id AS sofor_id,
      CONCAT(s.ad, ' ', s.soyad) AS sofor_ad_soyad,
      s.aktif_mi AS sofor_aktif_mi,
      (s.id IS NULL) AS bosta_mi,
      (a.aktif_mi = false AND s.id IS NULL) AS silinebilir_mi,
      a.created_at,
      a.updated_at,
      COUNT(*) OVER() AS total_count
    FROM araclar a
    LEFT JOIN cavuslar c ON c.id = a.cavus_id
    LEFT JOIN mahalleler m ON m.id = c.mahalle_id
    LEFT JOIN soforler s ON s.arac_id = a.id
    ${whereClause}
    ORDER BY a.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function getAracById(queryable, id) {
  const result = await queryable.query(
    `SELECT a.id, a.plaka, a.arac_turu, a.aktif_mi, a.cavus_id,
            c.ad_soyad AS cavus_ad_soyad, c.aktif_mi AS cavus_aktif_mi,
            m.ad AS mahalle_ad, s.id AS sofor_id,
            CONCAT(s.ad, ' ', s.soyad) AS sofor_ad_soyad,
            s.aktif_mi AS sofor_aktif_mi, (s.id IS NULL) AS bosta_mi,
            (a.aktif_mi = false AND s.id IS NULL) AS silinebilir_mi,
            a.created_at, a.updated_at
       FROM araclar a
       LEFT JOIN cavuslar c ON c.id = a.cavus_id
       LEFT JOIN mahalleler m ON m.id = c.mahalle_id
       LEFT JOIN soforler s ON s.arac_id = a.id
      WHERE a.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function assertAracCavus(client, cavusId, requireActive = true) {
  const result = await client.query(
    "SELECT id, ad_soyad, aktif_mi FROM cavuslar WHERE id = $1",
    [cavusId]
  );
  if (result.rowCount === 0) throw new AppError("Çavuş bulunamadı.", 400);
  if (requireActive && !result.rows[0].aktif_mi) {
    throw new AppError("Aktif araç yalnızca aktif bir çavuşa bağlanabilir.", 409);
  }
  return result.rows[0];
}

async function createArac(data) {
  return withPersonnelTransaction(async (client) => {
    await assertAracCavus(client, data.cavus_id, data.aktif_mi);
    const result = await client.query(
      `INSERT INTO araclar (plaka, arac_turu, cavus_id, aktif_mi)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [data.plaka, data.arac_turu, data.cavus_id, data.aktif_mi]
    );
    return getAracById(client, result.rows[0].id);
  });
}

async function updateArac(id, data) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM araclar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Araç bulunamadı.", 404);
    const existing = current.rows[0];
    const finalCavusId = data.cavus_id ?? existing.cavus_id;
    if (data.cavus_id !== undefined) {
      await assertAracCavus(client, finalCavusId, existing.aktif_mi);
    }

    const fields = [];
    const values = [];
    for (const field of ["plaka", "arac_turu", "cavus_id"]) {
      if (data[field] === undefined) continue;
      values.push(data[field]);
      fields.push(`${field} = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE araclar SET ${fields.join(", ")} WHERE id = $${values.length}`, values);

    let tasinanSoforSayisi = 0;
    if (data.cavus_id !== undefined && data.cavus_id !== existing.cavus_id) {
      const moved = await client.query(
        "UPDATE soforler SET cavus_id = $1 WHERE arac_id = $2 RETURNING id",
        [data.cavus_id, id]
      );
      tasinanSoforSayisi = moved.rowCount;
    }
    return { ...(await getAracById(client, id)), tasinan_sofor_sayisi: tasinanSoforSayisi };
  });
}

async function updateAracDurum(id, aktifMi) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM araclar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Araç bulunamadı.", 404);
    if (aktifMi) await assertAracCavus(client, current.rows[0].cavus_id, true);

    let etkilenenSoforSayisi = 0;
    if (!aktifMi) {
      const detached = await client.query(
        "UPDATE soforler SET aktif_mi = false, arac_id = NULL WHERE arac_id = $1 RETURNING id",
        [id]
      );
      etkilenenSoforSayisi = detached.rowCount;
    }
    await client.query("UPDATE araclar SET aktif_mi = $1 WHERE id = $2", [aktifMi, id]);
    return { ...(await getAracById(client, id)), etkilenen_sofor_sayisi: etkilenenSoforSayisi };
  });
}

async function updateAracAtama(id, data) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM araclar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Araç bulunamadı.", 404);
    if (!current.rows[0].aktif_mi && data.sofor_id) {
      throw new AppError("Pasif araca şoför atanamaz. Önce aracı etkinleştirin.", 409);
    }
    await assertAracCavus(client, data.cavus_id, current.rows[0].aktif_mi);

    const currentDriver = await client.query("SELECT id FROM soforler WHERE arac_id = $1 FOR UPDATE", [id]);
    if (data.sofor_id) {
      const target = await client.query("SELECT id, arac_id FROM soforler WHERE id = $1 FOR UPDATE", [data.sofor_id]);
      if (target.rowCount === 0) throw new AppError("Şoför bulunamadı.", 400);
      if (target.rows[0].arac_id && Number(target.rows[0].arac_id) !== Number(id)) {
        throw new AppError("Seçilen şoför başka bir araca atanmış. Önce mevcut araç atamasını kaldırın.", 409);
      }
      if (currentDriver.rowCount && Number(currentDriver.rows[0].id) !== Number(data.sofor_id)) {
        await client.query("UPDATE soforler SET aktif_mi = false, arac_id = NULL WHERE id = $1", [currentDriver.rows[0].id]);
      }
      await client.query(
        "UPDATE soforler SET cavus_id = $1, arac_id = $2, aktif_mi = true WHERE id = $3",
        [data.cavus_id, id, data.sofor_id]
      );
    } else if (currentDriver.rowCount) {
      await client.query("UPDATE soforler SET aktif_mi = false, arac_id = NULL WHERE id = $1", [currentDriver.rows[0].id]);
    }
    await client.query("UPDATE araclar SET cavus_id = $1 WHERE id = $2", [data.cavus_id, id]);
    return getAracById(client, id);
  });
}

async function deleteArac(id) {
  return withPersonnelTransaction(async (client) => {
    const current = await client.query("SELECT * FROM araclar WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Araç bulunamadı.", 404);
    if (current.rows[0].aktif_mi) throw new AppError("Kalıcı silmeden önce aracı pasife alın.", 409);
    const linked = await client.query("SELECT id FROM soforler WHERE arac_id = $1", [id]);
    if (linked.rowCount) throw new AppError("Şoföre bağlı araç kalıcı olarak silinemez.", 409);
    await client.query("DELETE FROM araclar WHERE id = $1", [id]);
    return { id: Number(id) };
  });
}

async function getAllToplamaKayitlari(filters = {}) {
  const { durum, sofor_id, konteyner_id, mahalle_id, date_from, date_to } =
    filters;
  const { page, limit, offset } = getPagination(filters);

  const values = [];
  const conditions = [];

  if (durum) {
    values.push(durum);
    conditions.push(`tk.durum = $${values.length}`);
  }

  if (sofor_id) {
    values.push(sofor_id);
    conditions.push(`tk.sofor_id = $${values.length}`);
  }

  if (konteyner_id) {
    values.push(konteyner_id);
    conditions.push(`tk.konteyner_id = $${values.length}`);
  }

  if (mahalle_id) {
    values.push(mahalle_id);
    conditions.push(`k.mahalle_id = $${values.length}`);
  }

  if (date_from) {
    values.push(date_from);
    conditions.push(
      `(tk.tarih_saat AT TIME ZONE 'Europe/Istanbul')::date >= $${values.length}`
    );
  }

  if (date_to) {
    values.push(date_to);
    conditions.push(
      `(tk.tarih_saat AT TIME ZONE 'Europe/Istanbul')::date <= $${values.length}`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      tk.id,
      tk.konteyner_id,
      k.konteyner_kodu,
      k.tur AS konteyner_turu,
      m.ad AS mahalle_ad,
      tk.sofor_id,
      CONCAT(s.ad, ' ', s.soyad) AS sofor_ad_soyad,
      a.plaka,
      a.arac_turu,
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
    LEFT JOIN soforler s ON s.id = tk.sofor_id
    LEFT JOIN araclar a ON a.id = s.arac_id
    ${whereClause}
    ORDER BY tk.tarih_saat DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

module.exports = {
  getDashboard,
  getAllCavuslar,
  getAllSoforler,
  createCavus,
  updateCavus,
  updateCavusDurum,
  resetCavusPassword,
  deleteCavus,
  createSofor,
  updateSofor,
  updateSoforDurum,
  resetSoforPassword,
  deleteSofor,
  getAllSirketler,
  updateSirketOnayDurumu,
  getAllKonteynerler,
  getAllAraclar,
  createArac,
  updateArac,
  updateAracDurum,
  updateAracAtama,
  deleteArac,
  getAllToplamaKayitlari,
};
