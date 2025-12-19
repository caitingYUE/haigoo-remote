/**
 * Christmas Campaign - Email Lead Capture
 * Saves email addresses from download requests
 */

import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, tree_id } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Invalid email' });
        }

        // Save to database (create table if needed)
        if (neonHelper.isConfigured) {
            try {
                // Create table if not exists
                await neonHelper.query(`
                    CREATE TABLE IF NOT EXISTS campaign_leads (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        tree_id VARCHAR(255),
                        source VARCHAR(50) DEFAULT 'christmas_download',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Insert lead
                await neonHelper.query(`
                    INSERT INTO campaign_leads (email, tree_id, source)
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                `, [email, tree_id || null, 'christmas_download']);

                console.log(`[ChristmasLead] Saved email: ${email}`);
            } catch (dbErr) {
                console.error('[ChristmasLead] DB error:', dbErr);
                // Non-blocking - continue even if DB fails
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[ChristmasLead] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
