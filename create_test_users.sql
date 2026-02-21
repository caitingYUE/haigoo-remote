-- SQL script to create test users in Neon DB
-- Run this in the Neon SQL Editor or via psql

-- 1. Create Admin User (admin@haigoo.com)
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
    'admin@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder hash (needs real bcrypt hash)
    '{"admin": true}', 
    'active', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- 2. Create Member User (member@haigoo.com)
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
    'member@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder hash
    '{}', 
    'active', 
    NOW() + INTERVAL '1 year', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- 3. Create Free User (free@haigoo.com)
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
    'free@haigoo.com', 
    '$2b$10$EpIx.i.v.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E', -- Placeholder hash
    '{}', 
    'inactive', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Note: The password_hash above is a dummy. 
-- To log in, you may need to reset the password via the "Forgot Password" flow 
-- or manually update the hash with a known bcrypt hash.
