
import neonHelper from '../../server-utils/dal/neon-helper.js';

export const systemSettingsService = {
  /**
   * Get a system setting by key
   */
  async getSetting(key) {
    if (!neonHelper.isConfigured) return null;
    
    try {
      const result = await neonHelper.query(
        'SELECT value FROM system_settings WHERE key = $1',
        [key]
      );
      
      if (result && result.length > 0) {
        return result[0].value;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a system setting
   */
  async setSetting(key, value, description = null) {
    if (!neonHelper.isConfigured) return false;

    try {
      if (description) {
        await neonHelper.query(
          `INSERT INTO system_settings (key, value, description, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           description = EXCLUDED.description,
           updated_at = NOW()`,
          [key, JSON.stringify(value), description]
        );
      } else {
        await neonHelper.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = NOW()`,
          [key, JSON.stringify(value)]
        );
      }
      return true;
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      return false;
    }
  },

  /**
   * Increment AI token usage
   * @param {Object} usage { input: number, output: number, total: number }
   */
  async incrementTokenUsage(usage) {
    if (!neonHelper.isConfigured) return false;
    if (!usage || (usage.input === 0 && usage.output === 0)) return true;

    try {
      // Use atomic update if possible, but JSONB update is tricky in simple SQL without specific operators
      // We'll read-modify-write for simplicity in this context, or use jsonb_set
      // Postgres JSONB update: 
      // UPDATE system_settings SET value = jsonb_set(jsonb_set(value, '{input}', (COALESCE((value->>'input')::int, 0) + $1)::text::jsonb), ...)
      // That's complex. Let's do simple read-modify-write for now, or assume low concurrency collision risk for this specific stats key.
      
      const current = await this.getSetting('ai_token_usage') || { input: 0, output: 0, total: 0 };
      const newUsage = {
        input: (current.input || 0) + (usage.input || 0),
        output: (current.output || 0) + (usage.output || 0),
        total: (current.total || 0) + (usage.total || 0)
      };
      
      await this.setSetting('ai_token_usage', newUsage);
      return true;
    } catch (error) {
      console.error('Failed to increment token usage:', error);
      return false;
    }
  },

  /**
   * Get all settings
   */
  async getAllSettings() {
    if (!neonHelper.isConfigured) return {};
    
    try {
      const result = await neonHelper.query('SELECT key, value, description, updated_at FROM system_settings');
      const settings = {};
      if (result) {
        result.forEach(row => {
          settings[row.key] = {
            value: row.value,
            description: row.description,
            updatedAt: row.updated_at
          };
        });
      }
      return settings;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  }
};
