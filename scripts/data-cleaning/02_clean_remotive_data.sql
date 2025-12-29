-- Remotive Data Cleaning Script
-- Use this script to reset stuck Remotive items and clean up bad data

-- 1. Reset 'error' status for Remotive items in raw_rss to 'raw' to retry processing
-- This allows the improved process-rss script to try handling them again
UPDATE raw_rss 
SET status = 'raw', processing_error = NULL
WHERE source = 'Remotive' AND status = 'error';

-- 2. Clean up 'Unknown Company' jobs from Remotive
-- If any jobs were created with 'Unknown Company', we should delete them
-- and reset their raw data to 'raw' so they can be re-processed (hopefully with better extraction)

-- Step 2a: Mark raw items as 'raw' for jobs we are about to delete
UPDATE raw_rss
SET status = 'raw'
WHERE raw_id IN (
    SELECT raw_data_id 
    FROM jobs 
    WHERE source = 'Remotive' AND company = 'Unknown Company'
);

-- Step 2b: Delete the bad jobs
DELETE FROM jobs 
WHERE source = 'Remotive' AND company = 'Unknown Company';

-- 3. Diagnostic queries (Run these to verify state)
-- Check how many Remotive items are still in 'raw' state (should be > 0 after reset)
-- SELECT count(*) FROM raw_rss WHERE source = 'Remotive' AND status = 'raw';

-- Check if any Unknown Company jobs remain
-- SELECT count(*) FROM jobs WHERE source = 'Remotive' AND company = 'Unknown Company';
