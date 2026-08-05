
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { systemSettingsService } from './system-settings-service.js';
import {
  getDefaultMembershipPlanConfig,
  getLegacyMembershipLevel,
  getPlanConfigByPlanId,
  normalizeMembershipPlanConfig,
  normalizeMemberType
} from '../shared/membership.js';
import { trackServerAnalyticsEvent } from './analytics-event-service.js';
import { rebasePendingMembershipEntitlements } from './membership-redemption-code-service.js';

/**
 * Service to handle payment logic
 * Currently implements a mock flow for Staging/Dev environments
 */
export const paymentService = {
  /**
   * Create a new payment record
   */
  async createPaymentRecord({ userId, planId, amount, currency = 'CNY', paymentMethod }) {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await neonHelper.insert('payment_records', {
      payment_id: paymentId,
      user_id: userId,
      amount,
      currency,
      payment_method: paymentMethod,
      status: 'pending',
      plan_id: planId
    });

    return paymentId;
  },

  /**
   * Generate payment URL (Mock implementation)
   * In production, this would call WeChat/Alipay API to get the payment URL/QR code
   */
  async generatePaymentUrl(paymentId, amount, paymentMethod) {
    // For staging/dev, return a link to our internal mock gateway
    // This allows testing the full flow without real money
    const baseUrl = process.env.SITE_URL || 'http://localhost:3000';
    return `${baseUrl}/mock-payment-gateway?paymentId=${paymentId}&amount=${amount}&method=${paymentMethod}`;
  },

  /**
   * Confirm payment and activate membership
   */
  async confirmPayment(paymentId, options = {}) {
    const { requesterUserId = null, requesterIsAdmin = false } = options;
    
    // 1. Get payment record
    const payments = await neonHelper.select('payment_records', { payment_id: paymentId });
    if (!payments || payments.length === 0) {
      throw new Error('Payment not found');
    }
    const payment = payments[0];

    if (!requesterIsAdmin && requesterUserId && payment.user_id !== requesterUserId) {
      throw new Error('Forbidden');
    }

    if (payment.status === 'completed') {
      return { success: true, message: 'Already completed' };
    }

    const planConfig = normalizeMembershipPlanConfig(
      await systemSettingsService.getSetting('membership_plan_config') || getDefaultMembershipPlanConfig()
    );
    const plan = getPlanConfigByPlanId(payment.plan_id, planConfig);
    if (!plan) {
      throw new Error(`Unknown membership plan: ${payment.plan_id}`);
    }

    // 3. Atomically complete the payment and extend the user snapshot. The old
    // multi-statement flow could apply the membership twice when two confirm
    // requests raced between the user update and the payment status update.
    const users = await neonHelper.select('users', { user_id: payment.user_id });
    const user = users[0];
    if (!user) throw new Error('Payment user not found');

    const memberType = normalizeMemberType(plan.memberType);
    const monthDurations = { starter: 1, quarter: 3, quarter_pro: 3, half_year: 6, annual: 12 };
    const durationMonths = Number(monthDurations[memberType] || 0);
    const durationDays = durationMonths ? 0 : Math.max(0, Number(plan.duration_days || 0));
    const legacyLevel = getLegacyMembershipLevel(memberType);
    await neonHelper.query("CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1");
    const completedRows = await neonHelper.query(
      `WITH completed_payment AS (
         UPDATE payment_records
            SET status = 'completed', updated_at = NOW()
          WHERE payment_id = $1
            AND user_id = $2
            AND status = 'pending'
          RETURNING user_id
       ), updated_user AS (
         UPDATE users AS target
            SET member_status = 'active',
                member_since = COALESCE(target.member_since, NOW()),
                member_cycle_start_at = CASE
                  WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                    THEN target.member_expire_at
                  ELSE NOW()
                END,
                member_expire_at = (
                  CASE
                    WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                      THEN target.member_expire_at
                    ELSE NOW()
                  END
                  + make_interval(months => $3::int, days => $4::int)
                ),
                membership_expire_at = (
                  CASE
                    WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                      THEN target.member_expire_at
                    ELSE NOW()
                  END
                  + make_interval(months => $3::int, days => $4::int)
                ),
                member_type = $5,
                membership_level = $6,
                member_display_id = COALESCE(target.member_display_id, nextval('member_id_seq')::int),
                updated_at = NOW()
           FROM completed_payment
          WHERE target.user_id = completed_payment.user_id
          RETURNING target.user_id, target.member_status, target.member_type,
                    target.member_expire_at, target.member_cycle_start_at,
                    target.membership_level, target.member_display_id
       )
       SELECT * FROM updated_user`,
      [paymentId, payment.user_id, durationMonths, durationDays, memberType, legacyLevel]
    );

    if (!completedRows?.[0]) {
      const latestRows = await neonHelper.select('payment_records', { payment_id: paymentId });
      if (latestRows?.[0]?.status === 'completed') {
        return { success: true, message: 'Already completed' };
      }
      throw new Error('Payment could not be completed');
    }

    try {
      await rebasePendingMembershipEntitlements(payment.user_id, completedRows[0].member_expire_at);
    } catch (error) {
      console.error('[payment-service] Failed to rebase pending redemption entitlements:', error?.message || error);
    }

    try {
      await trackServerAnalyticsEvent({
        event: 'membership_payment_success',
        properties: {
          feature_key: 'membership_payment',
          source_key: 'payment_confirm',
          entity_type: 'plan',
          entity_id: payment.plan_id,
          payment_id: paymentId,
          payment_method: payment.payment_method,
        }
      }, {
        user: {
          ...user,
          member_type: memberType,
          member_status: 'active'
        },
        userId: payment.user_id,
        anonymousId: `user_${payment.user_id}`,
        pageKey: 'membership',
        module: 'membership_payment',
        featureKey: 'membership_payment',
        sourceKey: 'payment_confirm',
        entityType: 'plan',
        entityId: payment.plan_id,
        flowId: paymentId,
      });
    } catch (error) {
      console.warn('[payment-service] Analytics tracking failed:', error?.message || error);
    }

    return { success: true, membership: completedRows[0] };
  }
};
