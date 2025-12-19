-- Campaign Forest Schema
CREATE TABLE IF NOT EXISTS campaign_forest (
    id SERIAL PRIMARY KEY,
    tree_id VARCHAR(255) UNIQUE NOT NULL,
    tree_data JSONB NOT NULL,
    star_label VARCHAR(100),
    user_nickname VARCHAR(100) DEFAULT 'Anonymous',
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0
);

-- Index for pagination
CREATE INDEX idx_forest_created_at ON campaign_forest(created_at DESC);
