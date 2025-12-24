-- Campaign Leads Schema Enhancement
-- This migration updates the campaign_leads table to support user tracking and resume storage flags

-- Add new columns if they don't exist
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false;
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS allow_resume_storage BOOLEAN DEFAULT false;

-- Add index for user lookup
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON campaign_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON campaign_leads(email);
