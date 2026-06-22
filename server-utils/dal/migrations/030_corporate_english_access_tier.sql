ALTER TABLE corporate_english_company_profiles
  ADD COLUMN IF NOT EXISTS access_tier VARCHAR(24) NOT NULL DEFAULT 'vip';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corporate_english_company_profiles_access_tier_check'
  ) THEN
    ALTER TABLE corporate_english_company_profiles
      ADD CONSTRAINT corporate_english_company_profiles_access_tier_check
      CHECK (access_tier IN ('free', 'vip'));
  END IF;
END $$;

INSERT INTO corporate_english_company_profiles (
  company_id,
  access_tier,
  status,
  sort_order,
  created_at,
  updated_at
)
SELECT company_id, 'free', 'published', -1000, NOW(), NOW()
FROM trusted_companies
WHERE LOWER(name) = 'automattic'
ON CONFLICT (company_id) DO UPDATE SET
  access_tier = 'free',
  sort_order = LEAST(corporate_english_company_profiles.sort_order, -1000),
  updated_at = NOW();
