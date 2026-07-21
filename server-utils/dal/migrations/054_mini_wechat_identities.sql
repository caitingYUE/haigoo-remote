-- Maps a verified WeChat Mini Program identity to one existing Haigoo account.
-- New Mini Program visitors remain anonymous until they intentionally bind.
CREATE TABLE IF NOT EXISTS mini_wechat_identities (
  app_id VARCHAR(64) NOT NULL,
  openid VARCHAR(128) NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (app_id, openid),
  UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_wechat_identities_user_id
  ON mini_wechat_identities(user_id);
