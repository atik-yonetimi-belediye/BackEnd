ALTER TABLE sikayetler
  ADD COLUMN IF NOT EXISTS aktif_mi BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_tahmini_miktar_pozitif'
  ) THEN
    ALTER TABLE geri_donusum_talepleri
      ADD CONSTRAINT chk_tahmini_miktar_pozitif
      CHECK (tahmini_miktar IS NULL OR tahmini_miktar > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS unique_sirket_mail_lower
  ON sirketler (LOWER(mail));

CREATE UNIQUE INDEX IF NOT EXISTS unique_yonetici_kullanici_adi_lower
  ON yoneticiler (LOWER(kullanici_adi));

CREATE INDEX IF NOT EXISTS idx_sikayet_aktif_tarih
  ON sikayetler (aktif_mi, tarih_saat DESC);

CREATE INDEX IF NOT EXISTS idx_gdtalep_sirket_durum_tarih
  ON geri_donusum_talepleri (sirket_id, durum, tarih_saat DESC);

CREATE INDEX IF NOT EXISTS idx_toplama_sofor_tarih
  ON toplama_kayitlari (sofor_id, tarih_saat DESC);
