
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
        // We need counts for specific events to build the funnel
        const funnelEvents = [
            'view_landing', // Acquisition
            'signup_success', // Activation
            'view_job_detail', // Engagement
            'click_apply_init', // Action (Intent)
            'submit_membership_application' // Revenue
        ];
        
        const funnelQuery = `
            SELECT event_name, COUNT(DISTINCT anonymous_id) as uv, COUNT(*) as pv
            FROM analytics_events
            WHERE ${dateFilter} AND event_name = ANY($1)
            GROUP BY event_name
        `;
        
        const funnelResult = await neonHelper.query(funnelQuery, [funnelEvents]);
        
        // 2. Traffic by Page (Sub-pages)
        // Mapping events to pages
        const pageEvents = [
            'view_landing', 'view_job_list', 'view_company_detail', 
            'view_profile', 'view_membership', 'view_christmas'
        ];
        
        const pageQuery = `
            SELECT event_name, COUNT(DISTINCT anonymous_id) as uv, COUNT(*) as pv
            FROM analytics_events
            WHERE ${dateFilter} AND event_name = ANY($1)
            GROUP BY event_name
        `;
        
        const pageResult = await neonHelper.query(pageQuery, [pageEvents]);

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
            'signup_success', 'click_save_job', 'submit_membership_application', 'view_job_detail'
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
        const jobViewsQuery = `
            SELECT COUNT(*) as total_views, COUNT(DISTINCT anonymous_id) as unique_viewers
            FROM analytics_events
            WHERE ${dateFilter} AND event_name = 'view_job_detail'
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
                funnel: processFunnelData(funnelResult, funnelEvents),
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

function processFunnelData(rows, orderedEvents) {
    const map = {};
    rows.forEach(r => map[r.event_name] = { uv: parseInt(r.uv), pv: parseInt(r.pv) });
    
    return orderedEvents.map(event => ({
        event,
        uv: map[event]?.uv || 0,
        pv: map[event]?.pv || 0
    }));
}

function processPageData(rows) {
    const map = {
        'view_landing': '首页',
        'view_job_list': '岗位列表',
        'view_company_detail': '精选企业',
        'view_profile': '个人中心',
        'view_membership': '会员中心',
        'view_christmas': '圣诞树活动'
    };
    
    return rows.map(r => ({
        name: map[r.event_name] || r.event_name,
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
