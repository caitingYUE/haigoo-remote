-- 2026-02-21: Copilot DB Fixes
-- 1. Ensure trial tracking column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_copilot_trial BOOLEAN DEFAULT FALSE;

-- 2. Fix copilot_sessions table with correct user_id reference (user_id instead of id)
DROP TABLE IF EXISTS copilot_sessions;

CREATE TABLE copilot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
    goal VARCHAR(50), -- 'full-time', 'part-time', 'freelance', 'market-watch', 'career-pivot'
    timeline VARCHAR(50), -- 'immediately', '1-3 months', etc.
    background JSONB, -- { education, industry, seniority, language }
    plan_data JSONB, -- Generated AI plan
    is_trial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add index for faster history lookups
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_id ON copilot_sessions(user_id);
