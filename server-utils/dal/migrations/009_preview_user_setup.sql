-- 2026-02-14: Admin & Member Status Reset Script for Preview Environment
-- Description: This script allows you to manually promote a user to Admin and set their Membership status.
-- Instructions: Replace 'YOUR_EMAIL@example.com' with your actual email address before running.

-- 1. Promote User to Admin (Grant full permissions)
UPDATE users 
SET roles = '{"admin": true, "user": true}'::jsonb 
WHERE email = 'YOUR_EMAIL@example.com';

-- 2. Set User as Non-Member (For testing non-member features)
-- This clears membership level and expiration to simulate a free user.
UPDATE users 
SET 
    membership_level = NULL, 
    membership_expire_at = NULL,
    member_status = 'inactive',
    member_expire_at = NULL
WHERE email = 'YOUR_EMAIL@example.com';

-- 3. (Optional) Set User as Active Member (For testing member features)
-- Uncomment the lines below to run this instead of step 2 if you need member access.
/*
UPDATE users 
SET 
    membership_level = 'club_go', 
    membership_expire_at = NOW() + INTERVAL '30 days',
    member_status = 'active',
    member_expire_at = NOW() + INTERVAL '30 days'
WHERE email = 'YOUR_EMAIL@example.com';
*/

-- 4. Check the result to confirm changes
SELECT user_id, email, roles, membership_level, member_status 
FROM users 
WHERE email = 'YOUR_EMAIL@example.com';
