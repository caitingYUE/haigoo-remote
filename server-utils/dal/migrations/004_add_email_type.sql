-- Migration: Add email_type column to trusted_companies
-- Description: Support email type classification
-- Date: 2026-01-18

ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT '通用支持邮箱';

-- Add check constraint for valid email types
-- Note: We use a check constraint instead of an enum for flexibility if we want to remove it later or change it easily without dropping types
ALTER TABLE trusted_companies ADD CONSTRAINT valid_email_type CHECK (email_type IN ('招聘专用邮箱', '通用支持邮箱', '内部员工邮箱', '企业领导邮箱'));

-- Update existing companies to have valid email type if needed (defaults handle it, but just in case)
UPDATE trusted_companies SET email_type = '通用支持邮箱' WHERE email_type IS NULL;
