-- Migration: Add Test Users (Member, Free, Admin)
-- Created: 2026-02-21
-- Password for all: Haigoo2026!
-- Hash: $2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC

-- 1. Member User (Club Go, Active)
INSERT INTO users (user_id, email, password_hash, username, email_verified, membership_level, member_status, membership_expire_at, member_expire_at, roles, created_at, updated_at)
VALUES (
    'test-member-uuid-001',
    'test_member@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Member (VIP)',
    true,
    'club_go',
    'active',
    NOW() + INTERVAL '1 year',
    NOW() + INTERVAL '1 year',
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    membership_level = 'club_go',
    member_status = 'active',
    membership_expire_at = NOW() + INTERVAL '1 year',
    member_expire_at = NOW() + INTERVAL '1 year',
    updated_at = NOW();

-- 2. Free User (Inactive)
INSERT INTO users (user_id, email, password_hash, username, email_verified, membership_level, member_status, membership_expire_at, member_expire_at, roles, created_at, updated_at)
VALUES (
    'test-free-uuid-002',
    'test_free@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Free User',
    true,
    'free',
    'inactive',
    NULL,
    NULL,
    '{"user": true}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    membership_level = 'free',
    member_status = 'inactive',
    membership_expire_at = NULL,
    member_expire_at = NULL,
    updated_at = NOW();

-- 3. Admin User (Active, Super Admin)
INSERT INTO users (user_id, email, password_hash, username, email_verified, membership_level, member_status, membership_expire_at, member_expire_at, roles, created_at, updated_at)
VALUES (
    'test-admin-uuid-003',
    'test_admin@haigoo.com',
    '$2b$10$1xQE9SpQaFM94bEvBatXYe7qDT5YfKvKZi7fnWyFeNorEhjVQ6rYC',
    'Test Admin',
    true,
    'club_go',
    'active',
    NOW() + INTERVAL '10 years',
    NOW() + INTERVAL '10 years',
    '{"user": true, "admin": true, "super_admin": true}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    roles = '{"user": true, "admin": true, "super_admin": true}'::jsonb,
    updated_at = NOW();
