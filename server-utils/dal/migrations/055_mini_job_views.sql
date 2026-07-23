-- Mini Program-only browsing allowance for free users.
-- A job counts once per WeChat identity, regardless of list/search/detail entry.

CREATE TABLE IF NOT EXISTS mini_job_views (
    app_id VARCHAR(128) NOT NULL,
    openid VARCHAR(128) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (app_id, openid, job_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_job_views_identity
    ON mini_job_views (app_id, openid, first_viewed_at DESC);
