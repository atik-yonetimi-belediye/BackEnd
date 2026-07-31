CREATE OR REPLACE FUNCTION normalize_account_phone(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE WHEN regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g') ~ '^90[0-9]{10}$'
    THEN '0' || substring(regexp_replace(value, '[^0-9]', '', 'g') FROM 3)
    ELSE regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g') END
$$;

CREATE TABLE IF NOT EXISTS account_identifiers (
  id BIGSERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cavus', 'sofor', 'sirket')),
  account_id INTEGER NOT NULL,
  normalized_phone VARCHAR(11) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (account_type, account_id)
);

INSERT INTO account_identifiers (account_type, account_id, normalized_phone)
SELECT account_type, account_id, normalized_phone FROM (
  SELECT 'cavus' AS account_type, id AS account_id, normalize_account_phone(telefon) AS normalized_phone FROM cavuslar
  UNION ALL SELECT 'sofor', id, normalize_account_phone(telefon) FROM soforler
  UNION ALL SELECT 'sirket', id, normalize_account_phone(telefon) FROM sirketler
) accounts WHERE normalized_phone <> ''
ON CONFLICT (account_type, account_id) DO UPDATE SET normalized_phone = EXCLUDED.normalized_phone, updated_at = CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION sync_account_identifier() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE account_kind TEXT := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM account_identifiers WHERE account_type = account_kind AND account_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO account_identifiers (account_type, account_id, normalized_phone)
  VALUES (account_kind, NEW.id, normalize_account_phone(NEW.telefon))
  ON CONFLICT (account_type, account_id) DO UPDATE SET normalized_phone = EXCLUDED.normalized_phone, updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_cavus_account_identifier ON cavuslar;
CREATE TRIGGER trg_cavus_account_identifier AFTER INSERT OR UPDATE OF telefon OR DELETE ON cavuslar FOR EACH ROW EXECUTE FUNCTION sync_account_identifier('cavus');
DROP TRIGGER IF EXISTS trg_sofor_account_identifier ON soforler;
CREATE TRIGGER trg_sofor_account_identifier AFTER INSERT OR UPDATE OF telefon OR DELETE ON soforler FOR EACH ROW EXECUTE FUNCTION sync_account_identifier('sofor');
DROP TRIGGER IF EXISTS trg_sirket_account_identifier ON sirketler;
CREATE TRIGGER trg_sirket_account_identifier AFTER INSERT OR UPDATE OF telefon OR DELETE ON sirketler FOR EACH ROW EXECUTE FUNCTION sync_account_identifier('sirket');

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_role VARCHAR(20) NOT NULL,
  actor_id INTEGER,
  action VARCHAR(10) NOT NULL,
  entity_path TEXT NOT NULL,
  request_id VARCHAR(128),
  request_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_role, actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs kayıtları değiştirilemez veya silinemez'; END
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
