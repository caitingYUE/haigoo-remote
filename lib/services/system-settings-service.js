
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
   * @param {string} module 'translation' | 'resume_parsing' | 'job_matching' | 'other'
   */
  async incrementTokenUsage(usage, module = 'other') {
    if (!neonHelper.isConfigured) return false;
    if (!usage || (usage.input === 0 && usage.output === 0)) return true;

    try {
      const current = await this.getSetting('ai_token_usage') || { 
        input: 0, output: 0, total: 0,
        translation: { input: 0, output: 0, total: 0 },
        resume_parsing: { input: 0, output: 0, total: 0 },
        job_matching: { input: 0, output: 0, total: 0 },
        other: { input: 0, output: 0, total: 0 }
      };

      // Update total
      const newUsage = {
        ...current,
        input: (current.input || 0) + (usage.input || 0),
        output: (current.output || 0) + (usage.output || 0),
        total: (current.total || 0) + (usage.total || 0)
      };

      // Update module specific usage
      const safeModule = ['translation', 'resume_parsing', 'job_matching'].includes(module) ? module : 'other';
      if (!newUsage[safeModule]) newUsage[safeModule] = { input: 0, output: 0, total: 0 };
      
      newUsage[safeModule] = {
        input: (newUsage[safeModule].input || 0) + (usage.input || 0),
        output: (newUsage[safeModule].output || 0) + (usage.output || 0),
        total: (newUsage[safeModule].total || 0) + (usage.total || 0)
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
