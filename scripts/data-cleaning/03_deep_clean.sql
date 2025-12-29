
-- Deep Data Cleaning Script for Haigoo Job Board

-- 1. Remove "Test Corp" jobs
DELETE FROM jobs 
WHERE company ILIKE '%Test Corp%' OR title ILIKE '%Test Job%';

-- 2. Remove non-job content (Legal, Privacy Policy, Terms) from Buffer and others
-- These usually have titles like "Legal", "Privacy Policy", or "Terms of Service"
DELETE FROM jobs
WHERE 
  title ILIKE 'Legal' OR 
  title ILIKE 'Privacy Policy' OR 
  title ILIKE 'Terms of Service' OR 
  title ILIKE 'Cookie Policy' OR
  title ILIKE 'Security' AND length(description) < 500; -- Security might be a valid job title, check desc length

-- Remove jobs with "合法的" (Translation of Legal)
DELETE FROM jobs WHERE title = '合法的';

-- 3. Remove jobs with extremely short descriptions (likely parsing errors)
DELETE FROM jobs WHERE length(description) < 100;

-- 4. Fix Amgen data (if possible) or delete corrupted entries
-- Identify corrupted Amgen jobs by checking for critical missing fields or bad formatting
-- For now, we can try to delete Amgen jobs that are likely to crash (e.g. missing critical fields)
-- But the crash is likely frontend-side due to Logo. 
-- However, we can clean up any Amgen jobs with suspicious data just in case.
DELETE FROM jobs 
WHERE company ILIKE 'Amgen' AND (title IS NULL OR title = '');

-- 5. General Cleanup
-- Remove jobs with no company name
DELETE FROM jobs WHERE company IS NULL OR company = '' OR company = 'Unknown Company';

-- Remove jobs with no title
DELETE FROM jobs WHERE title IS NULL OR title = '';

-- 6. Reset raw_rss status for the deleted jobs (Optional, but good practice if we want to retry properly)
-- This is complex to do via SQL join on parsed data, so we skip it for this deep clean 
-- assuming the bad data source will be fixed by code changes.
