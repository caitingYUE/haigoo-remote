-- 2026-02-14: Create Test Users for Preview Environment
-- Description: Creates 3 test accounts with password 'Haigoo2026!'
-- 1. test_member@haigoo.com (VIP Member)
-- 2. test_free@haigoo.com (Free User)
-- 3. test_admin@haigoo.com (Admin User)

-- Password Hash for 'Haigoo2026!'
-- $2b$10$LnIuqFr/HbCu8PVjPip1POLH05pDvtxqVfjBBdpm4wLA33ZO/2H96

-- 1. Create/Update Member User (VIP)
INSERT INTO users (
    user_id, email, password_hash, username, email_verified, 
    membership_level, member_status, membership_expire_at, member_expire_at, 
    roles, created_at, updated_at
) VALUES (
    'test-member-uuid-001', 
    'test_member@haigoo.com', 
    '$2b$10$LnIuqFr/HbCu8PVjPip1POLH05pDvtxqVfjBBdpm4wLA33ZO/2H96', 
    'Test Member (VIP)', 
    true, 
    'club_go', 'active', NOW() + INTERVAL '1 year', NOW() + INTERVAL '1 year', 
    '{"user": true}'::jsonb, 
    NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    membership_level = 'club_go',
    member_status = 'active',
    membership_expire_at = NOW() + INTERVAL '1 year',
    member_expire_at = NOW() + INTERVAL '1 year';

-- 2. Create/Update Free User (Non-Member)
INSERT INTO users (
    user_id, email, password_hash, username, email_verified, 
    membership_level, member_status, membership_expire_at, member_expire_at, 
    roles, created_at, updated_at
) VALUES (
    'test-free-uuid-002', 
    'test_free@haigoo.com', 
    '$2b$10$LnIuqFr/HbCu8PVjPip1POLH05pDvtxqVfjBBdpm4wLA33ZO/2H96', 
    'Test Free User', 
    true, 
    NULL, 'inactive', NULL, NULL, 
    '{"user": true}'::jsonb, 
    NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    membership_level = NULL,
    member_status = 'inactive',
    membership_expire_at = NULL,
    member_expire_at = NULL;

-- 3. Create/Update Admin User
INSERT INTO users (
    user_id, email, password_hash, username, email_verified, 
    membership_level, member_status, membership_expire_at, member_expire_at, 
    roles, created_at, updated_at
) VALUES (
    'test-admin-uuid-003', 
    'test_admin@haigoo.com', 
    '$2b$10$LnIuqFr/HbCu8PVjPip1POLH05pDvtxqVfjBBdpm4wLA33ZO/2H96', 
    'Test Admin', 
    true, 
    'club_go', 'active', NOW() + INTERVAL '10 years', NOW() + INTERVAL '10 years', 
    '{"admin": true, "user": true}'::jsonb, 
    NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    roles = '{"admin": true, "user": true}'::jsonb;

-- 4. Verify Creation
SELECT email, username, roles, member_status FROM users WHERE email LIKE 'test_%@haigoo.com';
