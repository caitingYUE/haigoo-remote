-- 2025-12-14: Add reply fields to feedbacks
ALTER TABLE feedbacks ADD COLUMN reply_content TEXT;
ALTER TABLE feedbacks ADD COLUMN replied_at TIMESTAMP;

-- 2025-12-14: Create notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'system', 'feedback_reply', 'application_update'
  title VARCHAR(200) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- 2025-12-15: Add subscription tracking fields
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS fail_count INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'daily';

-- 2025-12-16: Add nickname field for Feishu subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);
