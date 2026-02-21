-- SQL script to reset/ensure existence of canonical test users
-- Run this in the Neon SQL Editor if you need to restore these accounts
-- Password for all accounts: Haigoo2026!
-- Note: The password_hash below needs to be a valid bcrypt hash for 'Haigoo2026!'. 
-- If you need to reset passwords, please use the Forgot Password flow or update with a known hash.

-- 1. Admin User (test_admin@haigoo.com)
INSERT INTO users (
    user_id, 
    email, 
    password_hash, 
    roles, 
    member_status, 
    created_at, 
    updated_at
) VALUES (
    'test-admin-id-001', 
    'test_admin@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder: Replace with actual bcrypt hash of 'Haigoo2026!'
    '{"admin": true}', 
    'active', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO UPDATE SET 
    roles = '{"admin": true}',
    member_status = 'active';

-- 2. Member User (test_member@haigoo.com)
INSERT INTO users (
    user_id, 
    email, 
    password_hash, 
    roles, 
    member_status, 
    member_expire_at, 
    created_at, 
    updated_at
) VALUES (
    'test-member-id-001', 
    'test_member@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder
    '{}', 
    'active', 
    NOW() + INTERVAL '1 year', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO UPDATE SET 
    member_status = 'active',
    member_expire_at = NOW() + INTERVAL '1 year';

-- 3. Free User (test_free@haigoo.com)
INSERT INTO users (
    user_id, 
    email, 
    password_hash, 
    roles, 
    member_status, 
    created_at, 
    updated_at
) VALUES (
    'test-free-id-001', 
    'test_free@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder
    '{}', 
    'inactive', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO UPDATE SET 
    member_status = 'inactive';
