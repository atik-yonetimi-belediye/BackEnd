const pool = require("../../config/db");
const AppError = require("../../utils/AppError");
const { getPagination, toPaginatedResult } = require("../../utils/pagination");
const { recordActivity } = require("../../services/activity.service");

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && error.constraint === "unique_konteyner_acik_gorev") {
      throw new AppError("Bu konteyner için zaten devam eden bir görev var.", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getTaskById(queryable, id) {
  const result = await queryable.query(
    `SELECT g.id, g.konteyner_id, k.konteyner_kodu, k.tur AS konteyner_turu,
            k.mahalle_id, m.ad AS mahalle_ad, k.latitude, k.longitude,
            g.cavus_id, c.ad_soyad AS cavus_ad_soyad,
            g.sofor_id, CONCAT(s.ad, ' ', s.soyad) AS sofor_ad_soyad,
            g.arac_id, a.plaka, a.arac_turu, g.atayan_yonetici_id, g.atayan_cavus_id,
            g.oncelik, g.durum, g.hedef_tarih, g.yonetici_notu,
            g.baslama_tarihi, g.tamamlanma_tarihi, g.iptal_nedeni,
            (g.hedef_tarih IS NOT NULL AND g.hedef_tarih < CURRENT_TIMESTAMP
             AND g.durum IN ('atandi', 'devam_ediyor')) AS gecikti_mi,
            g.created_at, g.updated_at
       FROM konteyner_gorevleri g
       JOIN konteynerler k ON k.id = g.konteyner_id
       JOIN mahalleler m ON m.id = k.mahalle_id
       JOIN cavuslar c ON c.id = g.cavus_id
       JOIN soforler s ON s.id = g.sofor_id
       JOIN araclar a ON a.id = g.arac_id
      WHERE g.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getContainerTasks(containerId, filters = {}) {
  const { page, limit, offset } = getPagination(filters);
  const values = [containerId];
  const conditions = ["g.konteyner_id = $1"];
  if (filters.durum) {
    values.push(filters.durum);
    conditions.push(`g.durum = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT g.id, g.konteyner_id, g.cavus_id, c.ad_soyad AS cavus_ad_soyad,
            g.sofor_id, CONCAT(s.ad, ' ', s.soyad) AS sofor_ad_soyad,
            g.arac_id, a.plaka, g.oncelik, g.durum, g.hedef_tarih,
            g.yonetici_notu, g.baslama_tarihi, g.tamamlanma_tarihi,
            g.iptal_nedeni,
            (g.hedef_tarih IS NOT NULL AND g.hedef_tarih < CURRENT_TIMESTAMP
             AND g.durum IN ('atandi', 'devam_ediyor')) AS gecikti_mi,
            g.created_at, g.updated_at, COUNT(*) OVER() AS total_count
       FROM konteyner_gorevleri g
       JOIN cavuslar c ON c.id = g.cavus_id
       JOIN soforler s ON s.id = g.sofor_id
       JOIN araclar a ON a.id = g.arac_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY g.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  return toPaginatedResult(result.rows, page, limit);
}

async function getEligibleDrivers(containerId, scopeCavusId = null) {
  const container = await pool.query(
    `SELECT k.id, k.tur, k.cavus_id, k.mahalle_id, k.aktif_mi,
            c.ad_soyad AS cavus_ad_soyad
       FROM konteynerler k LEFT JOIN cavuslar c ON c.id = k.cavus_id
      WHERE k.id = $1`,
    [containerId]
  );
  if (container.rowCount === 0) throw new AppError("Konteyner bulunamadı.", 404);
  const item = container.rows[0];
  if (scopeCavusId && item.cavus_id !== Number(scopeCavusId)) {
    throw new AppError("Bu konteyner sorumluluk alanınızda değil.", 403);
  }
  const drivers = await pool.query(
    `SELECT s.id, CONCAT(s.ad, ' ', s.soyad) AS ad_soyad, s.cavus_id,
            c.ad_soyad AS cavus_ad_soyad, c.mahalle_id AS cavus_mahalle_id,
            s.arac_id, a.plaka, a.arac_turu,
            s.aktif_mi, a.aktif_mi AS arac_aktif_mi, c.aktif_mi AS cavus_aktif_mi,
            (SELECT COUNT(*)::int FROM konteyner_gorevleri g
              WHERE g.sofor_id = s.id AND g.durum IN ('atandi', 'devam_ediyor')) AS acik_gorev_sayisi
       FROM soforler s
       LEFT JOIN cavuslar c ON c.id = s.cavus_id
       LEFT JOIN araclar a ON a.id = s.arac_id
      WHERE ($1::int IS NULL OR s.cavus_id = $1)
      ORDER BY acik_gorev_sayisi ASC, s.id ASC`,
    [scopeCavusId]
  );
  return {
    konteyner: item,
    soforler: drivers.rows.map((driver) => {
      let uygun_degil_nedeni = null;
      if (!driver.aktif_mi) uygun_degil_nedeni = "Şoför pasif.";
      else if (!driver.cavus_aktif_mi) uygun_degil_nedeni = "Bağlı çavuş pasif.";
      else if (!driver.arac_id) uygun_degil_nedeni = "Şoföre araç atanmamış.";
      else if (!driver.arac_aktif_mi) uygun_degil_nedeni = "Şoförün aracı pasif.";
      else if (driver.arac_turu !== item.tur) uygun_degil_nedeni = "Araç türü konteynerle uyumsuz.";
      return { ...driver, uygun_mi: !uygun_degil_nedeni, uygun_degil_nedeni };
    }),
  };
}

async function validateAssignment(client, containerId, data) {
  const result = await client.query(
    `SELECT k.id AS konteyner_id, k.tur, k.mahalle_id, k.cavus_id AS mevcut_cavus_id,
            k.aktif_mi AS konteyner_aktif_mi,
            c.id AS cavus_id, c.mahalle_id AS cavus_mahalle_id, c.aktif_mi AS cavus_aktif_mi,
            s.id AS sofor_id, s.cavus_id AS sofor_cavus_id, s.aktif_mi AS sofor_aktif_mi,
            a.id AS arac_id, a.arac_turu, a.aktif_mi AS arac_aktif_mi
       FROM konteynerler k
       JOIN cavuslar c ON c.id = $2
       JOIN soforler s ON s.id = $3
       LEFT JOIN araclar a ON a.id = s.arac_id
      WHERE k.id = $1 FOR UPDATE OF k`,
    [containerId, data.cavus_id, data.sofor_id]
  );
  if (result.rowCount === 0) throw new AppError("Konteyner, çavuş veya şoför bulunamadı.", 404);
  const item = result.rows[0];
  if (!item.konteyner_aktif_mi) throw new AppError("Pasif konteynere görev atanamaz.", 409);
  if (!item.cavus_aktif_mi) throw new AppError("Pasif çavuşa görev atanamaz.", 409);
  if (!item.sofor_aktif_mi) throw new AppError("Pasif şoföre görev atanamaz.", 409);
  if (item.sofor_cavus_id !== item.cavus_id) throw new AppError("Şoför seçilen çavuşa bağlı değil.", 409);
  if (!item.arac_id || !item.arac_aktif_mi) throw new AppError("Şoförün aktif aracı bulunmuyor.", 409);
  if (item.arac_turu !== item.tur) throw new AppError("Şoförün araç türü konteyner türüyle uyumsuz.", 409);
  if (item.mahalle_id !== item.cavus_mahalle_id && !data.farkli_mahalle_onayi) {
    throw new AppError("Seçilen çavuş farklı bir mahalleden sorumlu. Devam etmek için farklı mahalle onayı gereklidir.", 409);
  }
  return item;
}

async function createTaskInTransaction(client, actor, containerId, data) {
  const assignment = await validateAssignment(client, containerId, data);
  if (actor.role === "cavus" && (assignment.mevcut_cavus_id !== actor.id || assignment.cavus_id !== actor.id)) {
    throw new AppError("Yalnızca kendi sorumluluğunuzdaki konteyneri kendi şoförünüze atayabilirsiniz.", 403);
  }
  const result = await client.query(
    `INSERT INTO konteyner_gorevleri
       (konteyner_id, cavus_id, sofor_id, arac_id, atayan_yonetici_id, atayan_cavus_id,
        oncelik, hedef_tarih, yonetici_notu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [containerId, data.cavus_id, data.sofor_id, assignment.arac_id,
      actor.role === "admin" ? actor.id : null, actor.role === "cavus" ? actor.id : null,
      data.oncelik, data.hedef_tarih, data.yonetici_notu || null]
  );
  await client.query("UPDATE konteynerler SET cavus_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [data.cavus_id, containerId]);
  await recordActivity(client, {
    actorRole: actor.role, actorId: actor.id, actorName: actor.name,
    entityType: "gorev", entityId: result.rows[0].id, action: "task.assigned",
    summary: "Konteyner görevi şoföre atandı.",
    metadata: { related_entity_type: "konteyner", related_entity_id: Number(containerId), sofor_id: data.sofor_id, cavus_id: data.cavus_id },
  });
  return getTaskById(client, result.rows[0].id);
}

async function createContainerTask(actor, containerId, data) {
  return withTransaction((client) => createTaskInTransaction(client, actor, containerId, data));
}

async function createBulkContainerTasks(actor, containerIds, data) {
  return withTransaction(async (client) => {
    const tasks = [];
    for (const containerId of containerIds) tasks.push(await createTaskInTransaction(client, actor, containerId, data));
    return { toplam: tasks.length, gorevler: tasks };
  });
}

async function updateContainerCavus(containerId, data, actor = null) {
  return withTransaction(async (client) => {
    const container = await client.query("SELECT * FROM konteynerler WHERE id = $1 FOR UPDATE", [containerId]);
    if (container.rowCount === 0) throw new AppError("Konteyner bulunamadı.", 404);
    const cavus = await client.query("SELECT id, ad_soyad, mahalle_id, aktif_mi FROM cavuslar WHERE id = $1", [data.cavus_id]);
    if (cavus.rowCount === 0) throw new AppError("Çavuş bulunamadı.", 404);
    if (!cavus.rows[0].aktif_mi) throw new AppError("Konteyner pasif bir çavuşa bağlanamaz.", 409);
    if (container.rows[0].mahalle_id !== cavus.rows[0].mahalle_id && !data.farkli_mahalle_onayi) {
      throw new AppError("Seçilen çavuş farklı bir mahalleden sorumlu. Devam etmek için farklı mahalle onayı gereklidir.", 409);
    }
    const openTask = await client.query(
      "SELECT id FROM konteyner_gorevleri WHERE konteyner_id = $1 AND durum IN ('atandi', 'devam_ediyor') FOR UPDATE",
      [containerId]
    );
    if (openTask.rowCount && !data.acik_gorevi_iptal_et) {
      throw new AppError("Konteynerin açık görevi var. Sorumlu değiştirilmeden önce görevi iptal etmeyi onaylayın.", 409);
    }
    if (openTask.rowCount) {
      await client.query(
        "UPDATE konteyner_gorevleri SET durum = 'iptal_edildi', iptal_nedeni = $1, tamamlanma_tarihi = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        ["Konteyner sorumlu çavuşu değiştirildi.", openTask.rows[0].id]
      );
    }
    await client.query("UPDATE konteynerler SET cavus_id = $1 WHERE id = $2", [data.cavus_id, containerId]);
    if (actor) await recordActivity(client, { actorRole: actor.role, actorId: actor.id, actorName: actor.name, entityType: "konteyner", entityId: Number(containerId), action: "container.owner_changed", summary: `Sorumlu çavuş ${cavus.rows[0].ad_soyad} olarak değiştirildi.`, metadata: { cavus_id: data.cavus_id } });
    return { id: Number(containerId), cavus_id: data.cavus_id, cavus_ad_soyad: cavus.rows[0].ad_soyad, iptal_edilen_gorev_sayisi: openTask.rowCount };
  });
}

async function updateTask(id, data, actor = null) {
  return withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM konteyner_gorevleri WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new AppError("Görev bulunamadı.", 404);
    if (!["atandi", "devam_ediyor"].includes(current.rows[0].durum)) throw new AppError("Tamamlanmış veya iptal edilmiş görev düzenlenemez.", 409);
    const fields = [];
    const values = [];
    for (const field of ["oncelik", "hedef_tarih", "yonetici_notu"]) {
      if (data[field] === undefined) continue;
      values.push(data[field]);
      fields.push(`${field} = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE konteyner_gorevleri SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
    if (actor) await recordActivity(client, { actorRole: actor.role, actorId: actor.id, actorName: actor.name, entityType: "gorev", entityId: Number(id), action: "task.updated", summary: "Görev bilgileri güncellendi.", metadata: { related_entity_type: "konteyner", related_entity_id: current.rows[0].konteyner_id } });
    return getTaskById(client, id);
  });
}

async function cancelTask(id, reason, actor = null, scopeCavusId = null) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE konteyner_gorevleri
          SET durum = 'iptal_edildi', iptal_nedeni = $1,
              tamamlanma_tarihi = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND durum IN ('atandi', 'devam_ediyor')
          AND ($3::int IS NULL OR cavus_id = $3) RETURNING id`,
      [reason || (scopeCavusId ? "Çavuş tarafından iptal edildi." : "Yönetici tarafından iptal edildi."), id, scopeCavusId]
    );
    if (result.rowCount === 0) throw new AppError("Açık görev bulunamadı.", 404);
    const task = await client.query("SELECT konteyner_id FROM konteyner_gorevleri WHERE id=$1", [id]);
    if (actor) await recordActivity(client, { actorRole: actor.role, actorId: actor.id, actorName: actor.name, entityType: "gorev", entityId: Number(id), action: "task.cancelled", summary: "Açık görev iptal edildi.", metadata: { related_entity_type: "konteyner", related_entity_id: task.rows[0].konteyner_id, reason: reason || null } });
    return getTaskById(client, id);
  });
}

module.exports = {
  getContainerTasks,
  getEligibleDrivers,
  createContainerTask,
  createBulkContainerTasks,
  updateContainerCavus,
  updateTask,
  cancelTask,
};
