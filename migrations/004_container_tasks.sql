CREATE TABLE IF NOT EXISTS konteyner_gorevleri (
  id BIGSERIAL PRIMARY KEY,
  konteyner_id INTEGER NOT NULL REFERENCES konteynerler(id) ON DELETE RESTRICT,
  cavus_id INTEGER NOT NULL REFERENCES cavuslar(id) ON DELETE RESTRICT,
  sofor_id INTEGER NOT NULL REFERENCES soforler(id) ON DELETE RESTRICT,
  arac_id INTEGER NOT NULL REFERENCES araclar(id) ON DELETE RESTRICT,
  atayan_yonetici_id INTEGER REFERENCES yoneticiler(id) ON DELETE SET NULL,
  oncelik VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (oncelik IN ('dusuk', 'normal', 'yuksek', 'acil')),
  durum VARCHAR(20) NOT NULL DEFAULT 'atandi'
    CHECK (durum IN ('atandi', 'devam_ediyor', 'tamamlandi', 'atlandi', 'iptal_edildi')),
  hedef_tarih TIMESTAMPTZ,
  yonetici_notu TEXT,
  baslama_tarihi TIMESTAMPTZ,
  tamamlanma_tarihi TIMESTAMPTZ,
  iptal_nedeni TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_konteyner_acik_gorev
  ON konteyner_gorevleri (konteyner_id)
  WHERE durum IN ('atandi', 'devam_ediyor');

CREATE INDEX IF NOT EXISTS idx_konteyner_gorev_sofor_durum
  ON konteyner_gorevleri (sofor_id, durum, hedef_tarih);

CREATE INDEX IF NOT EXISTS idx_konteyner_gorev_cavus_durum
  ON konteyner_gorevleri (cavus_id, durum, hedef_tarih);

CREATE INDEX IF NOT EXISTS idx_konteyner_gorev_konteyner_tarih
  ON konteyner_gorevleri (konteyner_id, created_at DESC);
