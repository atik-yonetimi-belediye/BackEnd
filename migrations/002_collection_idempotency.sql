ALTER TABLE toplama_kayitlari
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS unique_toplama_sofor_idempotency
  ON toplama_kayitlari (sofor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
