-- Correct migration 085 without rewriting applied history. No provider calls or monetary transfers.
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
  v_existing payment_refunds%ROWTYPE;
  v_user users%ROWTYPE;
BEGIN
  -- Match payment completion lock order; re-read the refund only after serialization.
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'wechat_virtual' THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_FOUND');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || v_payment.user_id, 0));
  SELECT * INTO v_user FROM users WHERE user_id = v_payment.user_id FOR UPDATE;
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
  -- Do not acknowledge success before delivery has been reconciled; WeChat must retry.
  IF p_refund_succeeded AND v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_PAYMENT_NOT_COMPLETED');
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
    ON CONFLICT (provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL DO UPDATE SET
      status = 'failed', metadata = payment_refunds.metadata || EXCLUDED.metadata, updated_at = NOW();
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', false, 'entitlementChanged', false, 'requiresManualReview', false);
  END IF;
  IF p_refund_amount_cents <= 0 OR p_refund_amount_cents > COALESCE(v_payment.expected_amount_cents, 0) - COALESCE(v_payment.refunded_amount_cents, 0) THEN
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
    PERFORM 1 FROM user_member_service_entitlements WHERE user_id = v_payment.user_id FOR UPDATE;
    SELECT COUNT(*)::INTEGER,
           COALESCE(BOOL_OR(e.status NOT IN ('available', 'unused', 'unavailable', 'not_scheduled') OR e.used_quota > 0
             OR EXISTS (SELECT 1 FROM member_crm_service_records c WHERE c.user_id = e.user_id
               AND c.entitlement_key = e.entitlement_key AND c.archived_at IS NULL AND c.status <> 'cancelled')), FALSE)
      INTO v_service_count, v_has_consumed_service
      FROM user_member_service_entitlements e
     WHERE e.user_id = v_payment.user_id AND e.metadata->>'sourcePaymentId' = p_payment_id;
    -- The old service ledger is per-user, not per-order: ambiguous legacy grants need review.
    IF v_segment.member_type = 'half_year' AND EXISTS (
      SELECT 1 FROM user_member_service_entitlements e WHERE e.user_id = v_payment.user_id
        AND e.entitlement_key IN ('career_direction_diagnosis','bilingual_resume_optimization','custom_job_search_materials')
        AND e.metadata->>'sourcePaymentId' IS DISTINCT FROM p_payment_id
    ) THEN v_has_consumed_service := TRUE; END IF;
    IF v_segment.activated_at IS NOT NULL AND v_segment.ends_at > v_now
       AND (v_user.member_cycle_start_at IS DISTINCT FROM v_segment.starts_at
         OR v_user.member_expire_at IS DISTINCT FROM v_segment.ends_at
         OR v_user.member_type IS DISTINCT FROM v_segment.member_type) THEN
      v_has_consumed_service := TRUE;
    END IF;
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
  ON CONFLICT (provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL DO UPDATE SET
    amount_cents = EXCLUDED.amount_cents,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    metadata = payment_refunds.metadata || EXCLUDED.metadata,
    updated_at = NOW();

  IF NOT v_requires_review THEN
    UPDATE payment_refunds SET status = 'completed', updated_at = v_now,
      metadata = metadata || jsonb_build_object('resolvedByFullRefund',p_provider_refund_id)
    WHERE payment_id = p_payment_id AND provider = 'wechat_virtual' AND status = 'review_required';
  END IF;
  IF v_requires_review THEN
    RETURN jsonb_build_object('success', true, 'alreadyProcessed', false, 'entitlementChanged', false, 'requiresManualReview', true);
  END IF;

  UPDATE membership_entitlement_segments
     SET superseded_at = v_now,
         superseded_reason = 'wechat_virtual_refund',
         updated_at = v_now
   WHERE segment_id = v_segment.segment_id;
  v_entitlement_changed := TRUE;

  INSERT INTO user_member_service_entitlement_audit
    (user_id, entitlement_key, before_snapshot, after_snapshot, reason)
    SELECT user_id, entitlement_key, to_jsonb(e),
      to_jsonb(e) || jsonb_build_object('status','unavailable','remaining_quota',0),
      'wechat_virtual_refund:' || p_provider_refund_id
    FROM user_member_service_entitlements e WHERE user_id = v_payment.user_id
      AND metadata->>'sourcePaymentId' = p_payment_id;
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

  SELECT GREATEST(v_now, COALESCE(member_expire_at, v_now)) INTO v_base_at
    FROM users WHERE user_id = v_payment.user_id;
  PERFORM rebase_pending_membership_entitlements_after_refund(v_payment.user_id, v_base_at);
  PERFORM reconcile_membership_entitlements(v_payment.user_id);
  RETURN jsonb_build_object('success', true, 'alreadyProcessed', false,
    'entitlementChanged', v_entitlement_changed, 'requiresManualReview', false,
    'serviceEntitlementsFound', v_service_count);
END;
$$;

-- Payment and its entitlement are one atomic transaction, serialized with refunds/lifecycle.
CREATE OR REPLACE FUNCTION complete_wechat_virtual_payment(
  p_payment_id VARCHAR, p_transaction_id VARCHAR, p_amount INTEGER, p_notification JSONB, p_app_id TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_payment payment_records%ROWTYPE;
  v_user users%ROWTYPE;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_type TEXT;
  v_months INTEGER;
BEGIN
  SELECT * INTO v_payment FROM payment_records WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.payment_method IS DISTINCT FROM 'wechat_virtual'
    OR v_payment.app_id IS DISTINCT FROM p_app_id
    OR v_payment.openid IS DISTINCT FROM p_notification->>'OpenId'
    OR v_payment.product_id IS DISTINCT FROM p_notification #>> '{GoodsInfo,ProductId}'
    OR v_payment.expected_amount_cents IS DISTINCT FROM p_amount
    OR (v_payment.metadata #>> '{virtualPayment,env}')::int IS DISTINCT FROM (p_notification->>'Env')::int THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOTIFICATION_MISMATCH');
  END IF;
  IF v_payment.status IN ('completed','partially_refunded','refunded') THEN
    RETURN jsonb_build_object('success', v_payment.provider_transaction_id IS NOT DISTINCT FROM p_transaction_id,
      'alreadyCompleted', true, 'code', 'PAYMENT_TRANSACTION_CONFLICT');
  END IF;
  IF v_payment.status NOT IN ('pending','cancelled','failed') THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_STATUS_INVALID');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || v_payment.user_id, 0));
  SELECT * INTO v_user FROM users WHERE user_id = v_payment.user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND'); END IF;
  v_type := v_payment.metadata #>> '{virtualPayment,planSnapshot,memberType}';
  v_months := (v_payment.metadata #>> '{virtualPayment,planSnapshot,durationMonths}')::int;
  IF NOT ((v_type = 'starter' AND v_months = 1) OR (v_type = 'quarter' AND v_months = 3)
      OR (v_type = 'half_year' AND v_months = 6)) OR v_type IS NULL OR v_months IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_PLAN_INVALID');
  END IF;
  SELECT GREATEST(NOW(), COALESCE(v_user.member_expire_at, NOW()), COALESCE(MAX(ends_at), NOW())) INTO v_start
    FROM membership_entitlement_segments WHERE user_id = v_payment.user_id AND superseded_at IS NULL;
  v_end := v_start + make_interval(months => v_months);
  INSERT INTO membership_entitlement_segments (user_id, source_type, source_payment_id, member_type,
    duration_months, duration_days, starts_at, ends_at)
    VALUES (v_payment.user_id, 'payment', p_payment_id, v_type, v_months, 0, v_start, v_end);
  UPDATE payment_records SET status = 'completed', provider_status = 'paid', provider_transaction_id = p_transaction_id,
    paid_amount_cents = p_amount, paid_at = COALESCE(to_timestamp(NULLIF((p_notification #>> '{WeChatPayInfo,PaidTime}')::bigint,0)),NOW()),
    callback_received_at = NOW(), metadata = metadata || jsonb_build_object('wechatNotification',p_notification), updated_at = NOW()
    WHERE payment_id = p_payment_id;
  PERFORM reconcile_membership_entitlements(v_payment.user_id);
  RETURN jsonb_build_object('success', true, 'alreadyCompleted', false);
END;
$$;

CREATE OR REPLACE FUNCTION ensure_mini_half_year_services(p_user_id VARCHAR, p_keys TEXT[])
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_user users%ROWTYPE;
  v_payment_id VARCHAR;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || p_user_id, 0));
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_user.member_type IS DISTINCT FROM 'half_year' OR v_user.member_status NOT IN ('active','pro')
     OR v_user.member_expire_at IS NULL OR v_user.member_expire_at <= NOW()
     OR v_user.member_cycle_start_at > NOW() THEN RETURN; END IF;
  SELECT source_payment_id INTO v_payment_id FROM membership_entitlement_segments
    WHERE user_id = p_user_id AND superseded_at IS NULL AND activated_at IS NOT NULL
      AND starts_at = v_user.member_cycle_start_at AND ends_at = v_user.member_expire_at LIMIT 1;
  IF EXISTS (SELECT 1 FROM payment_records WHERE payment_id = v_payment_id AND refunded_amount_cents > 0) THEN RETURN; END IF;
  INSERT INTO user_member_service_entitlements (user_id, entitlement_key, status, total_quota, used_quota,
    remaining_quota, expires_at, metadata, notes)
    SELECT p_user_id, entitlement_key, 'available', 1, 0, 1, v_user.member_expire_at,
      jsonb_strip_nulls(jsonb_build_object('source','mini_half_year_upgrade','existing_right',true,'sourcePaymentId',v_payment_id)),
      '半年会员既有服务权益'
    FROM member_service_entitlement_definitions WHERE enabled AND entitlement_key = ANY(p_keys)
    ON CONFLICT (user_id, entitlement_key) DO UPDATE SET
      expires_at = EXCLUDED.expires_at, status = EXCLUDED.status, used_quota = 0, remaining_quota = 1,
      metadata = EXCLUDED.metadata, updated_at = NOW()
    WHERE user_member_service_entitlements.metadata ? 'revokedByRefund'
      AND v_payment_id IS NOT NULL
      AND user_member_service_entitlements.metadata->>'sourcePaymentId' IS DISTINCT FROM v_payment_id
      AND user_member_service_entitlements.used_quota = 0;
END;
$$;
