-- Reconcile environments created before trusted-company referral contacts were
-- moved from the bootstrap DDL into normal application reads.
ALTER TABLE trusted_companies
  ADD COLUMN IF NOT EXISTS referral_contacts JSONB DEFAULT '[]'::jsonb;

UPDATE trusted_companies
SET referral_contacts = '[]'::jsonb
WHERE referral_contacts IS NULL;

ALTER TABLE trusted_companies
  ALTER COLUMN referral_contacts SET DEFAULT '[]'::jsonb;

-- Rollback (only after all readers stop selecting referral_contacts):
-- ALTER TABLE trusted_companies DROP COLUMN IF EXISTS referral_contacts;
