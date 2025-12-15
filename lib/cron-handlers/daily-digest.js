import neonHelper from '../../server-utils/dal/neon-helper.js'
import { sendDailyDigestEmail, isEmailServiceConfigured } from '../../server-utils/email-service.js'
import { readJobsFromNeon } from '../api-handlers/processed-jobs.js'

/**
 * Calculate job match score based on topic
 * Simple keyword matching:
 * - Title match: 50 points
 * - Description match: 20 points
 * - Tag match: 40 points
 * - Total > 30 points considered "relevant"
 */
function calculateTopicMatchScore(job, topic) {
    if (!topic || topic === 'all') return 100;
    
    const t = topic.toLowerCase();
    let score = 0;
    
    // Title Match
    if ((job.title || '').toLowerCase().includes(t)) score += 50;
    
    // Tags Match (Any tag)
    const tags = (job.tags || []).map(tag => String(tag).toLowerCase());
    if (tags.some(tag => tag.includes(t))) score += 40;
    
    // Description Match (Only if not already matched by title to avoid double counting too much, or just add it)
    if ((job.description || '').toLowerCase().includes(t)) score += 20;
    
    return score;
}

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
        let skippedCount = 0

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
                    // Filter and Sort by Score
                    const scoredJobs = recentJobs.map(job => ({
                        ...job,
                        _score: calculateTopicMatchScore(job, topic)
                    }));

                    // Filter: Match Score > 30
                    matchedJobs = scoredJobs
                        .filter(job => job._score > 30)
                        .sort((a, b) => b._score - a._score)
                        .slice(0, 5);
                }

                // If no jobs meet the criteria (>30% relevance), SKIP sending
                if (matchedJobs.length === 0) {
                    console.log(`[DailyDigest] Skipping ${sub.identifier}: No relevant jobs found for topic '${topic}'`)
                    skippedCount++
                    continue;
                }

                // Send Email
                const success = await sendDailyDigestEmail(sub.identifier, matchedJobs, sub.topic || 'All')
                
                if (success) {
                    sentCount++
                    // Update last_sent_at and reset fail_count
                    await neonHelper.update(
                        'subscriptions', 
                        { 
                            last_sent_at: new Date().toISOString(),
                            fail_count: 0 
                        }, 
                        { subscription_id: sub.subscription_id }
                    )
                } else {
                    errorCount++
                    console.error(`[DailyDigest] Failed to send email to ${sub.identifier}`)
                    
                    // Increment fail_count
                    const currentFailCount = (sub.fail_count || 0) + 1;
                    
                    if (currentFailCount >= 3) {
                        // Deactivate subscription after 3 failures
                        await neonHelper.update(
                            'subscriptions', 
                            { 
                                status: 'bounced', 
                                fail_count: currentFailCount,
                                updated_at: new Date().toISOString()
                            }, 
                            { subscription_id: sub.subscription_id }
                        )
                        console.log(`[DailyDigest] Deactivated subscription for ${sub.identifier} due to 3 consecutive failures`)
                    } else {
                        // Just update fail count
                        await neonHelper.update(
                            'subscriptions', 
                            { fail_count: currentFailCount }, 
                            { subscription_id: sub.subscription_id }
                        )
                    }
                }

                // Log progress
                if ((sentCount + errorCount + skippedCount) % 10 === 0) {
                     res.write(`data: ${JSON.stringify({ type: 'progress', sent: sentCount, errors: errorCount, skipped: skippedCount })}\n\n`)
                }

            } catch (err) {
                console.error(`[DailyDigest] Error processing ${sub.identifier}:`, err)
                errorCount++
            }
        }

        res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            stats: { sent: sentCount, errors: errorCount, skipped: skippedCount },
            message: `Sent ${sentCount} digests, ${skippedCount} skipped, ${errorCount} failed` 
        })}\n\n`)
        res.end()

    } catch (error) {
        console.error('[DailyDigest] Critical error:', error)
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        res.end()
    }
}
