/**
 * API endpoint for manual translation triggers from admin panel
 * Wraps the cron handler to allow page-by-page translation
 */

import translateJobsHandler from '../../lib/cron-handlers/translate-jobs.js'

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Get page and pageSize from request body
    const { page = 1, pageSize = 20 } = req.body || {}

    console.log(`[translate-jobs API] Manual translation request: page=${page}, pageSize=${pageSize}`)

    try {
        // Call the cron handler with action=run query parameter
        req.query = { ...req.query, action: 'run' }

        // Execute translation
        await translateJobsHandler(req, res)
    } catch (error) {
        console.error('[translate-jobs API] Error:', error)
        return res.status(500).json({
            error: 'Translation failed',
            message: error.message
        })
    }
}
