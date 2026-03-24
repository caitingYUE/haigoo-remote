
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { systemSettingsService } from './system-settings-service.js';
import {
  calculateMembershipWindow,
  getDefaultMembershipPlanConfig,
  getLegacyMembershipLevel,
  getPlanConfigByPlanId,
  normalizeMembershipPlanConfig,
  normalizeMemberType
} from '../shared/membership.js';

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
    const now = new Date();
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

    // 3. Update User Membership
    // Use raw query for atomic update if needed, but helper is fine for now
    // We need to handle `member_display_id` generation if it's new
    
    const users = await neonHelper.select('users', { user_id: payment.user_id });
    const user = users[0];

    let memberDisplayId = user.member_display_id;
    if (!memberDisplayId) {
      try {
        await neonHelper.query("CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1");
        const seqRes = await neonHelper.query("SELECT nextval('member_id_seq') as id");
        if (seqRes && seqRes[0]) {
          memberDisplayId = seqRes[0].id;
        }
      } catch (e) {
        console.warn('Failed to generate member_display_id, using fallback', e);
        memberDisplayId = Math.floor(100000 + Math.random() * 900000);
      }
    }

    const membershipWindow = calculateMembershipWindow(user, plan.duration_days, now);
    const memberType = normalizeMemberType(plan.memberType);
    const memberSince =
      user.member_since ||
      user.member_since_at ||
      user.member_cycle_start_at ||
      user.membership_start_at ||
      membershipWindow.startAtIso;
    const updateData = {
      member_status: 'active',
      member_since: memberSince,
      member_expire_at: membershipWindow.expireAtIso,
      member_cycle_start_at: membershipWindow.startAtIso,
      member_type: memberType,
      membership_level: getLegacyMembershipLevel(memberType),
      member_display_id: memberDisplayId
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    await neonHelper.update('users', updateData, { user_id: payment.user_id });

    // 4. Update Payment Record
    await neonHelper.update('payment_records', {
      status: 'completed',
      updated_at: now.toISOString()
    }, { payment_id: paymentId });

    return { success: true, membership: updateData };
  }
};
