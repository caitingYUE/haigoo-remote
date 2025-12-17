
import { systemSettingsService } from '../lib/services/system-settings-service.js';
import { verifyToken } from '../server-utils/auth-helpers.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth check
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
      // Allow internal calls or check secret if needed, but for admin panel we need auth
      // For simplicity, we assume this is called from Admin Panel which has a token
      // If called from cron (internal), we might need another check.
      // But cron handlers use the service directly, not this API.
      return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const user = verifyToken(token);
  if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (req.method === 'GET') {
      const settings = await systemSettingsService.getAllSettings();
      return res.status(200).json({ success: true, data: settings });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }
      
      const success = await systemSettingsService.setSetting(key, value);
      if (success) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(500).json({ error: 'Failed to save setting' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('System settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
