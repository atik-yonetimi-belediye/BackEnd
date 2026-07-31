const pool = require("../../config/db");

async function getPublicStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM konteynerler WHERE aktif_mi = true)
        AS aktif_konteyner,
      (
        SELECT COUNT(*)
        FROM toplama_kayitlari
        WHERE durum = 'toplandi'
          AND (tarih_saat AT TIME ZONE 'Europe/Istanbul')::date =
              (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
      ) AS bugun_toplanan,
      (
        SELECT COUNT(*)
        FROM sikayetler
        WHERE aktif_mi = true AND durum = 'cozuldu'
      ) AS cozulen_sikayet,
      (
        SELECT COUNT(*)
        FROM geri_donusum_talepleri
        WHERE durum = 'tamamlandi'
      ) AS tamamlanan_geri_donusum_talebi,
      (
        SELECT COALESCE(SUM(tahmini_miktar), 0)
        FROM geri_donusum_talepleri
        WHERE durum = 'tamamlandi'
      ) AS tamamlanan_tahmini_miktar
  `);

  const row = result.rows[0];
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)])
  );
}

module.exports = {
  getPublicStats,
};
