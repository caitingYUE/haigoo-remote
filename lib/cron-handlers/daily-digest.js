import neonHelper from '../../server-utils/dal/neon-helper.js'
import { sendDailyDigestEmail, isEmailServiceConfigured } from '../../server-utils/email-service.js'
import { readJobsFromNeon } from '../api-handlers/processed-jobs.js'

/**
 * Daily Digest Cron Handler
 */
export async function sendDailyDigests(res) {
    if (!isEmailServiceConfigured()) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Email service not configured' })}\n\n`)
        res.end()
        return
    }

    try {
        // 1. Get Active Subscriptions
        const subscriptions = await neonHelper.select('subscriptions', { status: 'active', channel: 'email' })
        
        if (!subscriptions || subscriptions.length === 0) {
            res.write(`data: ${JSON.stringify({ type: 'info', message: 'No active subscriptions found' })}\n\n`)
            res.end()
            return
        }

        console.log(`[DailyDigest] Found ${subscriptions.length} active subscriptions`)
        res.write(`data: ${JSON.stringify({ type: 'start', message: `Found ${subscriptions.length} subscriptions` })}\n\n`)

        let sentCount = 0
        let errorCount = 0

        // 2. Fetch Jobs (Fetch top 50 recent jobs)
        const recentJobs = await readJobsFromNeon({}, { page: 1, limit: 50 })
        
        for (const sub of subscriptions) {
            try {
                // Filter jobs based on topic (naive matching)
                const topic = (sub.topic || '').toLowerCase()
                let matchedJobs = []

                if (topic === 'all' || !topic) {
                    matchedJobs = recentJobs.slice(0, 5)
                } else {
                    matchedJobs = recentJobs.filter(job => {
                        const title = (job.title || '').toLowerCase()
                        const desc = (job.description || '').toLowerCase()
                        const tags = (job.tags || []).join(' ').toLowerCase()
                        return title.includes(topic) || desc.includes(topic) || tags.includes(topic)
                    }).slice(0, 5)
                }

                // If no specific matches, fallback to top 5 generic to ensure value
                if (matchedJobs.length === 0) {
                    matchedJobs = recentJobs.slice(0, 5)
                }

                // Send Email
                const success = await sendDailyDigestEmail(sub.identifier, matchedJobs, sub.topic || 'All')
                
                if (success) {
                    sentCount++
                    // Update last_sent_at
                    await neonHelper.update('subscriptions', { last_sent_at: new Date().toISOString() }, { subscription_id: sub.subscription_id })
                } else {
                    errorCount++
                }

                // Log progress
                if (sentCount % 10 === 0) {
                     res.write(`data: ${JSON.stringify({ type: 'progress', sent: sentCount, errors: errorCount })}\n\n`)
                }

            } catch (err) {
                console.error(`[DailyDigest] Error sending to ${sub.identifier}:`, err)
                errorCount++
            }
        }

        res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            stats: { sent: sentCount, errors: errorCount },
            message: `Sent ${sentCount} digests, ${errorCount} failed` 
        })}\n\n`)
        res.end()

    } catch (error) {
        console.error('[DailyDigest] Critical error:', error)
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        res.end()
    }
}
