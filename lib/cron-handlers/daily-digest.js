import neonHelper from '../../server-utils/dal/neon-helper.js'
import { sendDailyDigestEmail, isEmailServiceConfigured } from '../../server-utils/email-service.js'
import { readJobsFromNeon } from '../api-handlers/processed-jobs.js'

const TOPIC_KEYWORD_MAP = {
    'full-stack': ['full stack', 'fullstack', '全栈'],
    'frontend': ['frontend', 'front-end', '前端', 'react', 'vue'],
    'backend': ['backend', 'back-end', '后端', 'node', 'java', 'go', 'python'],
    'mobile': ['mobile', 'ios', 'android', 'flutter', 'react native', '移动端'],
    'devops': ['devops', 'sre', '运维', 'infrastructure', 'cloud'],
    'qa': ['qa', '测试', 'test', 'quality'],
    'security': ['security', '安全', 'sec'],
    'data': ['data', 'analytics', '数据'],
    'ai-ml': ['ai', 'ml', 'machine learning', 'artificial intelligence', '算法', '人工智能', '大模型'],
    'product-management': ['product', 'pm', '产品'],
    'project-management': ['project', '项目'],
    'ui-ux': ['ui', 'ux', 'design', '设计师', '交互'],
    'marketing': ['marketing', '市场', '营销', 'growth'],
    'sales': ['sales', '销售', 'bd', 'business development'],
    'content': ['content', 'writer', 'copywriter', '内容', '文案', '编辑'],
    'customer-support': ['support', 'customer', '客服', '客户支持'],
    'hr': ['hr', 'human resources', 'recruiter', '人事', '招聘'],
    'finance': ['finance', 'accounting', '财务', '会计'],
    'legal': ['legal', 'law', '法务', '律师'],
    'other': []
};

/**
 * Calculate job match score based on topic
 * Keyword matching with categories:
 * - Direct Category/Topic match: 100 points
 * - Title match: 50 points
 * - Tag match: 40 points
 * - Description match: 20 points
 * - Total > 30 points considered "relevant"
 */
function calculateTopicMatchScore(job, topicString) {
    if (!topicString || topicString === 'all') return 100;

    // Split by comma in case user has multiple topics
    const subscriptions = topicString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (subscriptions.length === 0) return 100;

    let maxScore = 0;

    for (const sub of subscriptions) {
        let score = 0;

        // Ensure category match fetches top points immediately
        if (job.category && (job.category.toLowerCase() === sub || job.category.toLowerCase() === sub.replace('-', ' '))) {
            score += 100;
        }

        // Get keywords associated with this topic
        const keywords = TOPIC_KEYWORD_MAP[sub] || [sub.replace('-', ' ')];

        for (const word of keywords) {
            // Title Match
            if ((job.title || '').toLowerCase().includes(word)) score += 50;

            // Tags Match (Any tag)
            const tags = (job.tags || []).map(tag => String(tag).toLowerCase());
            if (tags.some(tag => tag.includes(word))) score += 40;

            // Description Match (Only if not already matched by title to avoid double counting too much)
            if ((job.description || '').toLowerCase().includes(word)) score += 20;
        }

        if (score > maxScore) {
            maxScore = score;
        }
    }

    // Cap score at 100
    return Math.min(maxScore, 100);
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
                            fail_count: 0,
                            status: 'active'
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
