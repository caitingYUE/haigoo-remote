-- Seed membership test users for admin QA.
-- Password for all accounts: Haigoo2026!
-- Hash matches LOCAL_TEST_PASSWORD_HASH in server-utils/user-helper.js.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_type VARCHAR(32) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS member_cycle_start_at TIMESTAMPTZ;

INSERT INTO users (
  user_id, email, password_hash, username, email_verified,
  membership_level, member_status, member_type,
  membership_expire_at, member_expire_at,
  roles, created_at, updated_at
)
VALUES
  (
    'test-free-uuid-002',
    'test_free@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Free User',
    true,
    'free',
    'inactive',
    'none',
    NULL,
    NULL,
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'test-weekly-uuid-005',
    'test_weekly@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Weekly Member',
    true,
    'club_go',
    'active',
    'trial_week',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days',
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'test-member-uuid-001',
    'test_member@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Member (Old Quarter)',
    true,
    'club_go',
    'active',
    'quarter',
    NOW() + INTERVAL '3 months',
    NOW() + INTERVAL '3 months',
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'test-half-uuid-006',
    'test_half@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Half Member',
    true,
    'club_go',
    'active',
    'half_year',
    NOW() + INTERVAL '6 months',
    NOW() + INTERVAL '6 months',
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'test-annual-uuid-007',
    'test_annual@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Annual Member',
    true,
    'goo_plus',
    'active',
    'annual',
    NOW() + INTERVAL '12 months',
    NOW() + INTERVAL '12 months',
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'test-admin-uuid-003',
    'test_admin@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Admin',
    true,
    'goo_plus',
    'active',
    'annual',
    NOW() + INTERVAL '12 months',
    NOW() + INTERVAL '12 months',
    '{"user": true, "admin": true, "super_admin": true}'::jsonb,
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
  membership_expire_at = EXCLUDED.membership_expire_at,
  member_expire_at = EXCLUDED.member_expire_at,
  roles = EXCLUDED.roles,
  updated_at = NOW();
