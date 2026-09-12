-- Reconcile provider cumulative refunds under the payment row lock. This avoids
-- double-counting when query_order and the real refund callback race.

-- The overlap trigger is deferred. A segment can be inserted and superseded in
-- the same refund transaction, so validate the row's current state instead of
-- the stale NEW snapshot captured by the earlier INSERT event.
CREATE OR REPLACE FUNCTION enforce_membership_entitlement_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current membership_entitlement_segments%ROWTYPE;
BEGIN
  SELECT * INTO v_current
    FROM membership_entitlement_segments
   WHERE segment_id = NEW.segment_id;
  IF NOT FOUND OR v_current.superseded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM membership_entitlement_segments other
     WHERE other.user_id = v_current.user_id
       AND other.segment_id <> v_current.segment_id
       AND other.superseded_at IS NULL
       AND tstzrange(other.starts_at, other.ends_at, '[)')
           && tstzrange(v_current.starts_at, v_current.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'membership entitlement segments overlap for user %', v_current.user_id
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_current_wechat_payment_segment(
  p_payment_id VARCHAR,
  p_now TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment payment_records%ROWTYPE;
  v_user users%ROWTYPE;
  v_type TEXT;
  v_months INTEGER;
BEGIN
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'wechat_virtual' THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM membership_entitlement_segments WHERE source_payment_id = p_payment_id) THEN RETURN TRUE; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || v_payment.user_id, 0));
  SELECT * INTO v_user FROM users WHERE user_id = v_payment.user_id FOR UPDATE;
  v_type := v_payment.metadata #>> '{virtualPayment,planSnapshot,memberType}';
  IF COALESCE(v_payment.metadata #>> '{virtualPayment,planSnapshot,durationMonths}', '') !~ '^[0-9]+$' THEN
    RETURN FALSE;
  END IF;
  v_months := (v_payment.metadata #>> '{virtualPayment,planSnapshot,durationMonths}')::int;
  IF NOT FOUND OR v_user.member_status NOT IN ('active', 'pro')
     OR v_user.member_type IS DISTINCT FROM v_type
     OR v_user.member_cycle_start_at IS NULL OR v_user.member_expire_at IS NULL
     OR v_user.member_cycle_start_at > COALESCE(p_now, NOW()) OR v_user.member_expire_at <= COALESCE(p_now, NOW())
     OR v_payment.paid_at IS NULL
     OR ABS(EXTRACT(EPOCH FROM (v_payment.paid_at - v_user.member_cycle_start_at))) > 86400
     OR v_user.member_expire_at IS DISTINCT FROM v_user.member_cycle_start_at + make_interval(months => v_months)
     OR NOT ((v_type = 'starter' AND v_months = 1) OR (v_type = 'quarter' AND v_months = 3)
       OR (v_type = 'half_year' AND v_months = 6)) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM membership_entitlement_segments
     WHERE user_id = v_payment.user_id AND superseded_at IS NULL
       AND starts_at < v_user.member_expire_at AND ends_at > v_user.member_cycle_start_at
  ) THEN RETURN FALSE; END IF;
  INSERT INTO membership_entitlement_segments (
    user_id, source_type, source_payment_id, member_type, duration_months, duration_days,
    starts_at, ends_at, activated_at
  ) VALUES (
    v_payment.user_id, 'payment', p_payment_id, v_type, v_months, 0,
    v_user.member_cycle_start_at, v_user.member_expire_at, v_user.member_cycle_start_at
  );
  UPDATE payment_records SET metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('legacyRefundSegmentBackfill', jsonb_build_object('createdAt', COALESCE(p_now, NOW()))),
    updated_at = COALESCE(p_now, NOW()) WHERE payment_id = p_payment_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_wechat_virtual_refund_total(
  p_payment_id VARCHAR,
  p_provider_total_cents INTEGER,
  p_notification JSONB,
  p_completed_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment payment_records%ROWTYPE;
  v_delta INTEGER;
  v_now TIMESTAMPTZ := COALESCE(p_completed_at, NOW());
  v_result JSONB;
  v_refund_id TEXT;
  v_snapshot JSONB;
BEGIN
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'wechat_virtual'
     OR v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_FOUND');
  END IF;
  IF p_provider_total_cents IS NULL OR p_provider_total_cents < 0
     OR p_provider_total_cents > COALESCE(v_payment.paid_amount_cents, v_payment.expected_amount_cents, 0)
     OR v_payment.openid IS DISTINCT FROM p_notification->>'OpenId'
     OR (v_payment.metadata #>> '{virtualPayment,env}')::int IS DISTINCT FROM (p_notification->>'Env')::int THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_RECONCILIATION_MISMATCH');
  END IF;
  IF p_provider_total_cents >= COALESCE(v_payment.expected_amount_cents, 0)
     AND NOT EXISTS (SELECT 1 FROM membership_entitlement_segments WHERE source_payment_id = p_payment_id) THEN
    PERFORM backfill_current_wechat_payment_segment(p_payment_id, v_now);
  END IF;
  v_delta := p_provider_total_cents - COALESCE(v_payment.refunded_amount_cents, 0);
  IF v_delta < 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_RECONCILIATION_CONFLICT');
  END IF;
  IF v_delta = 0 THEN
    UPDATE payment_records SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('wechatRefundReconciliation', jsonb_build_object(
        'providerTotalCents', p_provider_total_cents, 'queriedAt', v_now)), updated_at = v_now
      WHERE payment_id = p_payment_id;
    RETURN jsonb_build_object('success', true, 'changed', false, 'alreadyProcessed', true);
  END IF;
  v_refund_id := 'query-order:' || p_payment_id || ':' || p_provider_total_cents;
  v_snapshot := COALESCE(p_notification, '{}'::jsonb) || jsonb_build_object(
    'Event', 'xpay_query_order_reconcile', 'MchOrderId', p_payment_id,
    'WxRefundId', v_refund_id, 'RefundFee', v_delta, 'RetCode', 0,
    'ProviderRefundTotal', p_provider_total_cents);
  SELECT apply_wechat_virtual_refund(p_payment_id, v_refund_id, v_delta, TRUE, v_snapshot, v_now) INTO v_result;
  IF COALESCE((v_result->>'success')::boolean, FALSE) THEN
    UPDATE payment_records SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('wechatRefundReconciliation', jsonb_build_object(
        'providerTotalCents', p_provider_total_cents, 'queriedAt', v_now)), updated_at = v_now
      WHERE payment_id = p_payment_id;
  END IF;
  RETURN COALESCE(v_result, '{}'::jsonb) || jsonb_build_object('changed',
    COALESCE((v_result->>'success')::boolean, FALSE));
END;
$$;

CREATE OR REPLACE FUNCTION apply_wechat_virtual_refund_v2(
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
  v_payment payment_records%ROWTYPE;
  v_existing payment_refunds%ROWTYPE;
  v_reconciled_at TIMESTAMPTZ;
  v_reconciled_total INTEGER;
  v_callback_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := COALESCE(p_completed_at, NOW());
BEGIN
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'wechat_virtual' THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_FOUND');
  END IF;
  IF p_provider_refund_id IS NULL OR p_provider_refund_id = '' OR p_refund_amount_cents IS NULL OR p_refund_amount_cents < 0
     OR v_payment.openid IS DISTINCT FROM p_notification->>'OpenId'
     OR (v_payment.metadata #>> '{virtualPayment,env}')::int IS DISTINCT FROM (p_notification->>'Env')::int THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_NOTIFICATION_MISMATCH');
  END IF;
  SELECT * INTO v_existing FROM payment_refunds
   WHERE provider = 'wechat_virtual' AND provider_refund_id = p_provider_refund_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payment_id <> p_payment_id OR v_existing.amount_cents <> p_refund_amount_cents THEN
      RETURN jsonb_build_object('success', false, 'code', 'REFUND_REPLAY_CONFLICT');
    END IF;
    IF v_existing.status IN ('completed', 'review_required') THEN
      RETURN jsonb_build_object('success', true, 'alreadyProcessed', true,
        'requiresManualReview', v_existing.status = 'review_required');
    END IF;
  END IF;
  v_reconciled_at := NULLIF(v_payment.metadata #>> '{wechatRefundReconciliation,queriedAt}', '')::timestamptz;
  v_reconciled_total := COALESCE(NULLIF(v_payment.metadata #>> '{wechatRefundReconciliation,providerTotalCents}', '')::int, 0);
  IF COALESCE(p_notification->>'RefundSuccTimestamp', '') ~ '^[0-9]+$'
     AND (p_notification->>'RefundSuccTimestamp')::bigint > 0 THEN
    v_callback_at := to_timestamp((p_notification->>'RefundSuccTimestamp')::bigint);
  END IF;
  IF p_refund_succeeded AND (
    COALESCE(v_payment.refunded_amount_cents, 0) >= COALESCE(v_payment.expected_amount_cents, 0)
    OR (v_callback_at IS NOT NULL AND v_reconciled_at IS NOT NULL AND v_callback_at <= v_reconciled_at
      AND COALESCE(v_payment.refunded_amount_cents, 0) >= v_reconciled_total)
  ) THEN
    INSERT INTO payment_refunds (
      payment_id, user_id, provider, provider_refund_id, amount_cents, currency,
      reason, status, requested_by, completed_at, metadata
    ) VALUES (
      p_payment_id, v_payment.user_id, 'wechat_virtual', p_provider_refund_id,
      p_refund_amount_cents, COALESCE(v_payment.currency, 'CNY'),
      '微信退款回调已由主动对账覆盖', 'reconciled_duplicate', 'wechat_refund_notify', v_now,
      COALESCE(p_notification, '{}'::jsonb) || jsonb_build_object('absorbedByProviderReconciliation', TRUE)
    ) ON CONFLICT (provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL DO NOTHING;
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', true,
      'entitlementChanged', false, 'requiresManualReview', false, 'absorbedByReconciliation', true);
  END IF;
  RETURN apply_wechat_virtual_refund(p_payment_id, p_provider_refund_id, p_refund_amount_cents,
    p_refund_succeeded, p_notification, v_now);
END;
$$;

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS payment_refunds_status_check;
ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_status_check CHECK (
  status IN ('requested', 'rejected', 'processing', 'pending', 'completed', 'failed', 'review_required', 'reconciled_duplicate')
);
