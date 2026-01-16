
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

-- 2026-01-16: Update MixRank careers page URL to Y Combinator (Dover page is uncrawlable SPA)
UPDATE trusted_companies 
SET careers_page = 'https://www.ycombinator.com/companies/mixrank/jobs' 
WHERE name = 'MixRank';
