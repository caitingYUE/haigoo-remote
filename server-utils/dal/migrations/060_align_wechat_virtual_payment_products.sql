-- Align the persisted Club Starter plan with the published WeChat virtual
-- product: RMB 99 grants exactly 30 days, not one calendar month.

UPDATE system_settings
SET value = jsonb_set(
              jsonb_set(
                value,
                '{starter,duration_days}',
                '30'::jsonb,
                true
              ),
              '{starter,duration_months}',
              '0'::jsonb,
              true
            ),
    updated_at = NOW()
WHERE key = 'membership_plan_config';

-- Rollback:
-- UPDATE system_settings
-- SET value = jsonb_set(
--               jsonb_set(value, '{starter,duration_days}', '31'::jsonb, true),
--               '{starter,duration_months}', '1'::jsonb, true
--             ),
--     updated_at = NOW()
-- WHERE key = 'membership_plan_config';
