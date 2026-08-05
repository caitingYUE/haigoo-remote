-- Membership redemption codes and scheduled entitlement segments.

CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1;

-- Keep the legacy member number sequence ahead of existing assignments. This is
-- safe on empty databases and prevents a newly redeemed member from reusing an
-- existing display number in databases where the sequence was created late.
SELECT setval(
    'member_id_seq',
    GREATEST(
        COALESCE((SELECT MAX(member_display_id) FROM users), 0),
        (SELECT last_value FROM member_id_seq),
        1
    ),
    true
);

-- Migration 056 normally owns this table. Re-declaring it here keeps the
-- redemption feature deployable in databases with incomplete migration history.
CREATE TABLE IF NOT EXISTS mini_rate_limits (
    key_hash VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key_hash, action)
);

CREATE INDEX IF NOT EXISTS idx_mini_rate_limits_updated_at
    ON mini_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS membership_code_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_key VARCHAR(120) UNIQUE NOT NULL,
    name VARCHAR(160) NOT NULL,
    channel VARCHAR(160) NOT NULL,
    member_type VARCHAR(32) NOT NULL CHECK (member_type IN ('starter', 'half_year', 'annual')),
    duration_months SMALLINT NOT NULL CHECK (duration_months IN (1, 6, 12)),
    code_count INTEGER NOT NULL CHECK (code_count > 0 AND code_count <= 500),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT membership_code_batches_identity_plan_unique
        UNIQUE (batch_id, member_type, duration_months),
    CONSTRAINT membership_code_batches_plan_duration_check CHECK (
        (member_type = 'starter' AND duration_months = 1)
        OR (member_type = 'half_year' AND duration_months = 6)
        OR (member_type = 'annual' AND duration_months = 12)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_code_batches_name_lower
    ON membership_code_batches (LOWER(name));

CREATE TABLE IF NOT EXISTS membership_redemption_codes (
    code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES membership_code_batches(batch_id) ON DELETE RESTRICT,
    code_hash CHAR(64) UNIQUE NOT NULL,
    code_ciphertext TEXT NOT NULL,
    code_last4 VARCHAR(4) NOT NULL,
    member_type VARCHAR(32) NOT NULL CHECK (member_type IN ('starter', 'half_year', 'annual')),
    duration_months SMALLINT NOT NULL CHECK (duration_months IN (1, 6, 12)),
    usage_limit SMALLINT NOT NULL DEFAULT 1 CHECK (usage_limit = 1),
    use_count SMALLINT NOT NULL DEFAULT 0 CHECK (use_count BETWEEN 0 AND 1),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_by_user_id VARCHAR(255),
    redeemed_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    voided_by VARCHAR(255),
    void_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (expires_at > generated_at),
    CONSTRAINT membership_redemption_codes_one_year_check
        CHECK (expires_at = generated_at + INTERVAL '1 year'),
    CONSTRAINT membership_redemption_codes_plan_duration_check CHECK (
        (member_type = 'starter' AND duration_months = 1)
        OR (member_type = 'half_year' AND duration_months = 6)
        OR (member_type = 'annual' AND duration_months = 12)
    ),
    CONSTRAINT membership_redemption_codes_hash_format_check CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT membership_redemption_codes_last4_format_check
        CHECK (code_last4 ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),
    CONSTRAINT membership_redemption_codes_usage_state_check CHECK (
        (use_count = 0 AND redeemed_at IS NULL AND redeemed_by_user_id IS NULL)
        OR (use_count = 1 AND redeemed_at IS NOT NULL AND redeemed_by_user_id IS NOT NULL)
    ),
    CONSTRAINT membership_redemption_codes_terminal_state_check
        CHECK (NOT (voided_at IS NOT NULL AND redeemed_at IS NOT NULL)),
    CONSTRAINT membership_redemption_codes_void_state_check CHECK (
        (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
        OR (voided_at IS NOT NULL AND voided_by IS NOT NULL)
    ),
    CONSTRAINT membership_redemption_codes_identity_plan_unique
        UNIQUE (code_id, member_type, duration_months),
    CONSTRAINT membership_redemption_codes_batch_plan_fk
        FOREIGN KEY (batch_id, member_type, duration_months)
        REFERENCES membership_code_batches(batch_id, member_type, duration_months)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_membership_redemption_codes_batch
    ON membership_redemption_codes(batch_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_redemption_codes_status
    ON membership_redemption_codes(use_count, expires_at, voided_at);
CREATE INDEX IF NOT EXISTS idx_membership_redemption_codes_redeemed_user
    ON membership_redemption_codes(redeemed_by_user_id, redeemed_at DESC)
    WHERE redeemed_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS membership_entitlement_segments (
    segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_type VARCHAR(32) NOT NULL DEFAULT 'redemption_code' CHECK (source_type = 'redemption_code'),
    source_code_id UUID UNIQUE NOT NULL REFERENCES membership_redemption_codes(code_id) ON DELETE RESTRICT,
    member_type VARCHAR(32) NOT NULL CHECK (member_type IN ('starter', 'half_year', 'annual')),
    duration_months SMALLINT NOT NULL CHECK (duration_months IN (1, 6, 12)),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    superseded_reason VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at),
    CONSTRAINT membership_entitlement_segments_plan_duration_check CHECK (
        (member_type = 'starter' AND duration_months = 1)
        OR (member_type = 'half_year' AND duration_months = 6)
        OR (member_type = 'annual' AND duration_months = 12)
    ),
    CONSTRAINT membership_entitlement_segments_state_check
        CHECK (superseded_at IS NOT NULL OR superseded_reason IS NULL),
    CONSTRAINT membership_entitlement_segments_code_plan_fk
        FOREIGN KEY (source_code_id, member_type, duration_months)
        REFERENCES membership_redemption_codes(code_id, member_type, duration_months)
        ON DELETE RESTRICT
);

-- A partial/previous run using an earlier draft still receives the lifecycle
-- columns required by the final functions below.
ALTER TABLE membership_entitlement_segments
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_reason VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_membership_entitlement_segments_user_schedule
    ON membership_entitlement_segments(user_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_membership_entitlement_segments_pending
    ON membership_entitlement_segments(starts_at, user_id)
    WHERE activated_at IS NULL AND superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS membership_code_admin_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    action VARCHAR(32) NOT NULL CHECK (action IN ('generate', 'export', 'void', 'update_batch')),
    admin_user_id VARCHAR(255) NOT NULL,
    batch_id UUID REFERENCES membership_code_batches(batch_id) ON DELETE RESTRICT,
    code_id UUID REFERENCES membership_redemption_codes(code_id) ON DELETE RESTRICT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT membership_code_admin_audit_target_check CHECK (
        (action IN ('generate', 'export', 'update_batch') AND batch_id IS NOT NULL AND code_id IS NULL)
        OR (action = 'void' AND batch_id IS NOT NULL AND code_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_membership_code_admin_audit_created
    ON membership_code_admin_audit(created_at DESC);

CREATE OR REPLACE FUNCTION enforce_membership_entitlement_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.superseded_at IS NULL AND EXISTS (
        SELECT 1
          FROM membership_entitlement_segments other
         WHERE other.user_id = NEW.user_id
           AND other.segment_id <> NEW.segment_id
           AND other.superseded_at IS NULL
           AND tstzrange(other.starts_at, other.ends_at, '[)')
               && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
    ) THEN
        RAISE EXCEPTION 'membership entitlement segments overlap for user %', NEW.user_id
            USING ERRCODE = '23P01';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS membership_entitlement_segments_no_overlap
    ON membership_entitlement_segments;
CREATE CONSTRAINT TRIGGER membership_entitlement_segments_no_overlap
AFTER INSERT OR UPDATE OF user_id, starts_at, ends_at, superseded_at
ON membership_entitlement_segments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_membership_entitlement_no_overlap();

CREATE OR REPLACE FUNCTION redeem_membership_code(
    p_code_hash TEXT,
    p_user_id VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_user users%ROWTYPE;
    v_code membership_redemption_codes%ROWTYPE;
    v_latest_segment_end TIMESTAMPTZ;
    v_current_end TIMESTAMPTZ;
    v_starts_at TIMESTAMPTZ;
    v_ends_at TIMESTAMPTZ;
    v_segment_id UUID;
    v_legacy_level VARCHAR(32);
    v_activation_state VARCHAR(16);
BEGIN
    IF COALESCE(BTRIM(p_code_hash), '') = '' OR COALESCE(BTRIM(p_user_id), '') = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_CODE');
    END IF;

    -- Serialize every membership scheduling decision for one user.
    PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));

    SELECT * INTO v_user
      FROM users
     WHERE user_id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND');
    END IF;

    IF LOWER(COALESCE(v_user.status, '')) <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'code', 'MEMBERSHIP_NOT_ELIGIBLE');
    END IF;

    IF COALESCE((v_user.roles ->> 'admin')::BOOLEAN, false)
       OR COALESCE((v_user.roles ->> 'super_admin')::BOOLEAN, false)
       OR LOWER(COALESCE(v_user.member_status, '')) = 'lifetime'
       OR (
            LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro')
            AND v_user.member_expire_at IS NULL
       ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'MEMBERSHIP_NOT_ELIGIBLE');
    END IF;

    -- Repair a schedule left behind by a recently completed payment/admin
    -- update before calculating the new code's dates. Otherwise the response
    -- could show a start date that is shifted again on the next status refresh.
    IF LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro')
       AND v_user.member_expire_at > v_now
       AND EXISTS (
           SELECT 1
             FROM membership_entitlement_segments segment
            WHERE segment.user_id = p_user_id
              AND segment.superseded_at IS NULL
              AND (
                  (
                      segment.activated_at IS NULL
                      AND segment.starts_at < v_user.member_expire_at
                  )
                  OR (
                      segment.activated_at IS NOT NULL
                      AND segment.starts_at <= v_now
                      AND segment.ends_at > v_now
                      AND (
                          v_user.member_cycle_start_at IS DISTINCT FROM segment.starts_at
                          OR v_user.member_expire_at IS DISTINCT FROM segment.ends_at
                          OR v_user.member_type IS DISTINCT FROM segment.member_type
                      )
                  )
              )
       ) THEN
        PERFORM rebase_pending_membership_entitlements(p_user_id, v_user.member_expire_at);
    END IF;

    SELECT * INTO v_code
      FROM membership_redemption_codes
     WHERE code_hash = p_code_hash
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_CODE');
    END IF;

    IF v_code.voided_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'CODE_VOIDED');
    END IF;
    IF v_code.use_count >= v_code.usage_limit OR v_code.redeemed_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'CODE_USED');
    END IF;
    IF v_code.expires_at <= v_now THEN
        RETURN jsonb_build_object('success', false, 'code', 'CODE_EXPIRED');
    END IF;

    SELECT MAX(ends_at)
      INTO v_latest_segment_end
     FROM membership_entitlement_segments
     WHERE user_id = p_user_id
       AND superseded_at IS NULL
       AND ends_at > v_now;

    v_current_end := CASE
        WHEN LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro')
             AND v_user.member_expire_at > v_now
        THEN v_user.member_expire_at
        ELSE v_now
    END;

    v_starts_at := GREATEST(
        v_now,
        COALESCE(v_current_end, v_now),
        COALESCE(v_latest_segment_end, v_now)
    );
    v_ends_at := v_starts_at + make_interval(months => v_code.duration_months);
    v_activation_state := CASE WHEN v_starts_at <= v_now THEN 'active' ELSE 'scheduled' END;
    v_legacy_level := CASE WHEN v_code.member_type = 'annual' THEN 'goo_plus' ELSE 'club_go' END;

    INSERT INTO membership_entitlement_segments (
        user_id, source_code_id, member_type, duration_months, starts_at, ends_at,
        activated_at
    ) VALUES (
        p_user_id, v_code.code_id, v_code.member_type, v_code.duration_months, v_starts_at, v_ends_at,
        CASE WHEN v_activation_state = 'active' THEN v_now ELSE NULL END
    )
    RETURNING segment_id INTO v_segment_id;

    UPDATE membership_redemption_codes
       SET use_count = 1,
           redeemed_by_user_id = p_user_id,
           redeemed_at = v_now,
           updated_at = v_now
     WHERE code_id = v_code.code_id;

    IF v_activation_state = 'active' THEN
        UPDATE users
           SET member_status = 'active',
               member_type = v_code.member_type,
               membership_level = v_legacy_level,
               member_cycle_start_at = v_starts_at,
               member_expire_at = v_ends_at,
               membership_expire_at = v_ends_at,
               member_since = COALESCE(member_since, v_starts_at),
               member_display_id = COALESCE(member_display_id, nextval('member_id_seq')::int),
               updated_at = v_now
         WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'segmentId', v_segment_id,
        'memberType', v_code.member_type,
        'durationMonths', v_code.duration_months,
        'startsAt', v_starts_at,
        'expiresAt', v_ends_at,
        'activationState', v_activation_state
    );
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_membership_entitlements(
    p_user_id VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_user users%ROWTYPE;
    v_segment membership_entitlement_segments%ROWTYPE;
    v_legacy_level VARCHAR(32);
    v_updated_count INTEGER := 0;
    v_rebased_count INTEGER := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));

    SELECT * INTO v_user
      FROM users
     WHERE user_id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'activated', false, 'code', 'USER_NOT_FOUND');
    END IF;

    IF LOWER(COALESCE(v_user.status, '')) <> 'active' THEN
        RETURN jsonb_build_object('success', true, 'activated', false, 'paused', true);
    END IF;

    IF (
        COALESCE((v_user.roles ->> 'admin')::BOOLEAN, false)
        OR COALESCE((v_user.roles ->> 'super_admin')::BOOLEAN, false)
        OR LOWER(COALESCE(v_user.member_status, '')) = 'lifetime'
        OR (
            LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro')
            AND v_user.member_expire_at IS NULL
        )
    ) AND EXISTS (
        SELECT 1
          FROM membership_entitlement_segments segment
         WHERE segment.user_id = p_user_id
           AND segment.superseded_at IS NULL
    ) THEN
        SELECT rebase_pending_membership_entitlements(p_user_id, v_now)
          INTO v_rebased_count;
        RETURN jsonb_build_object(
            'success', true,
            'activated', false,
            'rebased', v_rebased_count,
            'ineligible', true
        );
    END IF;

    -- Proactively repair schedules after payment/admin updates, even when the
    -- first pending segment is not due yet. This keeps the member center's
    -- upcoming dates accurate and makes rebase failures self-healing on login.
    IF EXISTS (
        SELECT 1
          FROM membership_entitlement_segments segment
         WHERE segment.user_id = p_user_id
           AND segment.superseded_at IS NULL
           AND (
               (
                   segment.activated_at IS NOT NULL
                   AND segment.starts_at <= v_now
                   AND segment.ends_at > v_now
                   AND (
                       LOWER(COALESCE(v_user.member_status, '')) NOT IN ('active', 'pro')
                       OR
                       v_user.member_cycle_start_at IS DISTINCT FROM segment.starts_at
                       OR v_user.member_expire_at IS DISTINCT FROM segment.ends_at
                       OR v_user.member_type IS DISTINCT FROM segment.member_type
                   )
               )
               OR (
                   segment.activated_at IS NULL
                   AND LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro', 'lifetime')
                   AND (
                       v_user.member_expire_at IS NULL
                       OR segment.starts_at < v_user.member_expire_at
                   )
               )
           )
    ) THEN
        SELECT rebase_pending_membership_entitlements(
            p_user_id,
            COALESCE(v_user.member_expire_at, v_now)
        ) INTO v_rebased_count;
        RETURN jsonb_build_object(
            'success', true,
            'activated', false,
            'rebased', v_rebased_count
        );
    END IF;

    SELECT * INTO v_segment
      FROM membership_entitlement_segments
     WHERE user_id = p_user_id
       AND activated_at IS NULL
       AND superseded_at IS NULL
       AND starts_at <= v_now
     ORDER BY starts_at, created_at
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'activated', false);
    END IF;

    -- A paid/admin membership update may race with the lifecycle worker. Never
    -- overwrite a newer active snapshot; move all unused redemption segments
    -- behind that snapshot instead.
    IF LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro', 'lifetime')
       AND (
           v_user.member_expire_at IS NULL
           OR v_user.member_expire_at > v_now
       ) THEN
        SELECT rebase_pending_membership_entitlements(
            p_user_id,
            COALESCE(v_user.member_expire_at, v_now)
        ) INTO v_rebased_count;
        RETURN jsonb_build_object(
            'success', true,
            'activated', false,
            'rebased', v_rebased_count
        );
    END IF;

    -- If workers were unavailable long enough for a queued segment to pass its
    -- planned end, preserve the purchased duration by rebuilding the remaining
    -- queue from now instead of silently losing the entitlement.
    IF v_segment.ends_at <= v_now THEN
        SELECT rebase_pending_membership_entitlements(p_user_id, v_now)
          INTO v_rebased_count;
        SELECT * INTO v_segment
          FROM membership_entitlement_segments
         WHERE user_id = p_user_id
           AND activated_at IS NULL
           AND superseded_at IS NULL
           AND starts_at <= v_now
           AND ends_at > v_now
         ORDER BY starts_at, created_at
         LIMIT 1
         FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', true, 'activated', false, 'rebased', v_rebased_count);
        END IF;
    END IF;

    v_legacy_level := CASE WHEN v_segment.member_type = 'annual' THEN 'goo_plus' ELSE 'club_go' END;

    UPDATE users
       SET member_status = 'active',
           member_type = v_segment.member_type,
           membership_level = v_legacy_level,
           member_cycle_start_at = v_segment.starts_at,
           member_expire_at = v_segment.ends_at,
           membership_expire_at = v_segment.ends_at,
           member_since = COALESCE(member_since, v_segment.starts_at),
           member_display_id = COALESCE(member_display_id, nextval('member_id_seq')::int),
           updated_at = v_now
     WHERE user_id = p_user_id
       AND (
           member_cycle_start_at IS DISTINCT FROM v_segment.starts_at
           OR member_expire_at IS DISTINCT FROM v_segment.ends_at
           OR member_type IS DISTINCT FROM v_segment.member_type
           OR member_status IS DISTINCT FROM 'active'
       );

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count > 0 THEN
        UPDATE membership_entitlement_segments
           SET activated_at = v_now,
               updated_at = v_now
         WHERE segment_id = v_segment.segment_id
           AND activated_at IS NULL
           AND superseded_at IS NULL;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'activated', v_updated_count > 0,
        'segmentId', v_segment.segment_id,
        'memberType', v_segment.member_type,
        'startsAt', v_segment.starts_at,
        'expiresAt', v_segment.ends_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION rebase_pending_membership_entitlements(
    p_user_id VARCHAR,
    p_base_at TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cursor TIMESTAMPTZ := GREATEST(COALESCE(p_base_at, NOW()), NOW());
    v_user users%ROWTYPE;
    v_segment membership_entitlement_segments%ROWTYPE;
    v_count INTEGER := 0;
    v_superseded_count INTEGER := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));

    SELECT * INTO v_user
      FROM users
     WHERE user_id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Non-expiring memberships and administrator accounts must never be
    -- downgraded by an old queued redemption. Preserve the audit trail while
    -- removing those segments from the executable schedule.
    IF COALESCE((v_user.roles ->> 'admin')::BOOLEAN, false)
       OR COALESCE((v_user.roles ->> 'super_admin')::BOOLEAN, false)
       OR LOWER(COALESCE(v_user.member_status, '')) = 'lifetime'
       OR (
           LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro')
           AND v_user.member_expire_at IS NULL
       ) THEN
        UPDATE membership_entitlement_segments
           SET superseded_at = NOW(),
               superseded_reason = 'non_expiring_membership',
               updated_at = NOW()
         WHERE user_id = p_user_id
           AND superseded_at IS NULL;
        GET DIAGNOSTICS v_superseded_count = ROW_COUNT;
        RETURN v_superseded_count;
    END IF;

    -- The externally updated snapshot already includes the remainder of the
    -- currently active redemption segment. Mark it as absorbed so lazy
    -- reconciliation cannot write its older end date back over the new one.
    UPDATE membership_entitlement_segments
       SET superseded_at = NOW(),
           superseded_reason = 'external_membership_change',
           updated_at = NOW()
     WHERE user_id = p_user_id
       AND activated_at IS NOT NULL
       AND superseded_at IS NULL
       AND starts_at <= NOW()
       AND ends_at > NOW();
    GET DIAGNOSTICS v_superseded_count = ROW_COUNT;

    FOR v_segment IN
        SELECT *
          FROM membership_entitlement_segments
         WHERE user_id = p_user_id
           AND activated_at IS NULL
           AND superseded_at IS NULL
         ORDER BY starts_at, created_at
         FOR UPDATE
    LOOP
        UPDATE membership_entitlement_segments
           SET starts_at = v_cursor,
               ends_at = v_cursor + make_interval(months => v_segment.duration_months),
               updated_at = NOW()
         WHERE segment_id = v_segment.segment_id;
        v_cursor := v_cursor + make_interval(months => v_segment.duration_months);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count + v_superseded_count;
END;
$$;
