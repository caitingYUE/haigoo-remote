
import { mineCompanyContacts } from '../services/contact-miner-service.js';
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';

export default async function handler(req, res) {
    // 1. Auth Check
    const token = extractToken(req);
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 2. Input Validation
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { input, useGoogle } = req.body;
    if (!input || typeof input !== 'string') {
        return res.status(400).json({ success: false, error: 'Input (domain/url) is required' });
    }

    try {
        // 3. Execute Mining
        const result = await mineCompanyContacts(input, { useGoogle });
        
        // 4. Return Results
        return res.status(200).json(result);

    } catch (e) {
        console.error('[ContactMinerAPI] Error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
}
