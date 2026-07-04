
import neonHelper from '../../server-utils/dal/neon-helper.js';

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['active', 'inactive', 'bounced'].includes(value) ? value : 'active';
}

function normalizeTopic(topic) {
  return String(topic || '').split(',').map(item => item.trim()).filter(Boolean).join(',');
}

function normalizePreferences(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {};
  }
  return preferences;
}

function normalizeCustomTopics(input, customTopic) {
  const source = Array.isArray(input)
    ? input
    : String(customTopic || '').split(',');
  const seen = new Set();

  return source
    .map(item => String(item || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createSubscriptionId() {
  return String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

export const subscriptionsService = {
  /**
   * Get all subscriptions for admin management
   */
  async getAll(filters = {}) {
    if (!neonHelper.isConfigured) return [];
    
    try {
      const params = [];
      const where = [];

      if (filters.status && filters.status !== 'all') {
        params.push(normalizeStatus(filters.status));
        where.push(`s.status = $${params.length}`);
      }

      if (filters.channel && filters.channel !== 'all') {
        params.push(String(filters.channel).trim());
        where.push(`s.channel = $${params.length}`);
      }

      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(
          LOWER(COALESCE(s.identifier, '')) LIKE $${params.length}
          OR LOWER(COALESCE(s.topic, '')) LIKE $${params.length}
          OR LOWER(COALESCE(u.email, '')) LIKE $${params.length}
          OR LOWER(COALESCE(u.username, '')) LIKE $${params.length}
        )`);
      }

      const result = await neonHelper.query(
        `SELECT
           s.*,
           u.email AS user_email,
           u.username AS user_name,
           u.member_status,
           u.member_type,
           u.member_expire_at,
           u.membership_level
         FROM subscriptions s
         LEFT JOIN users u
           ON u.user_id::text = s.user_id::text
           OR (s.user_id IS NULL AND LOWER(u.email) = LOWER(s.identifier))
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY s.created_at DESC`,
        params
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
        `INSERT INTO subscriptions (subscription_id, identifier, topic, channel, status, frequency, last_active_at, updated_at)
         VALUES ($1, $2, $3, 'email', 'active', 'daily', NOW(), NOW())
         RETURNING *`,
        [createSubscriptionId(), email, normalizeTopic(topic)]
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
   * Soft delete keeps history for admin review and digest failure diagnosis.
   */
  async softDelete(id) {
    if (!neonHelper.isConfigured) throw new Error('Database not configured');

    try {
      const result = await neonHelper.query(
        `UPDATE subscriptions
            SET status = 'inactive',
                updated_at = NOW()
          WHERE subscription_id = $1
          RETURNING *`,
        [id]
      );
      return result[0] || null;
    } catch (error) {
      console.error('Failed to soft delete subscription:', error);
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
        `UPDATE subscriptions
            SET status = $1::text,
                last_active_at = CASE WHEN $1::text = 'active' THEN NOW() ELSE last_active_at END,
                updated_at = NOW()
          WHERE subscription_id = $2
          RETURNING *`,
        [normalizeStatus(status), id]
      );
      return result[0];
    } catch (error) {
      console.error('Failed to update subscription status:', error);
      throw error;
    }
  },

  async getForUser(user) {
    if (!neonHelper.isConfigured) return [];

    const result = await neonHelper.query(
      `SELECT *
         FROM subscriptions
        WHERE user_id = $1
           OR (channel = 'email' AND LOWER(identifier) = LOWER($2))
        ORDER BY created_at DESC`,
      [user.user_id || user.userId, user.email]
    );
    return result || [];
  },

  async upsertForUser(user, { topics, customTopic, customTopics, status = 'active' }) {
    if (!neonHelper.isConfigured) throw new Error('Database not configured');

    const userId = user.user_id || user.userId;
    const email = String(user.email || '').trim().toLowerCase();
    const normalizedTopics = Array.isArray(topics)
      ? topics.map(item => String(item || '').trim()).filter(Boolean)
      : normalizeTopic(topics).split(',').filter(Boolean);
    const normalizedCustomTopics = normalizeCustomTopics(customTopics, customTopic);
    const topic = normalizeTopic([...normalizedTopics, ...normalizedCustomTopics].filter(Boolean).join(','));
    const preferences = normalizePreferences({
      topics: normalizedTopics,
      customTopic: normalizedCustomTopics[0] || null,
      customTopics: normalizedCustomTopics,
      source: 'home_member_email_subscription',
      updatedBy: userId
    });

    const existing = await neonHelper.query(
      `SELECT subscription_id
         FROM subscriptions
        WHERE (user_id::text = $1::text OR (channel = 'email' AND LOWER(identifier) = LOWER($2)))
          AND channel = 'email'
        ORDER BY
          CASE WHEN user_id::text = $1::text THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 1`,
      [userId, email]
    );

    if (existing?.[0]?.subscription_id) {
      const result = await neonHelper.query(
        `UPDATE subscriptions
            SET user_id = $1,
                identifier = $2,
                topic = $3,
                preferences = $4::jsonb,
                frequency = 'daily',
                status = $5::text,
                last_active_at = CASE WHEN $5::text = 'active' THEN NOW() ELSE last_active_at END,
                updated_at = NOW()
          WHERE subscription_id = $6
          RETURNING *`,
        [userId, email, topic, JSON.stringify(preferences), normalizeStatus(status), existing[0].subscription_id]
      );
      return result[0] || null;
    }

    const result = await neonHelper.query(
      `INSERT INTO subscriptions (
          subscription_id, user_id, identifier, topic, preferences, channel, frequency, status,
          last_active_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, 'email', 'daily', $6::text, NOW(), NOW(), NOW())
       RETURNING *`,
      [createSubscriptionId(), userId, email, topic, JSON.stringify(preferences), normalizeStatus(status)]
    );

    return result[0] || null;
  }
};
