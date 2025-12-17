
import neonHelper from '../../server-utils/dal/neon-helper.js';

export const subscriptionsService = {
  /**
   * Get all subscriptions
   */
  async getAll() {
    if (!neonHelper.isConfigured) return [];
    
    try {
      const result = await neonHelper.query(
        'SELECT * FROM subscriptions ORDER BY created_at DESC'
      );
      return result || [];
    } catch (error) {
      console.error('Failed to get subscriptions:', error);
      throw error;
    }
  },

  /**
   * Add a new subscription
   */
  async add(email, topic) {
    if (!neonHelper.isConfigured) throw new Error('Database not configured');

    try {
      const result = await neonHelper.query(
        `INSERT INTO subscriptions (identifier, topic, channel, status)
         VALUES ($1, $2, 'email', 'active')
         RETURNING *`,
        [email, topic]
      );
      return result[0];
    } catch (error) {
      console.error('Failed to add subscription:', error);
      throw error;
    }
  },

  /**
   * Delete a subscription
   */
  async delete(id) {
    if (!neonHelper.isConfigured) throw new Error('Database not configured');

    try {
      await neonHelper.query(
        'DELETE FROM subscriptions WHERE subscription_id = $1',
        [id]
      );
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      throw error;
    }
  },

  /**
   * Update subscription status
   */
  async updateStatus(id, status) {
    if (!neonHelper.isConfigured) throw new Error('Database not configured');

    try {
      const result = await neonHelper.query(
        'UPDATE subscriptions SET status = $1 WHERE subscription_id = $2 RETURNING *',
        [status, id]
      );
      return result[0];
    } catch (error) {
      console.error('Failed to update subscription status:', error);
      throw error;
    }
  }
};
