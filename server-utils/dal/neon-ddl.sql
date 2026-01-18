
-- 2026-01-11: Add job_bundles table for operational job collections
CREATE TABLE IF NOT EXISTS job_bundles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  content TEXT,
  job_ids JSONB DEFAULT '[]', -- Ordered list of job IDs
  priority INTEGER DEFAULT 10, -- 1 is highest, 10 is lowest
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2026-01-16: Update Eigen AI careers page URL
UPDATE trusted_companies 
SET careers_page = 'https://www.eigenai.com/join' 
WHERE name = 'Eigen AI';

-- 2026-01-16: Update MixRank careers page URL
UPDATE trusted_companies 
SET careers_page = 'https://app.dover.com/jobs/mixrank' 
WHERE name = 'MixRank';

-- 2026-01-16: Update Udacity careers page URL to Greenhouse (Official Job Board)
UPDATE trusted_companies 
SET careers_page = 'https://job-boards.greenhouse.io/udacity' 
WHERE name = 'Udacity';

-- 2026-01-16: Update MixRank careers page URL to Y Combinator (Dover page is uncrawlable SPA)
UPDATE trusted_companies 
SET careers_page = 'https://www.ycombinator.com/companies/mixrank/jobs' 
WHERE name = 'MixRank';

-- 2026-01-17: Update Speechify careers page URL to Greenhouse (Official Job Board)
UPDATE trusted_companies 
SET careers_page = 'https://job-boards.greenhouse.io/speechify' 
WHERE name ILIKE '%Speechify%';

-- 2026-01-17: Update MetaLab careers page URL to Greenhouse (Official Job Board)
UPDATE trusted_companies 
SET careers_page = 'https://job-boards.greenhouse.io/metalab' 
WHERE name = 'MetaLab';

-- 2026-01-17: Add hiring_email to trusted_companies
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255);

-- 2026-01-18: Performance Optimization for Company Detail Page
-- Add index on jobs(company_id) to speed up job fetching by ID
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- Add index on jobs(company) for faster text search (if fallback needed)
-- Using LOWER() for case-insensitive matching which is common in ILIKE or manual lower() comparisons
CREATE INDEX IF NOT EXISTS idx_jobs_company_lower ON jobs(lower(company));

-- Add index on trusted_companies(name) for faster lookup
CREATE INDEX IF NOT EXISTS idx_trusted_companies_name_lower ON trusted_companies(lower(name));
