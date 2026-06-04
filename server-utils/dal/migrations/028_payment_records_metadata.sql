-- 2026-06-04: Ensure membership payment records support manual claim metadata.
CREATE TABLE IF NOT EXISTS payment_records (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  amount NUMERIC,
  currency VARCHAR(16) DEFAULT 'CNY',
  payment_method VARCHAR(64),
  status VARCHAR(64) DEFAULT 'pending',
  plan_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN payment_records.metadata IS 'Optional metadata for manual membership payment claims, such as email remarks.';
