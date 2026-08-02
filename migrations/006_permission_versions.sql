INSERT INTO permission_definitions
  (code, label, description, account_type, category, default_enabled, risk_level, sort_order)
VALUES
  ('container.edit', 'Konteyner Düzenle', 'Kendi sorumluluğundaki konteyner bilgilerini düzenler.', 'cavus', 'Konteyner', true, 'critical', 25),
  ('driver.edit', 'Şoför Düzenle', 'Kendisine bağlı şoförün temel bilgilerini düzenler.', 'cavus', 'Şoför', true, 'critical', 75),
  ('reports.view', 'Raporları Gör', 'Sorumluluk alanındaki operasyon raporlarını görüntüler.', 'cavus', 'Raporlama', true, 'normal', 150),
  ('location.share', 'Konum Paylaş', 'Toplama kanıtına cihaz konumunu ekler.', 'sofor', 'Konum ve Saha İşlemleri', true, 'normal', 55)
ON CONFLICT (code) DO NOTHING;

UPDATE permission_definitions
   SET label='Fotoğraflı Kanıt Yükle', description='Toplama kaydına isteğe bağlı fotoğraf kanıtı ekler.'
 WHERE code='collection.attach_evidence';

CREATE TABLE IF NOT EXISTS role_permission_defaults (
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor')),
  permission_code VARCHAR(80) NOT NULL REFERENCES permission_definitions(code) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_type, permission_code)
);

INSERT INTO role_permission_defaults (account_type, permission_code, enabled)
SELECT account_type, code, default_enabled
  FROM permission_definitions
ON CONFLICT (account_type, permission_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permission_versions (
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor')),
  account_id INTEGER NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_type, account_id)
);

CREATE INDEX IF NOT EXISTS idx_permission_versions_updated
  ON user_permission_versions(updated_at DESC);
