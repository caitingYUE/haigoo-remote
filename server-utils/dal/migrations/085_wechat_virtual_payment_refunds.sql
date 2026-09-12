-- 2026-09-07: Make WeChat virtual-payment refunds reconcile orders and membership.
-- Full refunds revoke only the entitlement segment created by the refunded order.
-- Partial refunds, consumed service entitlements, and missing ledger links remain
-- auditable and require an operator decision.

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payment_refunds (
  refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(255) NOT NULL REFERENCES payment_records(payment_id) ON DELETE RESTRICT,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL,
  provider_refund_id VARCHAR(128),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  reason TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  requested_by VARCHAR(255) NOT NULL,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_refunds_status_check CHECK (
    status IN ('requested', 'rejected', 'processing', 'pending', 'completed', 'failed', 'review_required')
  )
);

ALTER TABLE payment_refunds
  DROP CONSTRAINT IF EXISTS payment_refunds_status_check;

ALTER TABLE payment_refunds
  ADD CONSTRAINT payment_refunds_status_check CHECK (
    status IN ('requested', 'rejected', 'processing', 'pending', 'completed', 'failed', 'review_required')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_provider_refund_unique
  ON payment_refunds(provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_created
  ON payment_refunds(payment_id, created_at DESC);

CREATE OR REPLACE FUNCTION rebase_pending_redemption_entitlements_after_payment(
  p_user_id VARCHAR,
  p_base_at TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cursor TIMESTAMPTZ := GREATEST(COALESCE(p_base_at, NOW()), NOW());
  v_segment membership_entitlement_segments%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));
  FOR v_segment IN
    SELECT * FROM membership_entitlement_segments
     WHERE user_id = p_user_id
       AND source_type = 'redemption_code'
       AND activated_at IS NULL
       AND superseded_at IS NULL
     ORDER BY starts_at, created_at
     FOR UPDATE
  LOOP
    UPDATE membership_entitlement_segments
       SET starts_at = v_cursor,
           ends_at = v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days),
           updated_at = NOW()
     WHERE segment_id = v_segment.segment_id;
    v_cursor := v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION rebase_pending_membership_entitlements_after_refund(
  p_user_id VARCHAR,
  p_base_at TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cursor TIMESTAMPTZ := GREATEST(COALESCE(p_base_at, NOW()), NOW());
  v_segment membership_entitlement_segments%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));
  FOR v_segment IN
    SELECT * FROM membership_entitlement_segments
     WHERE user_id = p_user_id AND activated_at IS NULL AND superseded_at IS NULL
       AND source_type = 'redemption_code'
     ORDER BY starts_at, created_at
     FOR UPDATE
  LOOP
    UPDATE membership_entitlement_segments
       SET starts_at = v_cursor,
           ends_at = v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days),
           updated_at = NOW()
     WHERE segment_id = v_segment.segment_id;
    v_cursor := v_cursor + make_interval(months => v_segment.duration_months, days => v_segment.duration_days);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

ALTER TABLE membership_entitlement_segments
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_member_type_check,
  DROP CONSTRAINT IF EXISTS membership_entitlement_segments_plan_duration_check;

ALTER TABLE membership_entitlement_segments
  ADD CONSTRAINT membership_entitlement_segments_member_type_check
    CHECK (member_type IN ('starter', 'quarter', 'quarter_pro', 'half_year', 'annual')),
  ADD CONSTRAINT membership_entitlement_segments_plan_duration_check
    CHECK (
      (member_type = 'starter' AND ((duration_months = 1 AND duration_days = 0) OR (duration_months = 0 AND duration_days BETWEEN 28 AND 31)))
      OR (member_type IN ('quarter', 'quarter_pro') AND duration_months = 3 AND duration_days = 0)
      OR (member_type = 'half_year' AND duration_months = 6 AND duration_days = 0)
      OR (member_type = 'annual' AND duration_months = 12 AND duration_days = 0)
    );

CREATE OR REPLACE FUNCTION apply_wechat_virtual_refund(
  p_payment_id VARCHAR,
  p_provider_refund_id VARCHAR,
  p_refund_amount_cents INTEGER,
  p_refund_succeeded BOOLEAN,
  p_notification JSONB,
  p_completed_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := COALESCE(p_completed_at, NOW());
  v_payment payment_records%ROWTYPE;
  v_segment membership_entitlement_segments%ROWTYPE;
  v_refund_status VARCHAR(32);
  v_payment_status VARCHAR(64);
  v_total_refunded INTEGER;
  v_is_full_refund BOOLEAN;
  v_service_count INTEGER := 0;
  v_has_consumed_service BOOLEAN := FALSE;
  v_entitlement_changed BOOLEAN := FALSE;
  v_requires_review BOOLEAN := FALSE;
  v_base_at TIMESTAMPTZ;
  v_existing JSONB;
BEGIN
  SELECT status, metadata INTO v_refund_status, v_existing
    FROM payment_refunds
   WHERE provider = 'wechat_virtual' AND provider_refund_id = p_provider_refund_id
   LIMIT 1
   FOR UPDATE;
  IF v_refund_status = 'completed' OR v_refund_status = 'review_required' THEN
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', true, 'requiresManualReview', v_refund_status = 'review_required');
  END IF;

  SELECT * INTO v_payment
    FROM payment_records
   WHERE payment_id = p_payment_id
   FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'wechat_virtual'
     OR v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_FOUND');
  END IF;
  IF v_payment.openid IS DISTINCT FROM p_notification->>'OpenId'
     OR (v_payment.metadata #>> '{virtualPayment,env}')::int IS DISTINCT FROM (p_notification->>'Env')::int THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_NOTIFICATION_MISMATCH');
  END IF;
  IF NOT p_refund_succeeded THEN
    INSERT INTO payment_refunds (
      payment_id, user_id, provider, provider_refund_id, amount_cents, currency,
      reason, status, requested_by, completed_at, metadata
    ) VALUES (
      p_payment_id, v_payment.user_id, 'wechat_virtual', p_provider_refund_id,
      GREATEST(0, COALESCE(p_refund_amount_cents, 0)), COALESCE(v_payment.currency, 'CNY'),
      '微信退款失败通知', 'failed', 'wechat_refund_notify', v_now, COALESCE(p_notification, '{}'::jsonb)
    )
    ON CONFLICT (provider, provider_refund_id) DO UPDATE SET
      status = 'failed', metadata = payment_refunds.metadata || EXCLUDED.metadata, updated_at = NOW();
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', false, 'entitlementChanged', false, 'requiresManualReview', false);
  END IF;
  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents < 0 OR p_refund_amount_cents > COALESCE(v_payment.expected_amount_cents, 0) - COALESCE(v_payment.refunded_amount_cents, 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_AMOUNT_INVALID');
  END IF;

  v_total_refunded := LEAST(COALESCE(v_payment.expected_amount_cents, 0), COALESCE(v_payment.refunded_amount_cents, 0) + p_refund_amount_cents);
  v_is_full_refund := v_total_refunded >= COALESCE(v_payment.expected_amount_cents, 0);
  v_requires_review := NOT p_refund_succeeded OR NOT v_is_full_refund;

  SELECT * INTO v_segment
    FROM membership_entitlement_segments
   WHERE source_payment_id = p_payment_id AND superseded_at IS NULL
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    v_requires_review := TRUE;
  END IF;

  IF v_is_full_refund AND NOT v_requires_review THEN
    SELECT COUNT(*)::INTEGER,
           COALESCE(BOOL_OR(status NOT IN ('available', 'unused', 'unavailable', 'not_scheduled') OR used_quota > 0), FALSE)
      INTO v_service_count, v_has_consumed_service
      FROM user_member_service_entitlements
     WHERE user_id = v_payment.user_id
       AND metadata->>'sourcePaymentId' = p_payment_id;
    IF v_has_consumed_service THEN
      v_requires_review := TRUE;
    END IF;
  END IF;

  v_payment_status := CASE WHEN v_is_full_refund THEN 'refunded' ELSE 'partially_refunded' END;
  UPDATE payment_records
     SET refunded_amount_cents = v_total_refunded,
         refund_status = CASE WHEN v_requires_review THEN 'REVIEW_REQUIRED' ELSE 'COMPLETED' END,
         refunded_at = v_now,
         status = v_payment_status,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('wechatRefund', COALESCE(p_notification, '{}'::jsonb)),
         updated_at = v_now
   WHERE payment_id = p_payment_id;

  INSERT INTO payment_refunds (
    payment_id, user_id, provider, provider_refund_id, amount_cents, currency,
    reason, status, requested_by, completed_at, metadata
  ) VALUES (
    p_payment_id, v_payment.user_id, 'wechat_virtual', p_provider_refund_id,
    p_refund_amount_cents, COALESCE(v_payment.currency, 'CNY'),
    CASE WHEN v_requires_review THEN '微信退款已完成，待人工核验权益' ELSE '微信虚拟支付全额退款' END,
    CASE WHEN v_requires_review THEN 'review_required' ELSE 'completed' END,
    'wechat_refund_notify', v_now, COALESCE(p_notification, '{}'::jsonb)
  )
  ON CONFLICT (provider, provider_refund_id) DO UPDATE SET
    amount_cents = EXCLUDED.amount_cents,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    metadata = payment_refunds.metadata || EXCLUDED.metadata,
    updated_at = NOW();

  IF v_requires_review THEN
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', false, 'entitlementChanged', false, 'requiresManualReview', true);
  END IF;

  UPDATE membership_entitlement_segments
     SET ends_at = CASE WHEN starts_at < v_now THEN v_now ELSE ends_at END,
         superseded_at = v_now,
         superseded_reason = 'wechat_virtual_refund',
         updated_at = v_now
   WHERE segment_id = v_segment.segment_id;
  v_entitlement_changed := TRUE;

  UPDATE user_member_service_entitlements
     SET status = 'unavailable', remaining_quota = 0,
         metadata = metadata || jsonb_build_object('revokedByRefund', p_provider_refund_id),
         notes = CONCAT_WS('；', notes, '微信虚拟支付全额退款自动撤销'), updated_at = v_now
   WHERE user_id = v_payment.user_id
     AND metadata->>'sourcePaymentId' = p_payment_id
     AND status IN ('available', 'unused', 'unavailable', 'not_scheduled')
     AND COALESCE(used_quota, 0) = 0;

  UPDATE users
     SET member_status = 'free', member_type = 'none', membership_level = 'free',
         member_cycle_start_at = NULL, member_expire_at = v_now, membership_expire_at = v_now,
         updated_at = v_now
   WHERE user_id = v_payment.user_id
     AND member_cycle_start_at IS NOT DISTINCT FROM v_segment.starts_at
     AND member_expire_at IS NOT DISTINCT FROM v_segment.ends_at;

  v_base_at := v_now;
  PERFORM rebase_pending_membership_entitlements_after_refund(v_payment.user_id, v_base_at);
  PERFORM reconcile_membership_entitlements(v_payment.user_id);
  RETURN jsonb_build_object('success', true, 'alreadyProcessed', false,
    'entitlementChanged', v_entitlement_changed, 'requiresManualReview', false,
    'serviceEntitlementsFound', v_service_count);
END;
$$;
