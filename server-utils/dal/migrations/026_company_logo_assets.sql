-- Cache public company logos as first-party assets so frontend users do not
-- need direct access to overseas logo/favicon/CDN domains.

CREATE TABLE IF NOT EXISTS company_image_assets (
  asset_id TEXT PRIMARY KEY,
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  asset_type VARCHAR(32) NOT NULL DEFAULT 'logo',
  source_url TEXT,
  content BYTEA,
  mime_type VARCHAR(100),
  format VARCHAR(32),
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  sha256 TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_image_assets_type_check CHECK (asset_type IN ('logo')),
  CONSTRAINT company_image_assets_status_check CHECK (status IN ('pending', 'ready', 'failed')),
  CONSTRAINT company_image_assets_unique_company_type UNIQUE (company_id, asset_type)
);

CREATE INDEX IF NOT EXISTS idx_company_image_assets_company_type
  ON company_image_assets(company_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_company_image_assets_status
  ON company_image_assets(status);

ALTER TABLE trusted_companies
  ADD COLUMN IF NOT EXISTS cached_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_cache_status VARCHAR(32) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS logo_cache_hash TEXT,
  ADD COLUMN IF NOT EXISTS logo_cache_error TEXT,
  ADD COLUMN IF NOT EXISTS logo_cached_at TIMESTAMPTZ;

ALTER TABLE trusted_companies
  DROP CONSTRAINT IF EXISTS trusted_companies_logo_cache_status_check;

ALTER TABLE trusted_companies
  ADD CONSTRAINT trusted_companies_logo_cache_status_check
  CHECK (logo_cache_status IN ('pending', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_trusted_companies_logo_cache_status
  ON trusted_companies(logo_cache_status);
