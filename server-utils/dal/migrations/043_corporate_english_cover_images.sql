CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE corporate_english_materials
  ADD COLUMN IF NOT EXISTS cover_image_hash TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_width INTEGER,
  ADD COLUMN IF NOT EXISTS cover_image_height INTEGER,
  ADD COLUMN IF NOT EXISTS cover_image_updated_at TIMESTAMPTZ;

ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS cover_image_hash TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_width INTEGER,
  ADD COLUMN IF NOT EXISTS cover_image_height INTEGER,
  ADD COLUMN IF NOT EXISTS cover_image_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS corporate_english_cover_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type VARCHAR(24) NOT NULL,
  owner_id UUID NOT NULL,
  variant VARCHAR(24) NOT NULL,
  filename TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL DEFAULT 'image/webp',
  content BYTEA NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_english_cover_assets_owner_check
    CHECK (owner_type IN ('material', 'module_video')),
  CONSTRAINT corporate_english_cover_assets_variant_check
    CHECK (variant IN ('large', 'thumb')),
  CONSTRAINT corporate_english_cover_assets_unique_owner_variant
    UNIQUE (owner_type, owner_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_corporate_english_cover_assets_owner
  ON corporate_english_cover_assets(owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_corporate_english_materials_cover_updated
  ON corporate_english_materials(cover_image_updated_at DESC)
  WHERE cover_image_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_cover_updated
  ON corporate_english_module_videos(cover_image_updated_at DESC)
  WHERE cover_image_hash IS NOT NULL AND deleted_at IS NULL;
