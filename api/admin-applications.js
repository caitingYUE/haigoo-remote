
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { getUserById } from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'

// Neon Database Configuration
const NEON_CONFIGURED = !!neonHelper?.isConfigured

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        // 1. Verify Admin Auth
        const token = extractToken(req)
        if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' })

        const payload = verifyToken(token)
        if (!payload || !payload.userId) return res.status(401).json({ success: false, error: 'Invalid token' })

        const user = await getUserById(payload.userId)
        if (!user || (!user.roles?.admin && user.email !== 'caitlinyct@gmail.com')) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
        }

        const { action } = req.query

        // 2. GET: List Applications (Paginated, Filtered)
        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 20
            const offset = (page - 1) * limit
            const type = req.query.type || 'all' // referral, official, trusted_platform, all
            const status = req.query.status || 'all'
            const search = req.query.search || ''

            if (!NEON_CONFIGURED) {
                return res.status(503).json({ success: false, error: 'Database not configured' })
            }

            // Base query
            let query = `
                SELECT 
                    uji.id, 
                    uji.user_id,
                    u.username as "userNickname",
                    u.email as "userEmail",
                    uji.job_id, 
                    j.title as "jobTitle", 
                    j.company, 
                    uji.interaction_type,
                    uji.status, 
                    uji.updated_at, 
                    uji.created_at,
                    uji.notes,
                    uji.resume_id,
                    r.file_name as "resumeName",
                    r.file_size as "resumeSize",
                    CASE 
                        WHEN uji.application_source IS NOT NULL THEN uji.application_source
                        WHEN j.can_refer = true THEN 'referral'
                        WHEN j.is_trusted = true OR j.source_type = 'official' THEN 'official'
                        WHEN j.source_type = 'trusted' THEN 'trusted_platform'
                        ELSE 'trusted_platform'
                    END as "sourceType"
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                LEFT JOIN users u ON uji.user_id = u.user_id
                LEFT JOIN resumes r ON uji.resume_id = r.resume_id
                WHERE 1=1
            `

            const countQuery = `
                SELECT COUNT(*) 
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                LEFT JOIN users u ON uji.user_id = u.user_id
                WHERE 1=1
            `

            const params = []
            let paramIndex = 1

            // Filters
            if (type !== 'all') {
                if (type === 'referral') {
                    query += ` AND uji.interaction_type = 'referral'`
                    // countQuery += ` AND uji.interaction_type = 'referral'`
                } else if (type === 'official') {
                    // Assuming 'apply_official' or mapped via source logic. 
                    // But simplified: user_job_interactions stores interaction_type.
                    // If we rely on job properties, we need to filter based on job.
                    // For now, let's assume interaction_type captures the intent or we filter by job props.
                    // Actually, frontend logic records 'apply' generally. 
                    // Let's rely on the derived sourceType column for filtering if possible, 
                    // OR better: enforce interaction_type to be specific if we can.
                    // Given current data might be generic 'apply', we might need to filter by job properties.
                    // BUT SQL WHERE clause executes before projection.
                    
                    // Let's stick to interaction_type if possible, but standard apply is just 'apply'.
                    // We can filter by job properties here.
                    query += ` AND (j.is_trusted = true OR j.source_type = 'official') AND j.can_refer IS NOT TRUE`
                } else if (type === 'trusted_platform') {
                     query += ` AND (j.source_type = 'trusted' OR j.source_type = 'third-party') AND j.is_trusted IS NOT TRUE AND j.can_refer IS NOT TRUE`
                }
            }

            // If we strictly want to see "applications", we should filter interaction_type to be 'apply' or 'referral'
            // Exclude 'view'
            query += ` AND uji.interaction_type IN ('referral', 'apply', 'apply_redirect')`
            
            // Search (User name, email, job title, company)
            if (search) {
                query += ` AND (u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR j.title ILIKE $${paramIndex} OR j.company ILIKE $${paramIndex})`
                params.push(`%${search}%`)
                paramIndex++
            }

            // Status filter
            if (status !== 'all') {
                query += ` AND uji.status = $${paramIndex}`
                params.push(status)
                paramIndex++
            }

            // Sorting
            query += ` ORDER BY uji.updated_at DESC`

            // Pagination
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
            params.push(limit, offset)

            // Execute
            // Note: For count query, we need to replicate the WHERE clauses manually or simplify
            // Simplified count query for now (might be slightly inaccurate if complex filters but sufficient)
            // Actually, let's just run the data query. Pagination count is nice but maybe optional if speed matters.
            // Let's do a separate count query properly.
            
            let countSql = `
                SELECT COUNT(*) as count
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                LEFT JOIN users u ON uji.user_id = u.user_id
                WHERE uji.interaction_type IN ('referral', 'apply', 'apply_redirect')
            `
            const countParams = []
            let countParamIndex = 1
            
            if (search) {
                countSql += ` AND (u.username ILIKE $${countParamIndex} OR u.email ILIKE $${countParamIndex} OR j.title ILIKE $${countParamIndex} OR j.company ILIKE $${countParamIndex})`
                countParams.push(`%${search}%`)
                countParamIndex++
            }
             if (status !== 'all') {
                countSql += ` AND uji.status = $${countParamIndex}`
                countParams.push(status)
                countParamIndex++
            }
             if (type === 'referral') {
                countSql += ` AND uji.interaction_type = 'referral'`
            } else if (type === 'official') {
                 countSql += ` AND (j.is_trusted = true OR j.source_type = 'official') AND j.can_refer IS NOT TRUE`
            } else if (type === 'trusted_platform') {
                 countSql += ` AND (j.source_type = 'trusted' OR j.source_type = 'third-party') AND j.is_trusted IS NOT TRUE AND j.can_refer IS NOT TRUE`
            }

            const [data, countResult] = await Promise.all([
                neonHelper.query(query, params),
                neonHelper.query(countSql, countParams)
            ])

            const total = parseInt(countResult[0]?.count || 0)

            return res.status(200).json({
                success: true,
                data: data,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            })
        }

        // 3. POST: Update Application Status
        if (req.method === 'POST' && action === 'update_status') {
            const { id, status, notes } = req.body
            if (!id || !status) return res.status(400).json({ success: false, error: 'Missing id or status' })

            if (!NEON_CONFIGURED) return res.status(503).json({ success: false, error: 'Database not configured' })

            // Optional: Update notes if provided (append or replace? Replace for admin edits usually better)
            // If notes is undefined, don't update it.
            let updateQuery = `UPDATE user_job_interactions SET status = $1, updated_at = NOW()`
            const updateParams = [status, id]
            let paramIdx = 3

            if (notes !== undefined) {
                updateQuery += `, notes = $${paramIdx}`
                updateParams.push(notes)
            }

            updateQuery += ` WHERE id = $2`

            await neonHelper.query(updateQuery, updateParams)

            return res.status(200).json({ success: true })
        }
        
        // 4. GET: Stats (Counts for tabs)
        if (req.method === 'GET' && action === 'stats') {
             if (!NEON_CONFIGURED) return res.status(503).json({ success: false, error: 'Database not configured' })

             const statsQuery = `
                SELECT
                    COUNT(CASE WHEN uji.interaction_type = 'referral' THEN 1 END) as referral_count,
                    COUNT(CASE WHEN (j.is_trusted = true OR j.source_type = 'official') AND j.can_refer IS NOT TRUE AND uji.interaction_type IN ('apply', 'apply_redirect') THEN 1 END) as official_count,
                    COUNT(CASE WHEN (j.source_type = 'trusted' OR j.source_type = 'third-party') AND j.is_trusted IS NOT TRUE AND j.can_refer IS NOT TRUE AND uji.interaction_type IN ('apply', 'apply_redirect') THEN 1 END) as platform_count
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
             `
             const result = await neonHelper.query(statsQuery)
             return res.status(200).json({ success: true, stats: result[0] || {} })
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' })

    } catch (error) {
        console.error('[Admin Applications API] Error:', error)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
}
