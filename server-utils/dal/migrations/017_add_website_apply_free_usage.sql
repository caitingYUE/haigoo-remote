ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_job_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE users
SET free_website_apply_job_ids = CASE
        WHEN jsonb_typeof(profile #> '{preferences,freeUsage,websiteApply,unlockedJobIds}') = 'array'
            THEN profile #> '{preferences,freeUsage,websiteApply,unlockedJobIds}'
        ELSE COALESCE(free_website_apply_job_ids, '[]'::jsonb)
    END
WHERE jsonb_typeof(profile #> '{preferences,freeUsage,websiteApply,unlockedJobIds}') = 'array';

UPDATE users
SET free_website_apply_count = GREATEST(
        COALESCE(free_website_apply_count, 0),
        COALESCE(NULLIF(profile #>> '{preferences,freeUsage,websiteApply,count}', '')::INTEGER, 0),
        CASE
            WHEN jsonb_typeof(free_website_apply_job_ids) = 'array'
                THEN jsonb_array_length(free_website_apply_job_ids)
            ELSE 0
        END
    ),
    updated_at = NOW()
WHERE COALESCE(free_website_apply_count, 0) = 0
   OR (profile #>> '{preferences,freeUsage,websiteApply,count}') IS NOT NULL
   OR jsonb_typeof(profile #> '{preferences,freeUsage,websiteApply,unlockedJobIds}') = 'array';
