CREATE TABLE IF NOT EXISTS permission_definitions (
  code VARCHAR(80) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor')),
  category VARCHAR(40) NOT NULL,
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  risk_level VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal', 'critical')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id BIGSERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor')),
  account_id INTEGER NOT NULL,
  permission_code VARCHAR(80) NOT NULL REFERENCES permission_definitions(code) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL,
  changed_by_admin_id INTEGER NOT NULL REFERENCES yoneticiler(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (account_type, account_id, permission_code)
);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_account
  ON user_permission_overrides(account_type, account_id);

CREATE TABLE IF NOT EXISTS permission_change_history (
  id BIGSERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor')),
  account_id INTEGER NOT NULL,
  permission_code VARCHAR(80) NOT NULL REFERENCES permission_definitions(code),
  previous_value BOOLEAN,
  new_value BOOLEAN,
  changed_by_admin_id INTEGER NOT NULL REFERENCES yoneticiler(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_permission_history_account
  ON permission_change_history(account_type, account_id, created_at DESC);

INSERT INTO permission_definitions
  (code, label, description, account_type, category, default_enabled, risk_level, sort_order)
VALUES
  ('container.view', 'Konteynerleri Gör', 'Sorumluluk alanındaki konteynerleri görüntüler.', 'cavus', 'Konteyner', true, 'normal', 10),
  ('container.create', 'Konteyner Ekle', 'Sorumlu olduğu mahalleye yeni konteyner ekler.', 'cavus', 'Konteyner', true, 'critical', 20),
  ('container.deactivate', 'Konteyneri Pasife Al', 'Kendi konteynerini pasif duruma getirir.', 'cavus', 'Konteyner', true, 'critical', 30),
  ('task.assign', 'Şoföre Görev Ata', 'Kendi konteynerlerini kendi şoförlerine atar.', 'cavus', 'Görev', true, 'critical', 40),
  ('task.cancel', 'Görevi İptal Et', 'Kendi sorumluluğundaki açık görevi iptal eder.', 'cavus', 'Görev', false, 'critical', 50),
  ('driver.view', 'Şoförleri Gör', 'Kendisine bağlı şoförleri görüntüler.', 'cavus', 'Şoför', true, 'normal', 60),
  ('driver.create', 'Şoför Ekle', 'Kendisine bağlı yeni şoför oluşturur.', 'cavus', 'Şoför', true, 'critical', 70),
  ('driver.assign_vehicle', 'Şoföre Araç Ata', 'Kendi şoförünün araç atamasını değiştirir.', 'cavus', 'Şoför', true, 'critical', 80),
  ('driver.deactivate', 'Şoförü Pasife Al', 'Kendi şoförünü pasif duruma getirir.', 'cavus', 'Şoför', true, 'critical', 90),
  ('vehicle.view', 'Araçları Gör', 'Kendisine bağlı araçları görüntüler.', 'cavus', 'Araç', true, 'normal', 100),
  ('vehicle.create', 'Araç Ekle', 'Sorumluluğuna yeni araç ekler.', 'cavus', 'Araç', true, 'critical', 110),
  ('vehicle.edit', 'Araç Düzenle', 'Kendi aracının bilgilerini düzenler.', 'cavus', 'Araç', true, 'critical', 120),
  ('vehicle.deactivate', 'Aracı Pasife Al', 'Kendi aracını pasif duruma getirir.', 'cavus', 'Araç', true, 'critical', 130),
  ('collection.history.view', 'Toplama Geçmişini Gör', 'Sorumluluk alanındaki toplama geçmişini görüntüler.', 'cavus', 'Rapor', true, 'normal', 140),
  ('task.view', 'Görevleri Gör', 'Kendisine atanmış görevleri görüntüler.', 'sofor', 'Görev', true, 'normal', 10),
  ('task.start', 'Görevi Başlat', 'Kendisine atanmış görevi başlatır.', 'sofor', 'Görev', true, 'normal', 20),
  ('collection.complete', 'Toplandı İşaretle', 'Konteyner için toplandı kaydı oluşturur.', 'sofor', 'Saha', true, 'critical', 30),
  ('collection.skip', 'Konteyneri Atla', 'Neden belirterek atlama kaydı oluşturur.', 'sofor', 'Saha', true, 'critical', 40),
  ('collection.attach_evidence', 'Fotoğraf ve Konum Ekle', 'Toplama kaydına isteğe bağlı fotoğraf ve konum ekler.', 'sofor', 'Saha', true, 'normal', 50),
  ('route.open', 'Yol Tarifi Aç', 'Görev konumuna yol tarifi açar.', 'sofor', 'Saha', true, 'normal', 60),
  ('own_history.view', 'Geçmişini Gör', 'Kendi toplama geçmişini görüntüler.', 'sofor', 'Rapor', true, 'normal', 70)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE konteyner_gorevleri
  ADD COLUMN IF NOT EXISTS atayan_cavus_id INTEGER REFERENCES cavuslar(id);
ALTER TABLE konteyner_gorevleri ALTER COLUMN atayan_yonetici_id DROP NOT NULL;
ALTER TABLE konteyner_gorevleri DROP CONSTRAINT IF EXISTS chk_konteyner_gorevi_atayan;
ALTER TABLE konteyner_gorevleri
  ADD CONSTRAINT chk_konteyner_gorevi_atayan
  CHECK (num_nonnulls(atayan_yonetici_id, atayan_cavus_id) = 1);

ALTER TABLE konteynerler
  ADD COLUMN IF NOT EXISTS adres TEXT,
  ADD COLUMN IF NOT EXISTS kapasite_litre INTEGER,
  ADD COLUMN IF NOT EXISTS yerlesim_notu TEXT,
  ADD COLUMN IF NOT EXISTS kurulum_tarihi DATE;
ALTER TABLE konteynerler DROP CONSTRAINT IF EXISTS chk_konteyner_kapasite;
ALTER TABLE konteynerler
  ADD CONSTRAINT chk_konteyner_kapasite
  CHECK (kapasite_litre IS NULL OR kapasite_litre BETWEEN 30 AND 10000);

ALTER TABLE toplama_kayitlari
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS konum_dogruluk_metre NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS kanit_fotografi_url TEXT;
ALTER TABLE toplama_kayitlari DROP CONSTRAINT IF EXISTS chk_toplama_kanit_konum;
ALTER TABLE toplama_kayitlari
  ADD CONSTRAINT chk_toplama_kanit_konum CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('admin', 'cavus', 'sofor', 'system')),
  actor_id INTEGER,
  actor_name VARCHAR(140),
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('konteyner', 'cavus', 'sofor', 'arac', 'gorev', 'toplama')),
  entity_id INTEGER NOT NULL,
  action VARCHAR(80) NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity
  ON activity_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor
  ON activity_events(actor_role, actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_activity_event_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_events kayıtları değiştirilemez veya silinemez';
END
$$;
DROP TRIGGER IF EXISTS trg_activity_events_immutable ON activity_events;
CREATE TRIGGER trg_activity_events_immutable
  BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION prevent_activity_event_mutation();
