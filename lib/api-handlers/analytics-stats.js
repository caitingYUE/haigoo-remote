
import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!neonHelper.isConfigured) {
            return res.status(200).json({ 
                success: true, 
                data: mockData() 
            });
        }

        const { period = 'day' } = req.query; // day, week, month
        let dateFilter;
        
        switch(period) {
            case 'week':
                dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
                break;
            case 'month':
                dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
                break;
            case 'day':
            default:
                dateFilter = "created_at >= NOW() - INTERVAL '24 hours'";
                break;
        }

        // 1. Core Funnel Metrics
        // Mapping URLs to logical steps for PV/UV
        // - Acquisition: Landing Page (/)
        // - Engagement: Job List (/jobs) or Job Detail
        // - Activation: Signup
        // - Action: Apply Click
        // - Revenue: Membership
        
        // We use a CASE statement to aggregate page_views by URL pattern + specific events
        const funnelQuery = `
            WITH categorized_events AS (
                SELECT 
                    user_id, anonymous_id, created_at,
                    CASE 
                        -- Acquisition: Visit Landing
                        WHEN event_name = 'view_landing' OR (event_name = 'page_view' AND url = '/') THEN 'step_1_acquisition'
                        
                        -- Activation: Signup Success
                        WHEN event_name = 'signup_success' THEN 'step_2_activation'
                        
                        -- Engagement: View Job Detail (specific event or URL pattern)
                        WHEN event_name = 'view_job_detail' OR (event_name = 'page_view' AND url LIKE '/jobs/%') THEN 'step_3_engagement'
                        
                        -- Action: Click Apply
                        WHEN event_name = 'click_apply_init' THEN 'step_4_action'
                        
                        -- Revenue: Membership Application
                        WHEN event_name = 'submit_membership_application' THEN 'step_5_revenue'
                        
                        ELSE NULL
                    END as step_name
                FROM analytics_events
                WHERE ${dateFilter}
            )
            SELECT step_name as event_name, COUNT(DISTINCT anonymous_id) as uv, COUNT(*) as pv
            FROM categorized_events
            WHERE step_name IS NOT NULL
            GROUP BY step_name
        `;
        
        const funnelResult = await neonHelper.query(funnelQuery);
        
        // 2. Traffic by Page (Sub-pages)
        const pageQuery = `
            WITH page_visits AS (
                SELECT 
                    anonymous_id,
                    CASE 
                        WHEN url = '/' OR url = '' THEN '首页'
                        WHEN url LIKE '/jobs%' THEN '岗位列表/详情'
                        WHEN url LIKE '/companies%' THEN '企业库'
                        WHEN url LIKE '/profile%' THEN '个人中心'
                        WHEN url LIKE '/membership%' THEN '会员中心'
                        WHEN url LIKE '/christmas%' THEN '圣诞活动'
                        WHEN url LIKE '/login%' THEN '登录页'
                        WHEN url LIKE '/register%' THEN '注册页'
                        ELSE '其他页面'
                    END as page_name
                FROM analytics_events
                WHERE ${dateFilter} AND (event_name = 'page_view' OR event_name LIKE 'view_%')
            )
            SELECT page_name as event_name, COUNT(DISTINCT anonymous_id) as uv, COUNT(*) as pv
            FROM page_visits
            GROUP BY page_name
        `;
        
        const pageResult = await neonHelper.query(pageQuery);

        // 3. Key Conversion Metrics (Global)
        // Calculate totals for rates
        const totalVisitorsQuery = `
            SELECT COUNT(DISTINCT anonymous_id) as total_uv 
            FROM analytics_events 
            WHERE ${dateFilter}
        `;
        const totalVisitorsResult = await neonHelper.query(totalVisitorsQuery);
        const totalUV = parseInt(totalVisitorsResult[0]?.total_uv || 0);

        // Specific event counts for rates
        const keyEvents = [
            'signup_success', 'click_save_job', 'submit_membership_application', 'click_apply_init'
        ];
        const keyEventsQuery = `
            SELECT event_name, COUNT(DISTINCT anonymous_id) as uv
            FROM analytics_events
            WHERE ${dateFilter} AND event_name = ANY($1)
            GROUP BY event_name
        `;
        const keyEventsResult = await neonHelper.query(keyEventsQuery, [keyEvents]);
        
        const keyMetrics = {};
        keyEventsResult.forEach(row => {
            keyMetrics[row.event_name] = parseInt(row.uv);
        });

        // Job Views per User (Average)
        // Count job detail views (via URL or event)
        const jobViewsQuery = `
            SELECT COUNT(*) as total_views, COUNT(DISTINCT anonymous_id) as unique_viewers
            FROM analytics_events
            WHERE ${dateFilter} 
            AND (event_name = 'view_job_detail' OR (event_name = 'page_view' AND url LIKE '/jobs/%'))
        `;
        const jobViewsResult = await neonHelper.query(jobViewsQuery);
        const jobViewStats = jobViewsResult[0] || { total_views: 0, unique_viewers: 0 };

        // 4. Retention (Next Day)
        // Users active yesterday who are also active today
        // Note: This only makes sense if period is 'day' or we look at a snapshot.
        // For simplicity, we calculate "Yesterday to Today" retention regardless of selected period for now,
        // or we can try to calculate 7-day retention if period is week.
        // Let's stick to standard retention definition:
        // Day 1: Users from (Now-48h to Now-24h) who returned in (Now-24h to Now)
        
        const retentionQuery = `
            WITH cohort AS (
                SELECT DISTINCT anonymous_id 
                FROM analytics_events 
                WHERE created_at >= NOW() - INTERVAL '48 hours' 
                AND created_at < NOW() - INTERVAL '24 hours'
            ),
            retained AS (
                SELECT DISTINCT anonymous_id 
                FROM analytics_events 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND anonymous_id IN (SELECT anonymous_id FROM cohort)
            )
            SELECT 
                (SELECT COUNT(*) FROM cohort) as cohort_size,
                (SELECT COUNT(*) FROM retained) as retained_count
        `;
        const retentionResult = await neonHelper.query(retentionQuery);
        const retentionStats = retentionResult[0] || { cohort_size: 0, retained_count: 0 };

        // 5. Trend (Daily UV/PV for the period)
        // Group by day
        const trendQuery = `
            SELECT DATE(created_at) as date, COUNT(DISTINCT anonymous_id) as uv, COUNT(*) as pv
            FROM analytics_events
            WHERE ${dateFilter}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        const trendResult = await neonHelper.query(trendQuery);

        return res.status(200).json({
            success: true,
            data: {
                funnel: processFunnelData(funnelResult),
                pages: processPageData(pageResult),
                metrics: {
                    totalUV,
                    registrationRate: totalUV ? ((keyMetrics['signup_success'] || 0) / totalUV) : 0,
                    avgJobViews: jobViewStats.unique_viewers ? (jobViewStats.total_views / jobViewStats.unique_viewers) : 0,
                    applyConversion: jobViewStats.unique_viewers ? ((keyMetrics['click_apply_init'] || 0) / jobViewStats.unique_viewers) : 0, // Apply clicks / Job Viewers
                    favoriteRate: jobViewStats.unique_viewers ? ((keyMetrics['click_save_job'] || 0) / jobViewStats.unique_viewers) : 0,
                    memberApplyRate: totalUV ? ((keyMetrics['submit_membership_application'] || 0) / totalUV) : 0,
                    retention: {
                        day1: retentionStats.cohort_size ? (retentionStats.retained_count / retentionStats.cohort_size) : 0,
                        // Placeholders for 7/30 days as they require longer data history
                        day7: 0, 
                        day30: 0
                    }
                },
                trend: trendResult
            }
        });

    } catch (error) {
        console.error('[Analytics Stats] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

function processFunnelData(rows) {
    const map = {};
    rows.forEach(r => map[r.event_name] = { uv: parseInt(r.uv), pv: parseInt(r.pv) });
    
    // Ordered logical steps
    const steps = [
        { id: 'step_1_acquisition', name: 'view_landing' },
        { id: 'step_2_activation', name: 'signup_success' },
        { id: 'step_3_engagement', name: 'view_job_detail' },
        { id: 'step_4_action', name: 'click_apply_init' },
        { id: 'step_5_revenue', name: 'submit_membership_application' }
    ];
    
    return steps.map(step => ({
        event: step.name,
        uv: map[step.id]?.uv || 0,
        pv: map[step.id]?.pv || 0
    }));
}

function processPageData(rows) {
    // Rows already have readable names from SQL
    return rows.map(r => ({
        name: r.event_name, // SQL alias
        uv: parseInt(r.uv),
        pv: parseInt(r.pv)
    })).sort((a, b) => b.pv - a.pv);
}

function mockData() {
    return {
        funnel: [
            { event: 'view_landing', uv: 120, pv: 300 },
            { event: 'signup_success', uv: 40, pv: 40 },
            { event: 'view_job_detail', uv: 80, pv: 240 },
            { event: 'click_apply_init', uv: 20, pv: 25 },
            { event: 'submit_membership_application', uv: 5, pv: 5 }
        ],
        pages: [
            { name: '首页', uv: 100, pv: 200 },
            { name: '岗位列表', uv: 80, pv: 300 },
            { name: '精选企业', uv: 30, pv: 60 }
        ],
        metrics: {
            totalUV: 150,
            registrationRate: 0.25,
            avgJobViews: 3.5,
            applyConversion: 0.15,
            favoriteRate: 0.1,
            memberApplyRate: 0.03,
            retention: { day1: 0.4, day7: 0.2, day30: 0.1 }
        },
        trend: []
    };
}
