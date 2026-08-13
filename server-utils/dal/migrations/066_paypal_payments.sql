-- PayPal website checkout, refunds, webhook audit, and payment-backed membership schedules.
-- This migration is additive and keeps redemption-code and mini-program payment flows compatible.

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS provider_capture_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code VARCHAR(128),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_provider_order_unique
  ON payment_records(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_provider_capture_unique
  ON payment_records(provider, provider_capture_id)
  WHERE provider_capture_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_user_provider_idempotency_unique
  ON payment_records(user_id, provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_user_provider_created
  ON payment_records(user_id, provider, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  resource_id VARCHAR(128),
  payment_id VARCHAR(255) REFERENCES payment_records(payment_id) ON DELETE SET NULL,
  processing_status VARCHAR(32) NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(128),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_processing
  ON payment_webhook_events(provider, processing_status, received_at DESC);

CREATE TABLE IF NOT EXISTS payment_refunds (
  refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(255) NOT NULL REFERENCES payment_records(payment_id) ON DELETE RESTRICT,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL DEFAULT 'paypal',
  provider_refund_id VARCHAR(128),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  amount_cents INTEGER,
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  reason TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'requested',
  requested_by VARCHAR(255) NOT NULL,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_refunds_status_check CHECK (
    status IN ('requested', 'rejected', 'processing', 'pending', 'completed', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_provider_refund_unique
  ON payment_refunds(provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_open_request_unique
  ON payment_refunds(payment_id)
  WHERE status IN ('requested', 'processing', 'pending');

CREATE INDEX IF NOT EXISTS idx_payment_refunds_user_created
  ON payment_refunds(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_api_rate_limits (
  key_hash VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(key_hash, action)
);

-- Generalize the existing redemption entitlement ledger to support paid orders.
ALTER TABLE membership_entitlement_segments
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_source_type_check,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_source_check,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_code_plan_fk,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_payment_fk,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_duration_months_check,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_plan_duration_check;

ALTER TABLE membership_entitlement_segments
  ALTER COLUMN source_code_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS duration_days SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE membership_entitlement_segments
  ADD CONSTRAINT membership_entitlement_segments_source_type_check
    CHECK (source_type IN ('redemption_code', 'payment')),
  ADD CONSTRAINT membership_entitlement_segments_source_check
    CHECK (
      (source_type = 'redemption_code' AND source_code_id IS NOT NULL AND source_payment_id IS NULL)
      OR
      (source_type = 'payment' AND source_code_id IS NULL AND source_payment_id IS NOT NULL)
    ),
  ADD CONSTRAINT membership_entitlement_segments_code_plan_fk
    FOREIGN KEY (source_code_id, member_type, duration_months)
    REFERENCES membership_redemption_codes(code_id, member_type, duration_months)
    ON DELETE RESTRICT,
  ADD CONSTRAINT membership_entitlement_segments_payment_fk
    FOREIGN KEY (source_payment_id)
    REFERENCES payment_records(payment_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT membership_entitlement_segments_plan_duration_check
    CHECK (
      (member_type = 'starter' AND ((duration_months = 1 AND duration_days = 0) OR (duration_months = 0 AND duration_days BETWEEN 28 AND 31)))
      OR (member_type = 'half_year' AND duration_months = 6 AND duration_days = 0)
      OR (member_type = 'annual' AND duration_months = 12 AND duration_days = 0)
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_entitlement_payment_unique
  ON membership_entitlement_segments(source_payment_id)
  WHERE source_payment_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1;

-- Recreate queue compaction with support for day-based Starter purchases.
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
    SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN 0; END IF;

    IF COALESCE((v_user.roles ->> 'admin')::BOOLEAN, false)
       OR COALESCE((v_user.roles ->> 'super_admin')::BOOLEAN, false)
       OR LOWER(COALESCE(v_user.member_status, '')) = 'lifetime'
       OR (LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro') AND v_user.member_expire_at IS NULL) THEN
        UPDATE membership_entitlement_segments
           SET superseded_at = NOW(), superseded_reason = 'non_expiring_membership', updated_at = NOW()
         WHERE user_id = p_user_id AND superseded_at IS NULL;
        GET DIAGNOSTICS v_superseded_count = ROW_COUNT;
        RETURN v_superseded_count;
    END IF;

    UPDATE membership_entitlement_segments
       SET superseded_at = NOW(), superseded_reason = 'external_membership_change', updated_at = NOW()
     WHERE user_id = p_user_id
       AND activated_at IS NOT NULL
       AND superseded_at IS NULL
       AND starts_at <= NOW()
       AND ends_at > NOW();
    GET DIAGNOSTICS v_superseded_count = ROW_COUNT;

    FOR v_segment IN
        SELECT * FROM membership_entitlement_segments
         WHERE user_id = p_user_id AND activated_at IS NULL AND superseded_at IS NULL
         ORDER BY starts_at, created_at FOR UPDATE
    LOOP
        UPDATE membership_entitlement_segments
           SET starts_at = v_cursor,
               ends_at = v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days),
               updated_at = NOW()
         WHERE segment_id = v_segment.segment_id;
        v_cursor := v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count + v_superseded_count;
END;
$$;

-- Atomically finalize a verified PayPal capture and schedule its entitlement.
CREATE OR REPLACE FUNCTION complete_paypal_payment(
  p_payment_id VARCHAR,
  p_provider_order_id VARCHAR,
  p_provider_capture_id VARCHAR,
  p_paid_amount_cents INTEGER,
  p_paid_at TIMESTAMPTZ,
  p_capture_snapshot JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_payment payment_records%ROWTYPE;
  v_user users%ROWTYPE;
  v_member_type VARCHAR(32);
  v_snapshot_plan_id VARCHAR(255);
  v_snapshot_currency VARCHAR(16);
  v_snapshot_amount_cents INTEGER;
  v_duration_months INTEGER;
  v_duration_days INTEGER;
  v_latest_end TIMESTAMPTZ;
  v_current_end TIMESTAMPTZ;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_segment_id UUID;
  v_legacy_level VARCHAR(32);
BEGIN
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'paypal' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND');
  END IF;

  IF v_payment.status = 'completed' THEN
    IF v_payment.provider_order_id IS DISTINCT FROM p_provider_order_id
       OR v_payment.provider_capture_id IS DISTINCT FROM p_provider_capture_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_CAPTURE_CONFLICT');
    END IF;
    SELECT segment_id, starts_at, ends_at INTO v_segment_id, v_starts_at, v_ends_at
      FROM membership_entitlement_segments WHERE source_payment_id = p_payment_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'alreadyCompleted', true, 'segmentId', v_segment_id,
      'startsAt', v_starts_at, 'expiresAt', v_ends_at,
      'activationState', CASE WHEN v_starts_at <= v_now THEN 'active' ELSE 'scheduled' END);
  END IF;

  IF v_payment.status NOT IN ('pending', 'approved', 'capture_pending')
     OR v_payment.provider_order_id IS DISTINCT FROM p_provider_order_id
     OR v_payment.expected_amount_cents IS DISTINCT FROM p_paid_amount_cents
     OR UPPER(COALESCE(v_payment.currency, '')) <> 'CNY' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_ORDER_MISMATCH');
  END IF;

  v_member_type := v_payment.metadata #>> '{paypal,planSnapshot,memberType}';
  v_snapshot_plan_id := v_payment.metadata #>> '{paypal,planSnapshot,id}';
  v_snapshot_currency := UPPER(COALESCE(v_payment.metadata #>> '{paypal,planSnapshot,currency}', ''));
  v_snapshot_amount_cents := COALESCE((v_payment.metadata #>> '{paypal,planSnapshot,amountCents}')::INTEGER, 0);
  v_duration_months := COALESCE((v_payment.metadata #>> '{paypal,planSnapshot,durationMonths}')::INTEGER, 0);
  v_duration_days := COALESCE((v_payment.metadata #>> '{paypal,planSnapshot,durationDays}')::INTEGER, 0);
  IF v_member_type NOT IN ('starter', 'half_year', 'annual')
     OR v_snapshot_plan_id IS DISTINCT FROM v_payment.plan_id
     OR v_snapshot_currency <> 'CNY'
     OR v_snapshot_amount_cents IS DISTINCT FROM v_payment.expected_amount_cents
     OR (v_duration_months <= 0 AND v_duration_days <= 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_PLAN_SNAPSHOT_INVALID');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || v_payment.user_id, 0));
  SELECT * INTO v_user FROM users WHERE user_id = v_payment.user_id FOR UPDATE;
  IF NOT FOUND OR LOWER(COALESCE(v_user.status, '')) <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_USER_NOT_ELIGIBLE');
  END IF;

  SELECT MAX(ends_at) INTO v_latest_end FROM membership_entitlement_segments
   WHERE user_id = v_payment.user_id AND superseded_at IS NULL AND ends_at > v_now;
  v_current_end := CASE
    WHEN LOWER(COALESCE(v_user.member_status, '')) IN ('active', 'pro') AND v_user.member_expire_at > v_now
      THEN v_user.member_expire_at ELSE v_now END;
  v_starts_at := GREATEST(v_now, COALESCE(v_current_end, v_now), COALESCE(v_latest_end, v_now));
  v_ends_at := v_starts_at + make_interval(months => v_duration_months, days => v_duration_days);
  v_legacy_level := CASE WHEN v_member_type = 'annual' THEN 'goo_plus' ELSE 'club_go' END;

  UPDATE payment_records
     SET status = 'completed', provider_status = 'COMPLETED', provider_capture_id = p_provider_capture_id,
         provider_transaction_id = p_provider_capture_id, paid_amount_cents = p_paid_amount_cents,
         paid_at = COALESCE(p_paid_at, v_now), callback_received_at = COALESCE(callback_received_at, v_now),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('paypalCapture', COALESCE(p_capture_snapshot, '{}'::jsonb)),
         updated_at = v_now
   WHERE payment_id = p_payment_id;

  INSERT INTO membership_entitlement_segments (
    user_id, source_type, source_payment_id, member_type, duration_months, duration_days,
    starts_at, ends_at, activated_at
  ) VALUES (
    v_payment.user_id, 'payment', p_payment_id, v_member_type, v_duration_months, v_duration_days,
    v_starts_at, v_ends_at, CASE WHEN v_starts_at <= v_now THEN v_now ELSE NULL END
  ) RETURNING segment_id INTO v_segment_id;

  IF v_starts_at <= v_now THEN
    UPDATE users SET member_status = 'active', member_type = v_member_type,
      membership_level = v_legacy_level, member_cycle_start_at = v_starts_at,
      member_expire_at = v_ends_at, membership_expire_at = v_ends_at,
      member_since = COALESCE(member_since, v_starts_at),
      member_display_id = COALESCE(member_display_id, nextval('member_id_seq')::int), updated_at = v_now
    WHERE user_id = v_payment.user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'alreadyCompleted', false, 'segmentId', v_segment_id,
    'memberType', v_member_type, 'startsAt', v_starts_at, 'expiresAt', v_ends_at,
    'activationState', CASE WHEN v_starts_at <= v_now THEN 'active' ELSE 'scheduled' END);
END;
$$;

-- Apply a completed provider refund exactly once and compact later entitlements.
CREATE OR REPLACE FUNCTION apply_paypal_refund(
  p_payment_id VARCHAR,
  p_provider_refund_id VARCHAR,
  p_amount_cents INTEGER,
  p_completed_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := COALESCE(p_completed_at, NOW());
  v_payment payment_records%ROWTYPE;
  v_segment membership_entitlement_segments%ROWTYPE;
  v_total_refunded INTEGER;
  v_base_at TIMESTAMPTZ;
  v_existing_status VARCHAR(32);
BEGIN
  SELECT status INTO v_existing_status FROM payment_refunds
   WHERE provider = 'paypal' AND provider_refund_id = p_provider_refund_id
   LIMIT 1 FOR UPDATE;
  IF v_existing_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'alreadyCompleted', true);
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'paypal' OR v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded', 'review_required') THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_FOUND');
  END IF;
  IF v_payment.status = 'refunded'
     AND COALESCE(v_payment.refunded_amount_cents, 0) >= COALESCE(v_payment.expected_amount_cents, 0) THEN
    RETURN jsonb_build_object('success', true, 'alreadyCompleted', true);
  END IF;
  IF p_amount_cents <= 0 OR p_amount_cents > COALESCE(v_payment.expected_amount_cents, 0) - COALESCE(v_payment.refunded_amount_cents, 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_AMOUNT_INVALID');
  END IF;

  v_total_refunded := LEAST(COALESCE(v_payment.expected_amount_cents, 0), COALESCE(v_payment.refunded_amount_cents, 0) + p_amount_cents);
  UPDATE payment_records
     SET refunded_amount_cents = v_total_refunded,
         refund_status = 'COMPLETED',
         refunded_at = v_now,
         status = CASE WHEN v_total_refunded >= expected_amount_cents THEN 'refunded' ELSE 'partially_refunded' END,
         updated_at = NOW()
   WHERE payment_id = p_payment_id;

  UPDATE payment_refunds SET provider_refund_id = p_provider_refund_id, amount_cents = p_amount_cents,
    status = 'completed', completed_at = v_now, updated_at = NOW()
  WHERE payment_id = p_payment_id AND status IN ('requested', 'processing', 'pending');
  IF NOT FOUND THEN
    INSERT INTO payment_refunds (
      payment_id, user_id, provider, provider_refund_id, amount_cents, currency,
      reason, status, requested_by, reviewed_by, reviewed_at, completed_at
    ) VALUES (
      p_payment_id, v_payment.user_id, 'paypal', p_provider_refund_id, p_amount_cents,
      COALESCE(v_payment.currency, 'CNY'), 'PayPal 后台退款或撤销', 'completed',
      'paypal_webhook', 'paypal_webhook', v_now, v_now
    );
  END IF;

  SELECT * INTO v_segment FROM membership_entitlement_segments
   WHERE source_payment_id = p_payment_id AND superseded_at IS NULL LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_segment.ends_at <= v_now THEN
    RETURN jsonb_build_object('success', true, 'alreadyCompleted', false, 'entitlementChanged', false);
  END IF;

  UPDATE membership_entitlement_segments
     SET ends_at = CASE WHEN starts_at < v_now THEN v_now ELSE ends_at END,
         superseded_at = v_now,
         superseded_reason = 'paypal_refund',
         updated_at = NOW()
   WHERE segment_id = v_segment.segment_id;

  IF v_segment.activated_at IS NOT NULL AND v_segment.starts_at <= v_now THEN
    UPDATE users SET member_status = 'free', member_type = 'none', membership_level = 'free',
      member_cycle_start_at = NULL, member_expire_at = v_now, membership_expire_at = v_now, updated_at = NOW()
    WHERE user_id = v_payment.user_id
      AND member_cycle_start_at IS NOT DISTINCT FROM v_segment.starts_at;
    v_base_at := v_now;
  ELSE
    SELECT CASE
      WHEN LOWER(COALESCE(member_status, '')) IN ('active', 'pro') AND member_expire_at > v_now THEN member_expire_at
      ELSE v_now END INTO v_base_at FROM users WHERE user_id = v_payment.user_id FOR UPDATE;
  END IF;

  PERFORM rebase_pending_membership_entitlements(v_payment.user_id, v_base_at);
  PERFORM reconcile_membership_entitlements(v_payment.user_id);
  RETURN jsonb_build_object('success', true, 'alreadyCompleted', false, 'entitlementChanged', true);
END;
$$;
