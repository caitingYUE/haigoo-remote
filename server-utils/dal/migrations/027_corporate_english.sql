CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS corporate_english_materials (
  material_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  company_name_snapshot TEXT NOT NULL,
  company_website_snapshot TEXT,
  material_title TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  speaker_role TEXT NOT NULL,
  speaker_email TEXT,
  speaker_linkedin TEXT,
  source_audio_asset_id UUID,
  subtitle_csv_asset_id UUID,
  normalized_subtitle_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  clip_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT corporate_english_materials_status_check
    CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE IF NOT EXISTS corporate_english_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES corporate_english_materials(material_id) ON DELETE CASCADE,
  company_id VARCHAR(255) REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  asset_kind VARCHAR(32) NOT NULL,
  filename TEXT NOT NULL,
  mime_type VARCHAR(120),
  content BYTEA,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  upload_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  uploaded_chunks INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_english_assets_kind_check
    CHECK (asset_kind IN ('source_audio', 'subtitle_csv', 'clip_audio')),
  CONSTRAINT corporate_english_assets_status_check
    CHECK (upload_status IN ('pending', 'ready', 'failed'))
);

CREATE TABLE IF NOT EXISTS corporate_english_clips (
  clip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES corporate_english_materials(material_id) ON DELETE CASCADE,
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  clip_audio_asset_id UUID REFERENCES corporate_english_assets(asset_id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  clip_title TEXT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  subtitle_text TEXT NOT NULL DEFAULT '',
  translation_text TEXT NOT NULL DEFAULT '',
  clip_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_english_clips_time_check CHECK (end_ms > start_ms),
  CONSTRAINT corporate_english_clips_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

ALTER TABLE corporate_english_clips
  ADD COLUMN IF NOT EXISTS clip_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_corporate_english_materials_company
  ON corporate_english_materials(company_id);

CREATE INDEX IF NOT EXISTS idx_corporate_english_materials_status_updated
  ON corporate_english_materials(status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_english_assets_material
  ON corporate_english_assets(material_id, asset_kind);

CREATE INDEX IF NOT EXISTS idx_corporate_english_clips_material
  ON corporate_english_clips(material_id, sequence);

CREATE INDEX IF NOT EXISTS idx_corporate_english_clips_tags
  ON corporate_english_clips USING GIN (clip_tags);
