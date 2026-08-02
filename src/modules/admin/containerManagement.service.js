const pool = require("../../config/db");
const AppError = require("../../utils/AppError");
const { recordActivity, getTimeline } = require("../../services/activity.service");
const qrcode = require("qrcode-generator");

function healthExpression(alias = "k") {
  return `CASE
    WHEN EXISTS (SELECT 1 FROM konteyner_gorevleri gx WHERE gx.konteyner_id = ${alias}.id AND gx.durum IN ('atandi','devam_ediyor') AND gx.hedef_tarih < CURRENT_TIMESTAMP)
      OR (SELECT COUNT(*) FROM sikayetler sx WHERE sx.konteyner_id = ${alias}.id AND sx.aktif_mi AND sx.durum IN ('bekliyor','inceleniyor')) >= 2
      OR ((SELECT MAX(tx.tarih_saat) FROM toplama_kayitlari tx WHERE tx.konteyner_id = ${alias}.id AND tx.durum = 'toplandi') IS NOT NULL
          AND CURRENT_TIMESTAMP - (SELECT MAX(tx.tarih_saat) FROM toplama_kayitlari tx WHERE tx.konteyner_id = ${alias}.id AND tx.durum = 'toplandi') > INTERVAL '7 days')
      THEN 'kirmizi'
    WHEN (SELECT COUNT(*) FROM sikayetler sx WHERE sx.konteyner_id = ${alias}.id AND sx.aktif_mi AND sx.durum IN ('bekliyor','inceleniyor')) = 1
      OR (SELECT MAX(tx.tarih_saat) FROM toplama_kayitlari tx WHERE tx.konteyner_id = ${alias}.id AND tx.durum = 'toplandi') IS NULL
      OR CURRENT_TIMESTAMP - (SELECT MAX(tx.tarih_saat) FROM toplama_kayitlari tx WHERE tx.konteyner_id = ${alias}.id AND tx.durum = 'toplandi') > INTERVAL '3 days'
      THEN 'sari' ELSE 'yesil' END`;
}

async function assertCavus(queryable, cavusId, mahalleId, allowDifferent = false) {
  if (!cavusId) return;
  const result = await queryable.query("SELECT id, mahalle_id, aktif_mi FROM cavuslar WHERE id = $1", [cavusId]);
  if (!result.rowCount) throw new AppError("Çavuş bulunamadı.", 404);
  if (!result.rows[0].aktif_mi) throw new AppError("Konteyner pasif bir çavuşa bağlanamaz.", 409);
  if (mahalleId && result.rows[0].mahalle_id !== mahalleId && !allowDifferent) {
    throw new AppError("Çavuş farklı mahalleden sorumlu. Farklı mahalle onayı gereklidir.", 409);
  }
}

async function createContainer(admin, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertCavus(client, data.cavus_id, data.mahalle_id, data.farkli_mahalle_onayi);
    const near = await client.query(
      `SELECT id, konteyner_kodu,
              6371000 * acos(LEAST(1, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS mesafe
         FROM konteynerler WHERE aktif_mi = true
        ORDER BY mesafe ASC LIMIT 1`,
      [data.latitude, data.longitude]
    );
    if (near.rows[0] && Number(near.rows[0].mesafe) < 20 && !data.yakin_konteyner_onayi) {
      throw new AppError(`Yaklaşık ${Math.round(near.rows[0].mesafe)} metre mesafede ${near.rows[0].konteyner_kodu} bulunuyor. Yakın konteyner onayı gereklidir.`, 409);
    }
    const code = data.konteyner_kodu || `KNT-${Date.now().toString(36).toUpperCase()}`;
    const result = await client.query(
      `INSERT INTO konteynerler
         (konteyner_kodu, tur, mahalle_id, cavus_id, latitude, longitude, adres, kapasite_litre, yerlesim_notu, kurulum_tarihi, aktif_mi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [code, data.tur, data.mahalle_id, data.cavus_id, data.latitude, data.longitude,
        data.adres || null, data.kapasite_litre || null, data.yerlesim_notu || null, data.kurulum_tarihi || null, data.aktif_mi]
    );
    await recordActivity(client, { actorRole: "admin", actorId: admin.id, actorName: admin.ad_soyad,
      entityType: "konteyner", entityId: result.rows[0].id, action: "container.created", summary: `${code} konteyneri oluşturuldu.` });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw new AppError("Konteyner kodu zaten kullanılıyor.", 409);
    throw error;
  } finally { client.release(); }
}

async function updateContainer(admin, id, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM konteynerler WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rowCount) throw new AppError("Konteyner bulunamadı.", 404);
    const mahalleId = data.mahalle_id ?? current.rows[0].mahalle_id;
    const cavusId = data.cavus_id !== undefined ? data.cavus_id : current.rows[0].cavus_id;
    await assertCavus(client, cavusId, mahalleId, data.farkli_mahalle_onayi);
    const allowed = ["konteyner_kodu", "tur", "mahalle_id", "cavus_id", "latitude", "longitude", "adres", "kapasite_litre", "yerlesim_notu", "kurulum_tarihi"];
    const fields = []; const values = [];
    for (const field of allowed) if (data[field] !== undefined) { values.push(data[field]); fields.push(`${field} = $${values.length}`); }
    values.push(id);
    const result = await client.query(`UPDATE konteynerler SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    await recordActivity(client, { actorRole: "admin", actorId: admin.id, actorName: admin.ad_soyad,
      entityType: "konteyner", entityId: Number(id), action: "container.updated", summary: `${result.rows[0].konteyner_kodu} bilgileri güncellendi.`, metadata: { changed_fields: fields.map((f) => f.split(" ")[0]) } });
    await client.query("COMMIT"); return result.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function updateContainerStatus(admin, id, active) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!active) await client.query(`UPDATE konteyner_gorevleri SET durum='iptal_edildi', iptal_nedeni='Konteyner pasife alındı.', tamamlanma_tarihi=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE konteyner_id=$1 AND durum IN ('atandi','devam_ediyor')`, [id]);
    const result = await client.query("UPDATE konteynerler SET aktif_mi=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *", [active, id]);
    if (!result.rowCount) throw new AppError("Konteyner bulunamadı.", 404);
    await recordActivity(client, { actorRole: "admin", actorId: admin.id, actorName: admin.ad_soyad,
      entityType: "konteyner", entityId: Number(id), action: active ? "container.activated" : "container.deactivated", summary: `${result.rows[0].konteyner_kodu} ${active ? "aktif" : "pasif"} duruma alındı.` });
    await client.query("COMMIT"); return result.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function getContainerDetail(id) {
  const result = await pool.query(
    `SELECT k.*, m.ad AS mahalle_ad, m.ilce, m.il, c.ad_soyad AS cavus_ad_soyad,
            ${healthExpression("k")} AS saglik_durumu,
            (SELECT MAX(t.tarih_saat) FROM toplama_kayitlari t WHERE t.konteyner_id=k.id AND t.durum='toplandi') AS son_toplanma_tarihi,
            (SELECT COUNT(*)::int FROM toplama_kayitlari t WHERE t.konteyner_id=k.id AND t.durum='toplandi' AND t.tarih_saat >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS son_30_gun_toplama_sayisi,
            (SELECT COUNT(*)::int FROM toplama_kayitlari t WHERE t.konteyner_id=k.id AND t.durum='atlanildi') AS atlanma_sayisi,
            (SELECT COUNT(*)::int FROM sikayetler s WHERE s.konteyner_id=k.id AND s.aktif_mi AND s.durum IN ('bekliyor','inceleniyor')) AS acik_sikayet_sayisi,
            g.id AS aktif_gorev_id, g.durum AS gorev_durum, g.oncelik AS gorev_oncelik, g.hedef_tarih,
            CONCAT(sf.ad,' ',sf.soyad) AS gorev_sofor_ad_soyad, a.plaka AS gorev_arac_plaka
       FROM konteynerler k JOIN mahalleler m ON m.id=k.mahalle_id LEFT JOIN cavuslar c ON c.id=k.cavus_id
       LEFT JOIN LATERAL (SELECT * FROM konteyner_gorevleri x WHERE x.konteyner_id=k.id AND x.durum IN ('atandi','devam_ediyor') ORDER BY x.created_at DESC LIMIT 1) g ON true
       LEFT JOIN soforler sf ON sf.id=g.sofor_id LEFT JOIN araclar a ON a.id=g.arac_id WHERE k.id=$1`, [id]);
  if (!result.rowCount) throw new AppError("Konteyner bulunamadı.", 404);
  const [complaints, collections, timeline] = await Promise.all([
    pool.query("SELECT id, sikayet_kategorisi, sikayet_metni, durum, tarih_saat FROM sikayetler WHERE konteyner_id=$1 ORDER BY tarih_saat DESC LIMIT 10", [id]),
    pool.query("SELECT t.id,t.durum,t.sebep,t.tarih_saat,t.latitude,t.longitude,t.kanit_fotografi_url, CONCAT(s.ad,' ',s.soyad) AS sofor_ad_soyad FROM toplama_kayitlari t LEFT JOIN soforler s ON s.id=t.sofor_id WHERE t.konteyner_id=$1 ORDER BY t.tarih_saat DESC LIMIT 10", [id]),
    getTimeline("konteyner", Number(id)),
  ]);
  return { ...result.rows[0], sikayetler: complaints.rows, toplama_kayitlari: collections.rows, islem_gecmisi: timeline };
}

async function deleteContainer(admin, id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT id, konteyner_kodu, aktif_mi FROM konteynerler WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rowCount) throw new AppError("Konteyner bulunamadı.", 404);
    if (current.rows[0].aktif_mi) throw new AppError("Kalıcı silmeden önce konteyner pasife alınmalıdır.", 409);
    const tasks = await client.query("SELECT COUNT(*)::int AS count FROM konteyner_gorevleri WHERE konteyner_id=$1", [id]);
    if (tasks.rows[0].count > 0) throw new AppError("Görev geçmişi bulunan konteyner kalıcı silinemez; arşiv olarak pasif tutulmalıdır.", 409);
    await client.query("UPDATE toplama_kayitlari SET konteyner_id=NULL WHERE konteyner_id=$1", [id]);
    await client.query("UPDATE sikayetler SET konteyner_id=NULL WHERE konteyner_id=$1", [id]);
    await client.query("DELETE FROM konteynerler WHERE id=$1", [id]);
    await recordActivity(client, { actorRole: "admin", actorId: admin.id, actorName: admin.ad_soyad,
      entityType: "konteyner", entityId: Number(id), action: "container.deleted", summary: `${current.rows[0].konteyner_kodu} konteyneri kalıcı olarak silindi.`, metadata: { container_code: current.rows[0].konteyner_kodu } });
    await client.query("COMMIT");
    return { id: Number(id), konteyner_kodu: current.rows[0].konteyner_kodu };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function createContainerQr(id, target) {
  const container = await pool.query("SELECT id, konteyner_kodu FROM konteynerler WHERE id=$1", [id]);
  if (!container.rowCount) throw new AppError("Konteyner bulunamadı.", 404);
  const qr = qrcode(0, "M");
  qr.addData(target);
  qr.make();
  return { konteyner_kodu: container.rows[0].konteyner_kodu, svg: qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true }) };
}

module.exports = { healthExpression, createContainer, updateContainer, updateContainerStatus, getContainerDetail, deleteContainer, createContainerQr };
