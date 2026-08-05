-- Membership redemption code distribution tracking.
-- This is an operational marker only; it never changes redemption state.

ALTER TABLE membership_redemption_codes
    ADD COLUMN IF NOT EXISTS distributed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS distributed_by VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'membership_redemption_codes_distribution_state_check'
           AND conrelid = 'membership_redemption_codes'::regclass
    ) THEN
        ALTER TABLE membership_redemption_codes
            ADD CONSTRAINT membership_redemption_codes_distribution_state_check CHECK (
                (distributed_at IS NULL AND distributed_by IS NULL)
                OR (distributed_at IS NOT NULL AND distributed_by IS NOT NULL)
            );
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_membership_redemption_codes_distribution
    ON membership_redemption_codes(distributed_at, generated_at DESC);

-- Extend the existing audit action constraints so every check/uncheck is kept.
ALTER TABLE membership_code_admin_audit
    DROP CONSTRAINT IF EXISTS membership_code_admin_audit_action_check;
ALTER TABLE membership_code_admin_audit
    ADD CONSTRAINT membership_code_admin_audit_action_check CHECK (
        action IN ('generate', 'export', 'void', 'update_batch', 'distribution')
    );

ALTER TABLE membership_code_admin_audit
    DROP CONSTRAINT IF EXISTS membership_code_admin_audit_target_check;
ALTER TABLE membership_code_admin_audit
    ADD CONSTRAINT membership_code_admin_audit_target_check CHECK (
        (action IN ('generate', 'export', 'update_batch') AND batch_id IS NOT NULL AND code_id IS NULL)
        OR (action IN ('void', 'distribution') AND batch_id IS NOT NULL AND code_id IS NOT NULL)
    );
