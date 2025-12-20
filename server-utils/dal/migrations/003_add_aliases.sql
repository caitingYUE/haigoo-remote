-- Migration: Add aliases column to trusted_companies
-- Description: Support alternative names for better company matching

ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]';

-- Seed data for known issues
UPDATE trusted_companies 
SET aliases = '["alphainsights", "alpha sights"]'::jsonb 
WHERE name ILIKE 'AlphaSights';

UPDATE trusted_companies 
SET aliases = '["bytedance", "byte dance"]'::jsonb 
WHERE name ILIKE 'TikTok';
