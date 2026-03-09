import neonHelper from '../../server-utils/dal/neon-helper.js';
import { monitorAdminDailyJobEmail } from '../services/admin-daily-job-email-service.js';

export default async function adminMessagesHandler(req, res) {
    const { action } = req.query;

    if (action === 'admin_messages') {
        if (!neonHelper.isConfigured) {
            return res.status(200).json({ success: true, messages: [] });
        }

        try {
            try {
                await monitorAdminDailyJobEmail();
            } catch (monitorError) {
                console.error('[admin-messages] monitor check failed', monitorError);
            }

            // Fetch the 50 most recent messages
            const result = await neonHelper.query(`
                SELECT * FROM admin_messages 
                ORDER BY created_at DESC 
                LIMIT 50
            `);
            const messages = result || [];
            return res.status(200).json({ success: true, messages });
        } catch (error) {
            console.error('[admin-messages] error fetching', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
        }
    }

    if (action === 'admin_messages_delete') {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Message ID is required' });
        }

        try {
            await neonHelper.query('DELETE FROM admin_messages WHERE id = $1', [id]);
            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('[admin-messages] error deleting', error);
            return res.status(500).json({ success: false, error: 'Failed to delete message' });
        }
    }

    return res.status(400).json({ error: 'Unknown action' });
}
