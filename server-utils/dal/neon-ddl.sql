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
