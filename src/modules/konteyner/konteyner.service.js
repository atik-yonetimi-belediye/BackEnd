const pool = require("../../config/db");
const {
  getPagination,
  toPaginatedResult,
} = require("../../utils/pagination");

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
      COUNT(*) OVER() AS total_count,
      (SELECT MAX(tarih_saat) FROM toplama_kayitlari tk WHERE tk.konteyner_id = k.id AND tk.durum = 'toplandi') as son_toplanma_tarihi
    FROM konteynerler k
    JOIN mahalleler m ON m.id = k.mahalle_id
    LEFT JOIN cavuslar c ON c.id = k.cavus_id
    ${whereClause}
    ORDER BY k.id ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return toPaginatedResult(result.rows, page, limit);
}

async function getKonteynerById(id) {
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
      k.updated_at
    FROM konteynerler k
    JOIN mahalleler m ON m.id = k.mahalle_id
    LEFT JOIN cavuslar c ON c.id = k.cavus_id
    WHERE k.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  getAllKonteynerler,
  getKonteynerById,
};
