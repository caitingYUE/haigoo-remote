import neonHelper from '../../server-utils/dal/neon-helper.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'GET') {
            const result = await neonHelper.query(
                'SELECT * FROM subscriptions ORDER BY created_at DESC'
            );
            return res.status(200).json({ subscriptions: result || [] });
        }

        if (req.method === 'POST') {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Check if exists
            const existing = await neonHelper.query(
                'SELECT * FROM subscriptions WHERE identifier = $1',
                [email]
            );

            if (existing && existing.length > 0) {
                return res.status(409).json({ error: 'Subscription already exists' });
            }

            const newSub = {
                subscription_id: crypto.randomUUID(),
                identifier: email,
                channel: 'email',
                topic: 'all',
                frequency: 'daily',
                status: 'active',
                created_at: new Date().toISOString(),
                fail_count: 0
            };

            const result = await neonHelper.insert('subscriptions', newSub);
            return res.status(201).json({ subscription: result?.[0] });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) {
                return res.status(400).json({ error: 'ID is required' });
            }

            await neonHelper.query(
                'DELETE FROM subscriptions WHERE subscription_id = $1',
                [id]
            );
            return res.status(200).json({ success: true });
        }

        if (req.method === 'PUT') {
            const { id, status } = req.body;
             if (!id) {
                return res.status(400).json({ error: 'ID is required' });
            }
            
            const updates = {};
            if (status) updates.status = status;
            
            // Allow resetting fail_count if reactivating
            if (status === 'active') {
                updates.fail_count = 0;
            }

            if (Object.keys(updates).length === 0) {
                 return res.status(400).json({ error: 'No updates provided' });
            }
            
            updates.updated_at = new Date().toISOString();

            const result = await neonHelper.update(
                'subscriptions',
                updates,
                { subscription_id: id }
            );
            return res.status(200).json({ subscription: result?.[0] });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Subscription API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
