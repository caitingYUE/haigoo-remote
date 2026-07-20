-- Seed the Club Starter monthly test account for local and database QA.
-- Password: Haigoo2026!
-- Hash matches LOCAL_TEST_PASSWORD_HASH in server-utils/user-helper.js.

INSERT INTO users (
  user_id, email, password_hash, username, email_verified,
  membership_level, member_status, member_type,
  member_cycle_start_at, membership_expire_at, member_expire_at,
  roles, created_at, updated_at
)
VALUES (
  'test-month-uuid-008',
  'test_month@haigoo.com',
  '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
  'Test Club Starter Member',
  true,
  'club_go',
  'active',
  'starter',
  NOW(),
  NOW() + INTERVAL '1 month',
  NOW() + INTERVAL '1 month',
  '{"user": true}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  username = EXCLUDED.username,
  email_verified = EXCLUDED.email_verified,
  membership_level = EXCLUDED.membership_level,
  member_status = EXCLUDED.member_status,
  member_type = EXCLUDED.member_type,
  member_cycle_start_at = EXCLUDED.member_cycle_start_at,
  membership_expire_at = EXCLUDED.membership_expire_at,
  member_expire_at = EXCLUDED.member_expire_at,
  roles = EXCLUDED.roles,
  updated_at = NOW();
