-- 2026-04-08: Job-level referral contact association for trusted companies

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS referral_contact_mode VARCHAR(20) DEFAULT 'inherit_all';

UPDATE jobs
SET referral_contact_mode = 'inherit_all'
WHERE referral_contact_mode IS NULL;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_referral_contact_mode_check;
ALTER TABLE jobs
ADD CONSTRAINT jobs_referral_contact_mode_check
CHECK (referral_contact_mode IN ('inherit_all', 'custom'));

CREATE TABLE IF NOT EXISTS job_referral_contact_links (
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
    contact_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (job_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_job_referral_contact_links_job_id
    ON job_referral_contact_links(job_id);

CREATE INDEX IF NOT EXISTS idx_job_referral_contact_links_company_id
    ON job_referral_contact_links(company_id);
