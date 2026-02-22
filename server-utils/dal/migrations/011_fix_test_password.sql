-- Update password for test user
-- New Hash for 'Haigoo2026!': $2b$10$Ue/uf0PISotCtZVb2ss5s.13lV41fVSfMayuABizUUuVgG3c47vI.

UPDATE users 
SET password_hash = '$2b$10$Ue/uf0PISotCtZVb2ss5s.13lV41fVSfMayuABizUUuVgG3c47vI.'
WHERE email = 'test_free@haigoo.com';

-- Verify update
SELECT email, password_hash FROM users WHERE email = 'test_free@haigoo.com';
