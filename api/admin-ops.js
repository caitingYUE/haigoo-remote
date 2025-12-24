import neonHelper from '../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import subscriptionsHandler from '../lib/api-handlers/subscriptions.js'
import bugReportsHandler from '../lib/api-handlers/bug-reports.js'
import { systemSettingsService } from '../lib/services/system-settings-service.js'

export default async function handler(req, res) {
    // Basic CORS and headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const { action } = req.query
    
    console.log(`[admin-ops] Action: ${action}, Method: ${req.method}`)

    // Dispatch to Subscriptions Handler
    if (action === 'subscriptions') {
        return await subscriptionsHandler(req, res)
    }

    // Dispatch to Bug Reports Handler
    if (action === 'bug_report') {
        return await bugReportsHandler(req, res)
    }
    
    // System Settings Handler
    if (action === 'system-settings') {
         const token = extractToken(req)
         if (!token || !verifyToken(token)) {
             return res.status(401).json({ success: false, error: 'Unauthorized' })
         }

         if (req.method === 'GET') {
             const ai_translation_enabled = await systemSettingsService.getSetting('ai_translation_enabled') || { value: true }
             const ai_token_usage = await systemSettingsService.getSetting('ai_token_usage') || { value: { input: 0, output: 0, total: 0 } }
             return res.status(200).json({ 
                 success: true, 
                 data: { ai_translation_enabled, ai_token_usage } 
             })
         }

         if (req.method === 'POST') {
             const { key, value } = req.body
             if (!key || value === undefined) {
                 return res.status(400).json({ success: false, error: 'Key and value required' })
             }
             // Wrap value in object if needed, but service expects raw value and wraps it in JSON string
             // But wait, the service does: VALUES ($1, $2) where $2 is JSON.stringify(value)
             // So we pass the raw object/value.
             const result = await systemSettingsService.setSetting(key, { value })
             if (result) {
                 return res.status(200).json({ success: true })
             } else {
                 return res.status(500).json({ success: false, error: 'Failed to save setting' })
             }
         }
         return res.status(405).json({ error: 'Method not allowed' })
    }
    
    // Diagnose DB (from vercel.json)
    if (action === 'diagnose') {
         const token = extractToken(req)
         if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' })
         
         if (neonHelper.isConfigured) {
             try {
                 const tables = await neonHelper.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                 return res.status(200).json({ success: true, status: 'connected', tables: tables.map(t => t.table_name) })
             } catch (e) {
                 return res.status(500).json({ success: false, error: e.message })
             }
         } else {
             return res.status(500).json({ success: false, error: 'DB not configured' })
         }
    }

    // Migration placeholder
    if (action === 'migrate') {
        return res.status(501).json({ success: false, error: 'Migration endpoint not implemented in consolidated handler' })
    }
    
    // Check User placeholder
    if (action === 'check-user') {
        return res.status(501).json({ success: false, error: 'Check User endpoint not implemented in consolidated handler' })
    }

    // Diagnose Bug Reports Table
    if (action === 'check-bugs') {
         const token = extractToken(req)
         if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' })
         
         try {
             const countRes = await neonHelper.query('SELECT COUNT(*) as count FROM bug_reports')
             const sampleRes = await neonHelper.query('SELECT * FROM bug_reports ORDER BY created_at DESC LIMIT 5')
             return res.status(200).json({ 
                 success: true, 
                 count: countRes[0]?.count, 
                 sample: sampleRes 
             })
         } catch (e) {
             return res.status(500).json({ success: false, error: e.message })
         }
    }

    // Repair Bug Reports Table Schema
    if (action === 'repair_bug_table') {
        const token = extractToken(req)
        if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' })

        try {
            await neonHelper.query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS contact_info VARCHAR(255)')
            await neonHelper.query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS admin_reply TEXT')
            await neonHelper.query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP')
            return res.status(200).json({ success: true, message: 'Schema repaired successfully' })
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message })
        }
    }

    // Repair Campaign Leads Table Schema
    if (action === 'repair_campaign_leads') {
        const token = extractToken(req)
        if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' })

        try {
            await neonHelper.query('ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)')
            await neonHelper.query('ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false')
            await neonHelper.query('ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS allow_resume_storage BOOLEAN DEFAULT false')
            return res.status(200).json({ success: true, message: 'Campaign leads schema repaired successfully' })
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message })
        }
    }

    return res.status(404).json({ error: `Unknown admin action: ${action}` })
}
